import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AppRole = "superadmin" | "admin" | "autorizador" | "comprador" | "presupuestos" | "tesoreria" | "solicitador" | "inactivo";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "autorizador", label: "Autorizadores" },
  { value: "comprador", label: "Compradores" },
  { value: "presupuestos", label: "Presupuestos" },
  { value: "tesoreria", label: "Tesorería" },
  { value: "solicitador", label: "Solicitadores" },
  { value: "admin", label: "Administradores" },
  { value: "superadmin", label: "Superadministradores" },
];

interface RoleStats {
  usersWithRole: number;
  usersWithPush: number;
}

export const RoleNotificationPanel = () => {
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [roleStats, setRoleStats] = useState<RoleStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Fetch stats when role changes
  useEffect(() => {
    if (!selectedRole) {
      setRoleStats(null);
      return;
    }

    const fetchRoleStats = async () => {
      setLoadingStats(true);
      try {
        // Get users with the selected role
        const { data: usersWithRole, error: roleError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", selectedRole);

        if (roleError) throw roleError;

        const userIds = usersWithRole?.map(u => u.user_id) || [];

        if (userIds.length === 0) {
          setRoleStats({ usersWithRole: 0, usersWithPush: 0 });
          return;
        }

        // Get push subscriptions for these users
        const { data: subscriptions, error: subError } = await supabase
          .from("push_subscriptions")
          .select("user_id")
          .in("user_id", userIds);

        if (subError) throw subError;

        const uniqueUsersWithPush = new Set(subscriptions?.map(s => s.user_id) || []);

        setRoleStats({
          usersWithRole: userIds.length,
          usersWithPush: uniqueUsersWithPush.size,
        });
      } catch (error) {
        console.error("Error fetching role stats:", error);
        setRoleStats(null);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchRoleStats();
  }, [selectedRole]);

  const handleSend = async () => {
    if (!selectedRole || !title.trim() || !message.trim()) {
      toast.error("Selecciona un rol y completa título y mensaje");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-role-notification", {
        body: { role: selectedRole, title: title.trim(), message: message.trim() },
      });

      if (error) throw error;

      if (data?.success || data?.oneSignalId) {
        const roleName = ROLE_OPTIONS.find(r => r.value === selectedRole)?.label || selectedRole;
        toast.success(
          `Notificación enviada a ${data.subscriptionsFound || 0} ${roleName}`,
          { description: `${data.usersWithRole || 0} usuarios con rol, ${data.subscriptionsFound || 0} con push activo` }
        );
        setTitle("");
        setMessage("");
        setSelectedRole("");
      } else {
        toast.error(data?.error || "Error al enviar notificación");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      toast.error(`Error: ${msg}`);
    } finally {
      setSending(false);
    }
  };

  const selectedRoleLabel = ROLE_OPTIONS.find(r => r.value === selectedRole)?.label;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Notificación por Rol
        </CardTitle>
        <CardDescription>
          Envía una notificación a todos los usuarios con un rol específico
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="role-select">Rol</Label>
          <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as AppRole)}>
            <SelectTrigger id="role-select">
              <SelectValue placeholder="Selecciona un rol..." />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Stats badges */}
          {selectedRole && (
            <div className="flex items-center gap-2 mt-2">
              {loadingStats ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : roleStats ? (
                <>
                  <Badge variant="secondary">
                    {roleStats.usersWithRole} usuario{roleStats.usersWithRole !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant={roleStats.usersWithPush > 0 ? "default" : "destructive"}>
                    {roleStats.usersWithPush} con push
                  </Badge>
                </>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="role-title">Título</Label>
          <Input
            id="role-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título de la notificación..."
            disabled={sending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role-message">Mensaje</Label>
          <Textarea
            id="role-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Contenido del mensaje..."
            rows={3}
            disabled={sending}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={sending || !selectedRole || !title.trim() || !message.trim() || (roleStats?.usersWithPush === 0)}
          className="w-full"
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Enviar a {selectedRoleLabel || "rol seleccionado"}
            </>
          )}
        </Button>

        {roleStats?.usersWithPush === 0 && selectedRole && (
          <p className="text-sm text-destructive text-center">
            No hay usuarios con push activo en este rol
          </p>
        )}
      </CardContent>
    </Card>
  );
};
