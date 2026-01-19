import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export type AppRole = 'superadmin' | 'admin' | 'comprador' | 'solicitador' | 'autorizador' | 'inactivo';

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    roles: [],
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
            const roles = await fetchUserRoles(session.user.id);
            setAuthState(prev => ({
              ...prev,
              roles,
              loading: false,
            }));
          }, 0);
        } else {
          setAuthState(prev => ({
            ...prev,
            roles: [],
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
        const roles = await fetchUserRoles(session.user.id);
        setAuthState(prev => ({
          ...prev,
          roles,
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
  const isInactivo = authState.roles.length === 0 || (authState.roles.length === 1 && hasRole('inactivo'));
  const canAccessApp = authState.roles.length > 0 && !isInactivo;

  // Legacy compatibility - return first role
  const role = authState.roles.length > 0 ? authState.roles[0] : null;

  return {
    ...authState,
    role, // Legacy single role
    signOut,
    hasRole,
    isSuperadmin,
    isAdmin,
    isComprador,
    isSolicitador,
    isAutorizador,
    isInactivo,
    canAccessApp,
    fetchUserRoles,
  };
};