import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresFormAccess?: boolean;
  requiresSuperadmin?: boolean;
}

const ProtectedRoute = ({ 
  children, 
  requiresFormAccess = false,
  requiresSuperadmin = false 
}: ProtectedRouteProps) => {
  const { user, loading, isSuperadmin, isAdmin, isSolicitador, canAccessApp } = useAuth();
  const navigate = useNavigate();

  const canAccessForms = isSolicitador || isAdmin || isSuperadmin;

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/");
      return;
    }

    if (!canAccessApp) {
      toast.error("Tu cuenta está inactiva");
      navigate("/");
      return;
    }

    if (requiresSuperadmin && !isSuperadmin) {
      toast.error("No tienes permisos para acceder a esta sección");
      navigate("/dashboard");
      return;
    }

    if (requiresFormAccess && !canAccessForms) {
      toast.error("No tienes permisos para crear trámites");
      navigate("/tramites");
      return;
    }
  }, [loading, user, canAccessApp, isSuperadmin, canAccessForms, requiresFormAccess, requiresSuperadmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !canAccessApp) return null;
  if (requiresSuperadmin && !isSuperadmin) return null;
  if (requiresFormAccess && !canAccessForms) return null;

  return <>{children}</>;
};

export default ProtectedRoute;