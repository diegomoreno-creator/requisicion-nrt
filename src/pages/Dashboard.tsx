import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SuperadminSidebar } from "@/components/SuperadminSidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  FilePlus, 
  RefreshCw, 
  FileText, 
  FolderSearch,
  LogOut,
  Loader2,
  User,
  HelpCircle,
  Calculator
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Administrador",
  comprador: "Comprador",
  presupuestos: "Presupuestos",
  tesoreria: "Tesorería",
  solicitador: "Solicitador",
  autorizador: "Autorizador",
  inactivo: "Inactivo",
  contabilidad_gastos: "Contabilidad Gastos",
  contabilidad_ingresos: "Contabilidad Ingresos",
};

interface ProfileData {
  full_name: string | null;
  avatar_url: string | null;
}

const Dashboard = () => {
  const { user, role, loading, signOut, isSuperadmin, isSolicitador, isAdmin, canAccessApp, hasRole } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [pendingSugerencias, setPendingSugerencias] = useState(0);
  const [showReposicionAlert, setShowReposicionAlert] = useState(false);

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

  // Fetch pending suggestions count for superadmin
  useEffect(() => {
    const fetchPendingSugerencias = async () => {
      if (!isSuperadmin) return;
      
      const { count } = await supabase
        .from("sugerencias" as any)
        .select("*", { count: "exact", head: true })
        .eq("estado", "pendiente");
      
      setPendingSugerencias(count || 0);
    };

    fetchPendingSugerencias();
  }, [isSuperadmin]);

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

  // Check if user has contabilidad_gastos role
  const hasContabilidadGastos = hasRole('contabilidad_gastos') || isSuperadmin;

  const menuItems = [
    {
      title: "Requisición",
      description: "Gestiona tus requisiciones.",
      icon: FilePlus,
      path: "/requisicion",
      visible: canCreateRequisitions,
      blocked: false,
    },
    {
      title: "Reposición",
      description: "Solicita la reposición de tus gastos.",
      icon: RefreshCw,
      path: "/reposicion",
      visible: canCreateRequisitions,
      blocked: true, // Temporarily blocked
    },
    {
      title: "Pago Sin Orden De Compra",
      description: "Realiza pagos que no requieren orden de compra.",
      icon: FileText,
      path: "/pago-sin-oc",
      visible: canCreateRequisitions,
      blocked: false,
    },
    {
      title: "Ver Trámites",
      description: "Consulta el estado de todos tus trámites.",
      icon: FolderSearch,
      path: "/tramites",
      visible: true,
      blocked: false,
    },
    {
      title: "Contabilidad Gastos",
      description: "Registra gastos para el módulo de contabilidad.",
      icon: Calculator,
      path: "/contabilidad-gastos",
      visible: hasContabilidadGastos,
      blocked: false,
    },
  ];

  const handleCardClick = (item: typeof menuItems[0]) => {
    if (item.blocked) {
      setShowReposicionAlert(true);
    } else {
      navigate(item.path);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !canAccessApp) return null;

  const dashboardContent = (
    <div className="min-h-screen bg-background flex flex-col w-full">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 font-barlow">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-xl">
              <span className="text-primary">NRT</span> <span className="text-foreground text-[0.75em]">MÉXICO</span>
            </span>
            <span className="text-foreground font-black text-lg">Panel de Control</span>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
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
                <DropdownMenuItem onClick={() => navigate("/ayuda")} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Ayuda
                  </div>
                  {isSuperadmin && pendingSugerencias > 0 && (
                    <Badge className="ml-2 bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 min-w-[20px] text-center">
                      {pendingSugerencias}
                    </Badge>
                  )}
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 pb-24">
        <h1 className="text-3xl font-bold text-foreground mb-8">
          Bienvenido, <span className="text-primary">{getUserName()}</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menuItems.filter(item => item.visible).map((item) => (
            <Card
              key={item.title}
              className={`border-border bg-card transition-colors cursor-pointer group ${
                item.blocked 
                  ? "opacity-60 hover:border-destructive/50" 
                  : "hover:border-primary/50"
              }`}
              onClick={() => handleCardClick(item)}
            >
              <CardContent className="p-6 flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className={`text-lg font-semibold transition-colors ${
                    item.blocked 
                      ? "text-muted-foreground" 
                      : "text-foreground group-hover:text-primary"
                  }`}>
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {item.description}
                  </p>
                </div>
                <div className={item.blocked ? "text-muted-foreground" : "text-primary"}>
                  <item.icon className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Alert Dialog for blocked Reposición */}
        <AlertDialog open={showReposicionAlert} onOpenChange={setShowReposicionAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Aviso Importante</AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                Este día 28 y 29 de enero de 2025 favor de realizar trámite de manera convencional.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction>Entendido</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 bg-background font-barlow mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-muted-foreground text-sm">
            Desarrollado por{" "}
            <span className="text-foreground font-black">Hub de Innovación</span> de{" "}
            <span className="text-primary font-black">NRT</span>{" "}
            <span className="text-foreground font-black">MÉXICO</span>
          </p>
        </div>
      </footer>
    </div>
  );

  // Wrap with sidebar for superadmin only
  if (isSuperadmin) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <SuperadminSidebar />
          {dashboardContent}
        </div>
      </SidebarProvider>
    );
  }

  return dashboardContent;
};

export default Dashboard;
