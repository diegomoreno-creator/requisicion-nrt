import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Send, Loader2, Search, User, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

interface UserOption {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  has_push: boolean;
}

export const PersonalNotificationPanel = () => {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email");

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const { data: pushSubs, error: pushError } = await supabase
        .from("push_subscriptions")
        .select("user_id");

      if (pushError) throw pushError;

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      const pushSet = new Set(pushSubs?.map(p => p.user_id) || []);

      const combinedUsers: UserOption[] = (profiles || []).map(profile => ({
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        role: rolesMap.get(profile.user_id) || "sin rol",
        has_push: pushSet.has(profile.user_id),
      }));

      // Sort: users with push first, then alphabetically
      combinedUsers.sort((a, b) => {
        if (a.has_push && !b.has_push) return -1;
        if (!a.has_push && b.has_push) return 1;
        return (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "");
      });

      setUsers(combinedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSend = async () => {
    if (!selectedUser) {
      toast.error("Selecciona un usuario");
      return;
    }
    if (!title.trim() || !message.trim()) {
      toast.error("Completa el título y el mensaje");
      return;
    }

    const targetUser = users.find(u => u.user_id === selectedUser);
    if (!targetUser?.has_push) {
      toast.error("Este usuario no tiene notificaciones push activas");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-personal-notification", {
        body: {
          user_id: selectedUser,
          title: title.trim(),
          message: message.trim(),
        },
      });

      if (error) throw error;

      // Check for success - either explicit success flag or presence of oneSignalId
      if (data?.success || data?.oneSignalId) {
        toast.success(`Notificación enviada a ${targetUser.full_name || targetUser.email}`);
        setTitle("");
        setMessage("");
        setSelectedUser("");
      } else {
        // Show detailed error reason
        let errorReason = data?.error || "No se pudo entregar la notificación";
        
        // Map common OneSignal errors to user-friendly messages
        if (data?.errors?.includes("All included players are not subscribed")) {
          errorReason = "La suscripción del usuario está obsoleta. El usuario debe reactivar las notificaciones desde su perfil.";
        }
        
        toast.error(errorReason, {
          duration: 6000,
          description: data?.recipients === 0 ? "0 destinatarios alcanzados" : undefined,
        });
      }
    } catch (error: any) {
      console.error("Error sending personal notification:", error);
      toast.error(error.message || "Error al enviar la notificación");
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.full_name?.toLowerCase().includes(searchLower) || false) ||
      (user.email?.toLowerCase().includes(searchLower) || false)
    );
  });

  const selectedUserData = users.find(u => u.user_id === selectedUser);

  const roleLabels: Record<string, string> = {
    superadmin: "Super Admin",
    admin: "Administrador",
    autorizador: "Autorizador",
    comprador: "Comprador",
    presupuestos: "Presupuestos",
    tesoreria: "Tesorería",
    solicitador: "Solicitador",
    inactivo: "Inactivo",
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Notificación Personal</CardTitle>
        </div>
        <CardDescription>
          Envía una notificación push directa a un usuario específico
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Selection */}
        <div className="space-y-2">
          <Label>Seleccionar Usuario</Label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="Buscar y seleccionar usuario..." />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <ScrollArea className="h-[200px]">
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    No se encontraron usuarios
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <SelectItem 
                      key={user.user_id} 
                      value={user.user_id}
                      disabled={!user.has_push}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {user.full_name || "Sin nombre"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {user.email}
                          </span>
                        </div>
                        {user.has_push ? (
                          <Bell className="w-3 h-3 text-green-500 ml-auto" />
                        ) : (
                          <BellOff className="w-3 h-3 text-muted-foreground ml-auto" />
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </ScrollArea>
            </SelectContent>
          </Select>
          
          {/* Selected user info */}
          {selectedUserData && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{selectedUserData.full_name || selectedUserData.email}</span>
              <Badge variant="outline" className="text-xs">
                {roleLabels[selectedUserData.role] || selectedUserData.role}
              </Badge>
              {selectedUserData.has_push ? (
                <Badge className="bg-green-500/20 text-green-500 text-xs ml-auto">
                  <Bell className="w-3 h-3 mr-1" />
                  Push activo
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs ml-auto">
                  <BellOff className="w-3 h-3 mr-1" />
                  Sin push
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="personal-title">Título</Label>
          <Input
            id="personal-title"
            placeholder="Ej: Solicitud de información"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
          />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <Label htmlFor="personal-message">Mensaje</Label>
          <Textarea
            id="personal-message"
            placeholder="Escribe el mensaje personalizado..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground text-right">
            {message.length}/200
          </p>
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={sending || !selectedUser || !title.trim() || !message.trim() || !selectedUserData?.has_push}
          className="w-full"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Enviar Notificación
        </Button>
      </CardContent>
    </Card>
  );
};
