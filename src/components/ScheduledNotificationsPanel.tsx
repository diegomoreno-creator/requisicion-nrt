import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Clock, 
  Loader2, 
  CalendarIcon, 
  Users, 
  User, 
  Megaphone,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type NotificationType = "broadcast" | "role" | "personal";
type AppRole = "superadmin" | "admin" | "autorizador" | "comprador" | "presupuestos" | "tesoreria" | "solicitador";

interface ScheduledNotification {
  id: string;
  title: string;
  message: string;
  scheduled_at: string;
  notification_type: NotificationType;
  target_role: string | null;
  target_user_id: string | null;
  status: "pending" | "sent" | "failed" | "cancelled";
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
  recipients_count: number | null;
}

interface UserOption {
  user_id: string;
  email: string;
  full_name: string | null;
}

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "autorizador", label: "Autorizadores" },
  { value: "comprador", label: "Compradores" },
  { value: "presupuestos", label: "Presupuestos" },
  { value: "tesoreria", label: "Tesorería" },
  { value: "solicitador", label: "Solicitadores" },
  { value: "admin", label: "Administradores" },
  { value: "superadmin", label: "Superadministradores" },
];

const STATUS_CONFIG = {
  pending: { icon: Clock, label: "Pendiente", variant: "secondary" as const },
  sent: { icon: CheckCircle2, label: "Enviada", variant: "default" as const },
  failed: { icon: XCircle, label: "Fallida", variant: "destructive" as const },
  cancelled: { icon: AlertCircle, label: "Cancelada", variant: "outline" as const },
};

export const ScheduledNotificationsPanel = () => {
  const { user } = useAuth();
  const [notificationType, setNotificationType] = useState<NotificationType>("broadcast");
  const [targetRole, setTargetRole] = useState<AppRole | "">("");
  const [targetUserId, setTargetUserId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  
  const [scheduledList, setScheduledList] = useState<ScheduledNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);

  const fetchScheduled = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("scheduled_notifications")
        .select("*")
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      setScheduledList((data as ScheduledNotification[]) || []);
    } catch (error) {
      console.error("Error fetching scheduled:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .order("full_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    fetchScheduled();
    fetchUsers();
  }, []);

  const handleSchedule = async () => {
    if (!title.trim() || !message.trim() || !scheduledDate || !user?.id) {
      toast.error("Completa todos los campos requeridos");
      return;
    }

    if (notificationType === "role" && !targetRole) {
      toast.error("Selecciona un rol");
      return;
    }

    if (notificationType === "personal" && !targetUserId) {
      toast.error("Selecciona un usuario");
      return;
    }

    const [hours, minutes] = scheduledTime.split(":").map(Number);
    const scheduledAt = new Date(scheduledDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    if (scheduledAt <= new Date()) {
      toast.error("La fecha programada debe ser en el futuro");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("scheduled_notifications").insert({
        title: title.trim(),
        message: message.trim(),
        scheduled_at: scheduledAt.toISOString(),
        notification_type: notificationType,
        target_role: notificationType === "role" ? targetRole : null,
        target_user_id: notificationType === "personal" ? targetUserId : null,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Notificación programada correctamente", {
        description: `Se enviará el ${format(scheduledAt, "PPp", { locale: es })}`,
      });

      setTitle("");
      setMessage("");
      setScheduledDate(undefined);
      setScheduledTime("09:00");
      setTargetRole("");
      setTargetUserId("");
      
      fetchScheduled();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      toast.error(`Error: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const { error } = await supabase
        .from("scheduled_notifications")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Notificación cancelada");
      fetchScheduled();
    } catch (error) {
      toast.error("Error al cancelar");
    }
  };

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case "broadcast": return <Megaphone className="w-4 h-4" />;
      case "role": return <Users className="w-4 h-4" />;
      case "personal": return <User className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (notification: ScheduledNotification) => {
    switch (notification.notification_type) {
      case "broadcast": return "Todos";
      case "role": return ROLE_OPTIONS.find(r => r.value === notification.target_role)?.label || notification.target_role;
      case "personal": {
        const targetUser = users.find(u => u.user_id === notification.target_user_id);
        return targetUser?.full_name || targetUser?.email || "Usuario";
      }
    }
  };

  const pendingCount = scheduledList.filter(n => n.status === "pending").length;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Notificaciones Programadas
          {pendingCount > 0 && (
            <Badge variant="secondary">{pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Programa notificaciones para enviar en una fecha y hora específica
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Nueva notificación programada</h4>
            
            <div className="space-y-2">
              <Label>Tipo de notificación</Label>
              <Select value={notificationType} onValueChange={(v) => setNotificationType(v as NotificationType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="broadcast">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4" /> Todos los usuarios
                    </div>
                  </SelectItem>
                  <SelectItem value="role">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" /> Por rol
                    </div>
                  </SelectItem>
                  <SelectItem value="personal">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" /> Usuario específico
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {notificationType === "role" && (
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={targetRole} onValueChange={(v) => setTargetRole(v as AppRole)}>
                  <SelectTrigger>
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
              </div>
            )}

            {notificationType === "personal" && (
              <div className="space-y-2">
                <Label>Usuario</Label>
                <Select value={targetUserId} onValueChange={setTargetUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un usuario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !scheduledDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, "PP", { locale: es }) : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título de la notificación..."
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>Mensaje</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Contenido del mensaje..."
                rows={3}
                disabled={saving}
              />
            </div>

            <Button
              onClick={handleSchedule}
              disabled={saving || !title.trim() || !message.trim() || !scheduledDate}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Programar notificación
                </>
              )}
            </Button>
          </div>

          {/* List */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Notificaciones programadas</h4>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : scheduledList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay notificaciones programadas
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {scheduledList.map((notification) => {
                    const statusConfig = STATUS_CONFIG[notification.status];
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <div
                        key={notification.id}
                        className="p-3 rounded-lg border bg-card space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {getTypeIcon(notification.notification_type)}
                            <span className="font-medium truncate">{notification.title}</span>
                          </div>
                          <Badge variant={statusConfig.variant} className="shrink-0">
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>→ {getTypeLabel(notification)}</span>
                            <Separator orientation="vertical" className="h-3" />
                            <span>
                              {format(new Date(notification.scheduled_at), "PPp", { locale: es })}
                            </span>
                          </div>
                          
                          {notification.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-destructive hover:text-destructive"
                              onClick={() => handleCancel(notification.id)}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Cancelar
                            </Button>
                          )}
                          
                          {notification.status === "sent" && notification.recipients_count !== null && (
                            <span className="text-primary">
                              {notification.recipients_count} enviada{notification.recipients_count !== 1 ? "s" : ""}
                            </span>
                          )}
                          
                          {notification.status === "failed" && notification.error_message && (
                            <span className="text-destructive truncate max-w-[150px]" title={notification.error_message}>
                              {notification.error_message}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
