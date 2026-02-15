import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowLeft, Bell, Loader2 } from "lucide-react";
import BroadcastNotification from "@/components/BroadcastNotification";
import { PushSubscriptionsPanel } from "@/components/PushSubscriptionsPanel";
import { PersonalNotificationPanel } from "@/components/PersonalNotificationPanel";
import { RoleNotificationPanel } from "@/components/RoleNotificationPanel";
import { ScheduledNotificationsPanel } from "@/components/ScheduledNotificationsPanel";

const Notificaciones = () => {
  const { user, hasPermission, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !hasPermission('gestionar_notificaciones'))) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !hasPermission('gestionar_notificaciones')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 font-barlow">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-primary" />
              <span className="font-black text-xl text-foreground">Gestión de Notificaciones</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 pb-24 space-y-8">
        {/* Notification Sending Section */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">Enviar Notificaciones</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <BroadcastNotification />
            <PersonalNotificationPanel />
            <RoleNotificationPanel />
          </div>
        </section>

        {/* Scheduled Notifications */}
        <section>
          <ScheduledNotificationsPanel />
        </section>

        {/* Push Subscriptions Management */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">Suscripciones Push</h2>
          <PushSubscriptionsPanel />
        </section>
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

export default Notificaciones;
