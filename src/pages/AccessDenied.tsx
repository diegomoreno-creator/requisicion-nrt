import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldX, LogIn, ArrowLeft } from "lucide-react";

interface AccessDeniedProps {
  type?: "unauthenticated" | "unauthorized" | "inactive";
}

const AccessDenied = ({ type = "unauthenticated" }: AccessDeniedProps) => {
  const navigate = useNavigate();

  const content = {
    unauthenticated: {
      icon: <LogIn className="w-16 h-16 text-primary" />,
      title: "Sesión Requerida",
      description: "Necesitas iniciar sesión para acceder a esta página.",
      primaryAction: { label: "Iniciar Sesión", path: "/" },
      secondaryAction: null,
    },
    unauthorized: {
      icon: <ShieldX className="w-16 h-16 text-destructive" />,
      title: "Acceso Denegado",
      description: "No tienes los permisos necesarios para acceder a esta sección.",
      primaryAction: { label: "Ir al Panel", path: "/dashboard" },
      secondaryAction: { label: "Volver", action: () => navigate(-1) },
    },
    inactive: {
      icon: <ShieldX className="w-16 h-16 text-yellow-500" />,
      title: "Cuenta Inactiva",
      description: "Tu cuenta está pendiente de activación. Contacta al administrador para obtener acceso.",
      primaryAction: { label: "Ir al Inicio", path: "/" },
      secondaryAction: null,
    },
  };

  const { icon, title, description, primaryAction, secondaryAction } = content[type];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="flex flex-col items-center text-center space-y-6">
            {icon}
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-muted-foreground">{description}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {secondaryAction && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={secondaryAction.action}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {secondaryAction.label}
                </Button>
              )}
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={() => navigate(primaryAction.path)}
              >
                {primaryAction.label}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessDenied;
