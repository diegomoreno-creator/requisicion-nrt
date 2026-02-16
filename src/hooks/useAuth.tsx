import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export type AppRole = 'superadmin' | 'admin' | 'comprador' | 'solicitador' | 'autorizador' | 'presupuestos' | 'tesoreria' | 'inactivo' | 'contabilidad1' | 'contabilidad_gastos' | 'contabilidad_ingresos' | 'revision';

export type AppPermission = 
  | 'ver_estadisticas'
  | 'gestionar_usuarios'
  | 'gestionar_catalogos'
  | 'gestionar_notificaciones'
  | 'ver_todos_tramites'
  | 'editar_cualquier_tramite'
  | 'eliminar_tramites';

export const PERMISSION_LABELS: Record<AppPermission, string> = {
  ver_estadisticas: 'Ver Estadísticas',
  gestionar_usuarios: 'Gestión de Usuarios',
  gestionar_catalogos: 'Gestión de Catálogos',
  gestionar_notificaciones: 'Gestión de Notificaciones',
  ver_todos_tramites: 'Ver Todos los Trámites',
  editar_cualquier_tramite: 'Editar Cualquier Trámite',
  eliminar_tramites: 'Eliminar Trámites',
};

export const PERMISSION_DESCRIPTIONS: Record<AppPermission, string> = {
  ver_estadisticas: 'Acceso al panel de estadísticas y métricas',
  gestionar_usuarios: 'Crear, editar y eliminar usuarios del sistema',
  gestionar_catalogos: 'Administrar catálogos de empresas, sucursales, etc.',
  gestionar_notificaciones: 'Enviar y programar notificaciones',
  ver_todos_tramites: 'Visualizar trámites de todos los usuarios',
  editar_cualquier_tramite: 'Modificar trámites de cualquier usuario',
  eliminar_tramites: 'Eliminar trámites permanentemente',
};

// Admin base permissions (always active for admin role)
export const ADMIN_BASE_PERMISSIONS: AppPermission[] = [
  'ver_estadisticas',
  'ver_todos_tramites',
];

export const ALL_PERMISSIONS: AppPermission[] = [
  'ver_estadisticas',
  'gestionar_usuarios',
  'gestionar_catalogos',
  'gestionar_notificaciones',
  'ver_todos_tramites',
  'editar_cualquier_tramite',
  'eliminar_tramites',
];

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  permissions: AppPermission[];
  loading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    roles: [],
    permissions: [],
    loading: true,
  });
  const navigate = useNavigate();

  const fetchUserRoles = async (userId: string): Promise<AppRole[]> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching roles:', error);
        return [];
      }
      
      return (data?.map(r => r.role as AppRole)) || [];
    } catch (err) {
      console.error('Error in fetchUserRoles:', err);
      return [];
    }
  };

  const fetchUserPermissions = async (userId: string): Promise<AppPermission[]> => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching permissions:', error);
        return [];
      }
      
      return (data?.map(p => p.permission as AppPermission)) || [];
    } catch (err) {
      console.error('Error in fetchUserPermissions:', err);
      return [];
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setAuthState(prev => ({
          ...prev,
          user: session?.user ?? null,
          session: session,
        }));

        if (session?.user) {
          setTimeout(async () => {
            const [roles, permissions] = await Promise.all([
              fetchUserRoles(session.user.id),
              fetchUserPermissions(session.user.id),
            ]);
            setAuthState(prev => ({
              ...prev,
              roles,
              permissions,
              loading: false,
            }));
          }, 0);
        } else {
          setAuthState(prev => ({
            ...prev,
            roles: [],
            permissions: [],
            loading: false,
          }));
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setAuthState(prev => ({
        ...prev,
        user: session?.user ?? null,
        session: session,
      }));

      if (session?.user) {
        const [roles, permissions] = await Promise.all([
          fetchUserRoles(session.user.id),
          fetchUserPermissions(session.user.id),
        ]);
        setAuthState(prev => ({
          ...prev,
          roles,
          permissions,
          loading: false,
        }));
      } else {
        setAuthState(prev => ({
          ...prev,
          loading: false,
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Helper functions for role checks
  const hasRole = (role: AppRole) => authState.roles.includes(role);
  
  const isSuperadmin = hasRole('superadmin');
  const isAdmin = hasRole('admin') || isSuperadmin;
  const isComprador = hasRole('comprador');
  const isSolicitador = hasRole('solicitador');
  const isAutorizador = hasRole('autorizador');
  const isPresupuestos = hasRole('presupuestos');
  const isTesoreria = hasRole('tesoreria');
  const isRevision = hasRole('revision');
  const isInactivo = authState.roles.length === 0 || (authState.roles.length === 1 && hasRole('inactivo'));
  const canAccessApp = authState.roles.length > 0 && !isInactivo;

  // Permission check: superadmin has all, admin has base + extras, others check DB
  const hasPermission = (permission: AppPermission): boolean => {
    if (isSuperadmin) return true;
    if (hasRole('admin') && ADMIN_BASE_PERMISSIONS.includes(permission)) return true;
    return authState.permissions.includes(permission);
  };

  // Legacy compatibility - return first role
  const role = authState.roles.length > 0 ? authState.roles[0] : null;

  return {
    ...authState,
    role, // Legacy single role
    signOut,
    hasRole,
    hasPermission,
    isSuperadmin,
    isAdmin,
    isComprador,
    isSolicitador,
    isAutorizador,
    isPresupuestos,
    isTesoreria,
    isRevision,
    isInactivo,
    canAccessApp,
    fetchUserRoles,
  };
};