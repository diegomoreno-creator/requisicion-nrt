import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  FilePlus, 
  RefreshCw, 
  FileText, 
  FolderSearch,
  Users,
  Settings,
  LogOut,
  Loader2,
  User
} from "lucide-react";
import { toast } from "sonner";
import nrtLogo from "@/assets/nrt-logo.png";

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Administrador",
  comprador: "Comprador",
  presupuestos: "Presupuestos",
  tesoreria: "Tesorería",
  solicitador: "Solicitador",
  autorizador: "Autorizador",
  inactivo: "Inactivo",
};

interface ProfileData {
  full_name: string | null;
  avatar_url: string | null;
}

const Dashboard = () => {
  const { user, role, loading, signOut, isSuperadmin, isSolicitador, isAdmin, canAccessApp } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Enable realtime notifications for status changes
  useRealtimeNotifications();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .single();
      
      if (data) setProfile(data);
    };

    fetchProfile();
  }, [user]);

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

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.charAt(0).toUpperCase() || "U";
  };

  const getUserName = () => {
    return profile?.full_name || user?.email?.split("@")[0] || "Usuario";
  };

  // Only solicitador, admin, and superadmin can create requisitions
  const canCreateRequisitions = isSolicitador || isAdmin || isSuperadmin;

  const menuItems = [
    {
      title: "Requisición",
      description: "Gestiona tus requisiciones.",
      icon: FilePlus,
      path: "/requisicion",
      visible: canCreateRequisitions,
    },
    {
      title: "Reposición",
      description: "Solicita la reposición de tus gastos.",
      icon: RefreshCw,
      path: "/reposicion",
      visible: canCreateRequisitions,
    },
    {
      title: "Pago Sin Orden De Compra",
      description: "Realiza pagos que no requieren orden de compra.",
      icon: FileText,
      path: "/pago-sin-oc",
      visible: canCreateRequisitions,
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
    {
      title: "Gestión de Catálogos",
      description: "Administra tipos, empresas, sucursales y más.",
      icon: Settings,
      path: "/gestion-catalogos",
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
      <header className="border-b border-border px-6 py-4 font-barlow">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={nrtLogo} alt="NRT México" className="h-10 w-auto" />
            <span className="text-foreground font-black text-lg">Panel de Control</span>
          </div>

          <div className="flex items-center gap-4">
            {role && (
              <Badge variant="outline" className="border-primary text-primary">
                {roleLabels[role]}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-secondary text-foreground text-sm">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/perfil")}>
                  <User className="w-4 h-4 mr-2" />
                  Mi Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
      <footer className="fixed bottom-0 left-0 right-0 border-t border-border py-4 bg-background font-barlow">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-muted-foreground text-sm">
            Desarrollado por{" "}
            <span className="text-foreground font-black">Hub de Innovación</span> de{" "}
            <span className="text-primary font-black">NRT</span>{" "}
            <span className="text-foreground font-black">México</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
