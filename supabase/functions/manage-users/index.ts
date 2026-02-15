import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabaseUser.auth.getClaims(token);
    
    if (claimsError || !claims?.claims) {
      console.error('Claims error:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claims.claims.sub;

    // Check if user is superadmin - now checking for any superadmin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'superadmin');

    if (roleError || !roleData || roleData.length === 0) {
      console.log('User is not superadmin:', userId);
      return new Response(
        JSON.stringify({ error: 'Acceso denegado. Solo superadmin puede gestionar usuarios.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;
    console.log('Action:', action);

    if (action === 'list') {
      // Get all users with their roles (now multiple roles per user)
      const { data: users, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select(`
          id,
          user_id,
          email,
          full_name,
          created_at,
          empresa_id
        `);

      if (usersError) {
        console.error('Users error:', usersError);
        throw usersError;
      }

      const { data: roles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        console.error('Roles error:', rolesError);
        throw rolesError;
      }

      // Group roles by user_id
      const rolesMap = new Map<string, string[]>();
      roles?.forEach(r => {
        const existing = rolesMap.get(r.user_id) || [];
        existing.push(r.role);
        rolesMap.set(r.user_id, existing);
      });
      
      // Get empresas for names
      const { data: empresas } = await supabaseAdmin
        .from('catalogo_empresas')
        .select('id, nombre');
      
      const empresasMap = new Map<string, string>();
      empresas?.forEach(e => empresasMap.set(e.id, e.nombre));

      const usersWithRoles = users?.map(u => ({
        ...u,
        roles: rolesMap.get(u.user_id) || ['inactivo'],
        empresa_nombre: u.empresa_id ? empresasMap.get(u.empresa_id) || null : null
      })) || [];

      return new Response(
        JSON.stringify({ users: usersWithRoles }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'createUser') {
      const { email, password, fullName, roles } = body;
      
      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: 'Email y contraseña son requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userRoles = Array.isArray(roles) ? roles : (roles ? [roles] : ['inactivo']);
      console.log('Creating user:', email, 'with roles:', userRoles);

      // Create user with admin API
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || ''
        }
      });

      if (createError) {
        console.error('Create user error:', createError);
        const errorMessage = createError.message.includes('already been registered') 
          ? 'Este correo ya está registrado' 
          : createError.message;
        return new Response(
          JSON.stringify({ error: errorMessage }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('User created:', newUser.user?.id);

      if (newUser.user) {
        // Wait a bit for the trigger to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Delete the default role created by trigger
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', newUser.user.id);

        // Insert all specified roles
        for (const role of userRoles) {
          await supabaseAdmin
            .from('user_roles')
            .insert({ 
              user_id: newUser.user.id, 
              role
            });
        }

        // Also update full_name in profile if provided
        if (fullName) {
          await supabaseAdmin
            .from('profiles')
            .update({ full_name: fullName })
            .eq('user_id', newUser.user.id);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Usuario creado correctamente', userId: newUser.user?.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'updateUser') {
      const { targetUserId, fullName, email, empresaId } = body;
      
      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'ID de usuario requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update profile
      const profileUpdate: Record<string, unknown> = {};
      if (fullName !== undefined) profileUpdate.full_name = fullName;
      if (empresaId !== undefined) profileUpdate.empresa_id = empresaId || null;
      
      if (Object.keys(profileUpdate).length > 0) {
        await supabaseAdmin
          .from('profiles')
          .update(profileUpdate)
          .eq('user_id', targetUserId);
      }

      // Update email if provided
      if (email) {
        const { error: updateEmailError } = await supabaseAdmin.auth.admin.updateUserById(
          targetUserId,
          { email }
        );
        if (updateEmailError) {
          console.error('Update email error:', updateEmailError);
          throw updateEmailError;
        }
        
        // Also update in profiles
        await supabaseAdmin
          .from('profiles')
          .update({ email })
          .eq('user_id', targetUserId);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Usuario actualizado correctamente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'updatePassword') {
      const { targetUserId, newPassword } = body;
      
      if (!targetUserId || !newPassword) {
        return new Response(
          JSON.stringify({ error: 'ID de usuario y nueva contraseña son requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        { password: newPassword }
      );

      if (updateError) {
        console.error('Update password error:', updateError);
        throw updateError;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Contraseña actualizada correctamente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'setRoles') {
      const { targetUserId, roles } = body;
      
      if (!targetUserId || !Array.isArray(roles) || roles.length === 0) {
        return new Response(
          JSON.stringify({ error: 'ID de usuario y roles son requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete all existing roles
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', targetUserId);

      // Insert new roles
      for (const role of roles) {
        const { error: insertError } = await supabaseAdmin
          .from('user_roles')
          .insert({ 
            user_id: targetUserId, 
            role
          });
        
        if (insertError) {
          console.error('Insert role error:', insertError);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Roles actualizados correctamente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'updateRole') {
      // Legacy support - now updates all roles at once
      const { targetUserId, newRole } = body;
      
      if (!targetUserId || !newRole) {
        return new Response(
          JSON.stringify({ error: 'Faltan datos requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete existing roles and insert new one
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', targetUserId);

      await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: targetUserId,
          role: newRole
        });

      return new Response(
        JSON.stringify({ success: true, message: 'Rol actualizado correctamente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'deleteUser') {
      const { targetUserId } = body;
      
      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'ID de usuario requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Prevent self-deletion
      if (targetUserId === userId) {
        return new Response(
          JSON.stringify({ error: 'No puedes eliminar tu propia cuenta' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete user from auth (this will cascade to profiles and user_roles)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

      if (deleteError) {
        console.error('Delete user error:', deleteError);
        throw deleteError;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Usuario eliminado correctamente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'bulkCreateUsers') {
      const { users } = body;
      
      if (!Array.isArray(users) || users.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Lista de usuarios requerida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Bulk creating', users.length, 'users');
      const results: { email: string; success: boolean; error?: string }[] = [];

      for (const user of users) {
        const { email, password, fullName, roles } = user;
        
        if (!email || !password) {
          results.push({ email: email || 'unknown', success: false, error: 'Email y contraseña requeridos' });
          continue;
        }

        const userRoles = Array.isArray(roles) ? roles : (roles ? [roles] : ['inactivo']);

        try {
          // Create user with admin API
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              full_name: fullName || ''
            }
          });

          if (createError) {
            console.error('Create user error for', email, ':', createError);
            results.push({ 
              email, 
              success: false, 
              error: createError.message.includes('already been registered') 
                ? 'Correo ya registrado' 
                : createError.message 
            });
            continue;
          }

          if (newUser.user) {
            // Wait a bit for the trigger to complete
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Delete the default role created by trigger
            await supabaseAdmin
              .from('user_roles')
              .delete()
              .eq('user_id', newUser.user.id);

            // Insert all specified roles
            for (const role of userRoles) {
              await supabaseAdmin
                .from('user_roles')
                .insert({ 
                  user_id: newUser.user.id, 
                  role
                });
            }

            // Also update full_name in profile if provided
            if (fullName) {
              await supabaseAdmin
                .from('profiles')
                .update({ full_name: fullName })
                .eq('user_id', newUser.user.id);
            }
          }

          results.push({ email, success: true });
          console.log('Created user:', email);
        } catch (err) {
          console.error('Error creating user', email, ':', err);
          results.push({ email, success: false, error: err instanceof Error ? err.message : 'Error desconocido' });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Creados ${successCount} usuarios. ${failCount > 0 ? `${failCount} fallaron.` : ''}`,
          results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Acción no válida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});