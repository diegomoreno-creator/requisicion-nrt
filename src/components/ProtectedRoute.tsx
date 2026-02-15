import { useEffect, useState } from "react";
import { useAuth, AppRole, AppPermission } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import AccessDenied from "@/pages/AccessDenied";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresFormAccess?: boolean;
  requiresSuperadmin?: boolean;
  requiresRole?: AppRole | AppRole[];
  requiresPermission?: AppPermission;
}

const ProtectedRoute = ({ 
  children, 
  requiresFormAccess = false,
  requiresSuperadmin = false,
  requiresRole,
  requiresPermission
}: ProtectedRouteProps) => {
  const { user, loading, isSuperadmin, isAdmin, isSolicitador, canAccessApp, hasRole, hasPermission } = useAuth();
  const [deniedType, setDeniedType] = useState<"unauthenticated" | "unauthorized" | "inactive" | null>(null);

  const canAccessForms = isSolicitador || isAdmin || isSuperadmin;

  const hasRequiredRole = () => {
    if (!requiresRole) return true;
    if (isSuperadmin) return true;
    if (Array.isArray(requiresRole)) {
      return requiresRole.some(role => hasRole(role));
    }
    return hasRole(requiresRole);
  };

  useEffect(() => {
    if (loading) { setDeniedType(null); return; }
    if (!user) { setDeniedType("unauthenticated"); return; }
    if (!canAccessApp) { setDeniedType("inactive"); return; }
    if (requiresSuperadmin && !isSuperadmin) { setDeniedType("unauthorized"); return; }
    if (requiresFormAccess && !canAccessForms) { setDeniedType("unauthorized"); return; }
    if (requiresRole && !hasRequiredRole()) { setDeniedType("unauthorized"); return; }
    if (requiresPermission && !hasPermission(requiresPermission)) { setDeniedType("unauthorized"); return; }
    setDeniedType(null);
  }, [loading, user, canAccessApp, isSuperadmin, canAccessForms, requiresFormAccess, requiresSuperadmin, requiresRole, requiresPermission]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (deniedType) {
    return <AccessDenied type={deniedType} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;