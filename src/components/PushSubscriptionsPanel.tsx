import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bell, BellOff, Loader2, Search, Users, RefreshCw, AlertTriangle, Send, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface UserWithPush {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  has_push: boolean;
  push_updated_at: string | null;
}

interface TestResult {
  userId: string;
  success: boolean;
  recipients: number;
  error?: string;
}

export const PushSubscriptionsPanel = () => {
  const [users, setUsers] = useState<UserWithPush[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPush, setFilterPush] = useState<"all" | "active" | "inactive">("all");
  const [userToUnsubscribe, setUserToUnsubscribe] = useState<UserWithPush | null>(null);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [sendingTest, setSendingTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Map<string, TestResult>>(new Map());

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch all users with their roles and push subscription status
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
        .select("user_id, updated_at");

      if (pushError) throw pushError;

      // Create maps for quick lookup
      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      const pushMap = new Map(pushSubs?.map(p => [p.user_id, p.updated_at]) || []);

      // Combine data
      const combinedUsers: UserWithPush[] = (profiles || []).map(profile => ({
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        role: rolesMap.get(profile.user_id) || "sin rol",
        has_push: pushMap.has(profile.user_id),
        push_updated_at: pushMap.get(profile.user_id) || null,
      }));

      // Sort: active push first, then by name
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

  const handleUnsubscribe = async () => {
    if (!userToUnsubscribe) return;

    setUnsubscribing(true);
    try {
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userToUnsubscribe.user_id);

      if (error) throw error;

      toast.success(`Notificaciones push desactivadas para ${userToUnsubscribe.full_name || userToUnsubscribe.email}`);
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.user_id === userToUnsubscribe.user_id 
          ? { ...u, has_push: false, push_updated_at: null }
          : u
      ));
    } catch (error) {
      console.error("Error unsubscribing user:", error);
      toast.error("Error al desactivar notificaciones");
    } finally {
      setUnsubscribing(false);
      setUserToUnsubscribe(null);
    }
  };

  const handleSendTestNotification = async (user: UserWithPush) => {
    setSendingTest(user.user_id);
    // Clear previous result for this user
    setTestResults(prev => {
      const newMap = new Map(prev);
      newMap.delete(user.user_id);
      return newMap;
    });

    try {
      const { data, error } = await supabase.functions.invoke("send-test-notification", {
        body: { user_id: user.user_id },
      });

      if (error) throw error;

      const result: TestResult = {
        userId: user.user_id,
        success: data.success && data.recipients > 0,
        recipients: data.recipients || 0,
        error: data.error || (data.recipients === 0 ? "0 destinatarios - suscripción inválida" : undefined),
      };

      setTestResults(prev => new Map(prev).set(user.user_id, result));

      if (result.success) {
        toast.success(`Notificación enviada a ${user.full_name || user.email} (${result.recipients} destinatario${result.recipients > 1 ? 's' : ''})`);
      } else {
        toast.error(`Error: ${result.error}`);
      }
    } catch (error: any) {
      console.error("Error sending test notification:", error);
      const errorMsg = error?.message || "Error desconocido";
      setTestResults(prev => new Map(prev).set(user.user_id, {
        userId: user.user_id,
        success: false,
        recipients: 0,
        error: errorMsg,
      }));
      toast.error(`Error al enviar notificación: ${errorMsg}`);
    } finally {
      setSendingTest(null);
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (user.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesFilter = 
      filterPush === "all" ||
      (filterPush === "active" && user.has_push) ||
      (filterPush === "inactive" && !user.has_push);

    return matchesSearch && matchesFilter;
  });

  const activeCount = users.filter(u => u.has_push).length;
  const inactiveCount = users.filter(u => !u.has_push).length;

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <CardTitle>Gestión de Notificaciones Push</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
        <CardDescription>
          Visualiza y gestiona las suscripciones de notificaciones push de los usuarios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Users className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-xs text-muted-foreground">Total usuarios</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10">
            <Bell className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-500">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Con push activo</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <BellOff className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{inactiveCount}</p>
              <p className="text-xs text-muted-foreground">Sin push</p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            <strong className="text-amber-500">Nota:</strong> Solo puedes desactivar notificaciones remotamente. 
            Para activarlas, el usuario debe hacerlo desde su propio navegador en "Mi Perfil" debido a restricciones de seguridad del navegador.
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterPush === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterPush("all")}
            >
              Todos
            </Button>
            <Button
              variant={filterPush === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterPush("active")}
            >
              <Bell className="w-4 h-4 mr-1" />
              Activos
            </Button>
            <Button
              variant={filterPush === "inactive" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterPush("inactive")}
            >
              <BellOff className="w-4 h-4 mr-1" />
              Inactivos
            </Button>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-[400px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado Push</TableHead>
                  <TableHead>Última actualización</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No se encontraron usuarios
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || "Sin nombre"}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {roleLabels[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.has_push ? (
                          <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                            <Bell className="w-3 h-3 mr-1" />
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <BellOff className="w-3 h-3 mr-1" />
                            Inactivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.push_updated_at ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(user.push_updated_at), "dd MMM yyyy, HH:mm", { locale: es })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Test result indicator */}
                          {testResults.has(user.user_id) && (
                            <div className="flex items-center gap-1">
                              {testResults.get(user.user_id)?.success ? (
                                <Badge className="bg-green-500/20 text-green-600 text-xs">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  {testResults.get(user.user_id)?.recipients} enviado
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Error
                                </Badge>
                              )}
                            </div>
                          )}
                          
                          {user.has_push && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendTestNotification(user)}
                                disabled={sendingTest === user.user_id}
                              >
                                {sendingTest === user.user_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Send className="w-4 h-4 mr-1" />
                                    Probar
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setUserToUnsubscribe(user)}
                              >
                                <BellOff className="w-4 h-4 mr-1" />
                                Desactivar
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!userToUnsubscribe} onOpenChange={() => setUserToUnsubscribe(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar notificaciones push?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará la suscripción de push para{" "}
              <strong>{userToUnsubscribe?.full_name || userToUnsubscribe?.email}</strong>.
              El usuario deberá reactivarlas manualmente desde su perfil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unsubscribing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnsubscribe}
              disabled={unsubscribing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unsubscribing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <BellOff className="w-4 h-4 mr-2" />
              )}
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
