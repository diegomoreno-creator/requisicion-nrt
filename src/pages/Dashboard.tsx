import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Rocket, 
  FilePlus, 
  RefreshCw, 
  FileText, 
  FolderSearch,
  Users,
  LogOut,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Administrador",
  comprador: "Comprador",
  solicitador: "Solicitador",
  inactivo: "Inactivo",
};

const Dashboard = () => {
  const { user, role, loading, signOut, isSuperadmin, canAccessApp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
    if (!loading && user && !canAccessApp) {
      signOut();
      toast.error("Tu cuenta está inactiva");
    }
  }, [loading, user, canAccessApp, navigate, signOut]);

  const handleLogout = async () => {
    await signOut();
    toast.success("Sesión cerrada");
  };

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const getUserName = () => {
    return user?.email?.split("@")[0] || "Usuario";
  };

  const menuItems = [
    {
      title: "Requisición",
      description: "Gestiona tus requisiciones.",
      icon: FilePlus,
      path: "/requisicion",
      visible: true,
    },
    {
      title: "Reposición",
      description: "Solicita la reposición de tus gastos.",
      icon: RefreshCw,
      path: "/reposicion",
      visible: true,
    },
    {
      title: "Pago Sin Orden De Compra",
      description: "Realiza pagos que no requieren orden de compra.",
      icon: FileText,
      path: "/pago-sin-oc",
      visible: true,
    },
    {
      title: "Ver Trámites",
      description: "Consulta el estado de todos tus trámites.",
      icon: FolderSearch,
      path: "/tramites",
      visible: true,
    },
    {
      title: "Gestión de Usuarios",
      description: "Administra usuarios y roles del sistema.",
      icon: Users,
      path: "/gestion-usuarios",
      visible: isSuperadmin,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !canAccessApp) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Rocket className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-foreground font-medium">Panel de Control</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-primary font-bold tracking-wide">NRT</span>
            <span className="text-foreground font-medium">MÉXICO</span>
          </div>

          <div className="flex items-center gap-4">
            {role && (
              <Badge variant="outline" className="border-primary text-primary">
                {roleLabels[role]}
              </Badge>
            )}
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-border bg-secondary hover:bg-secondary/80"
              onClick={handleLogout}
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4 text-foreground" />
            </Button>
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-secondary text-foreground text-sm">
                {getInitials(user.email || "U")}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 pb-24">
        <h1 className="text-3xl font-bold text-foreground mb-8">
          Bienvenido, <span className="text-primary">{getUserName()}</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menuItems.filter(item => item.visible).map((item) => (
            <Card
              key={item.title}
              className="border-border bg-card hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => navigate(item.path)}
            >
              <CardContent className="p-6 flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {item.description}
                  </p>
                </div>
                <div className="text-primary">
                  <item.icon className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-border py-4 bg-background">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-muted-foreground text-sm">
            Desarrollado por{" "}
            <span className="text-foreground font-medium">Hub de Innovación</span> de{" "}
            <span className="text-primary font-bold">NRT</span>{" "}
            <span className="text-foreground font-medium">México</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
