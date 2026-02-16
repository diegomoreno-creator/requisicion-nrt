import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import AdminStatistics from "@/components/AdminStatistics";
import { supabase } from "@/integrations/supabase/client";

const Estadisticas = () => {
  const { user, loading, hasPermission, canAccessApp, isSuperadmin } = useAuth();
  const navigate = useNavigate();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaNombre, setEmpresaNombre] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !canAccessApp)) {
      navigate("/");
    }
    if (!loading && user && !hasPermission('ver_estadisticas')) {
      navigate("/dashboard");
    }
  }, [loading, user, canAccessApp, navigate]);

  // Fetch the user's empresa for non-superadmin scoping
  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!user || isSuperadmin) {
        setProfileLoading(false);
        return;
      }
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("empresa_id")
          .eq("user_id", user.id)
          .single();
        
        if (profile?.empresa_id) {
          setEmpresaId(profile.empresa_id);
          // Fetch empresa name
          const { data: empresa } = await supabase
            .from("catalogo_empresas")
            .select("nombre")
            .eq("id", profile.empresa_id)
            .single();
          if (empresa) setEmpresaNombre(empresa.nombre);
        }
      } catch (err) {
        console.error("Error fetching empresa:", err);
      } finally {
        setProfileLoading(false);
      }
    };
    if (!loading && user) fetchEmpresa();
  }, [loading, user, isSuperadmin]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !canAccessApp || !hasPermission('ver_estadisticas')) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 font-barlow">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="mr-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-black text-xl">
              <span className="text-primary">NRT</span>{" "}
              <span className="text-foreground text-[0.75em]">MÉXICO</span>
            </span>
            <span className="text-foreground font-black text-lg">
              Estadísticas
            </span>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 pb-24">
        <AdminStatistics 
          empresaId={isSuperadmin ? null : empresaId} 
          empresaNombre={isSuperadmin ? null : empresaNombre} 
        />
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-border py-4 bg-background font-barlow">
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
};

export default Estadisticas;
