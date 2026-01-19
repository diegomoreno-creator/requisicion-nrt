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

    // Check if user is superadmin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleError || roleData?.role !== 'superadmin') {
      console.log('User is not superadmin:', userId, roleData?.role);
      return new Response(
        JSON.stringify({ error: 'Acceso denegado. Solo superadmin puede gestionar usuarios.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, targetUserId, newRole } = await req.json();
    console.log('Action:', action, 'Target:', targetUserId, 'New Role:', newRole);

    if (action === 'list') {
      // Get all users with their roles
      const { data: users, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select(`
          id,
          user_id,
          email,
          full_name,
          created_at
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

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      
      const usersWithRoles = users?.map(u => ({
        ...u,
        role: rolesMap.get(u.user_id) || 'inactivo'
      })) || [];

      return new Response(
        JSON.stringify({ users: usersWithRoles }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'updateRole') {
      if (!targetUserId || !newRole) {
        return new Response(
          JSON.stringify({ error: 'Faltan datos requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update or insert role
      const { error: upsertError } = await supabaseAdmin
        .from('user_roles')
        .upsert({
          user_id: targetUserId,
          role: newRole,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        console.error('Upsert error:', upsertError);
        throw upsertError;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Rol actualizado correctamente' }),
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
