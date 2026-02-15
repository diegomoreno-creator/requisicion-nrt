import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import AdminStatistics from "@/components/AdminStatistics";

const Estadisticas = () => {
  const { user, loading, hasPermission, canAccessApp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !canAccessApp)) {
      navigate("/");
    }
    if (!loading && user && !hasPermission('ver_estadisticas')) {
      navigate("/dashboard");
    }
  }, [loading, user, canAccessApp, navigate]);

  if (loading) {
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
        <AdminStatistics />
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
