import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export type AppRole = 'superadmin' | 'admin' | 'comprador' | 'solicitador' | 'inactivo';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    loading: true,
  });
  const navigate = useNavigate();

  const fetchUserRole = async (userId: string): Promise<AppRole | null> => {
    try {
      const { data, error } = await supabase.rpc('get_user_role', { _user_id: userId });
      if (error) {
        console.error('Error fetching role:', error);
        return null;
      }
      return data as AppRole;
    } catch (err) {
      console.error('Error in fetchUserRole:', err);
      return null;
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
            const role = await fetchUserRole(session.user.id);
            setAuthState(prev => ({
              ...prev,
              role,
              loading: false,
            }));
          }, 0);
        } else {
          setAuthState(prev => ({
            ...prev,
            role: null,
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
        const role = await fetchUserRole(session.user.id);
        setAuthState(prev => ({
          ...prev,
          role,
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

  const isSuperadmin = authState.role === 'superadmin';
  const isAdmin = authState.role === 'admin' || isSuperadmin;
  const isComprador = authState.role === 'comprador';
  const isSolicitador = authState.role === 'solicitador';
  const isInactivo = authState.role === 'inactivo';
  const canAccessApp = authState.role && authState.role !== 'inactivo';

  return {
    ...authState,
    signOut,
    isSuperadmin,
    isAdmin,
    isComprador,
    isSolicitador,
    isInactivo,
    canAccessApp,
    fetchUserRole,
  };
};
