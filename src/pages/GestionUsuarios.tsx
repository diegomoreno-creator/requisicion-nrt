import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role: AppRole;
}

const roleLabels: Record<AppRole, string> = {
  superadmin: "Super Admin",
  admin: "Administrador",
  comprador: "Comprador",
  solicitador: "Solicitador",
  inactivo: "Inactivo",
};

const roleColors: Record<AppRole, string> = {
  superadmin: "bg-primary text-primary-foreground",
  admin: "bg-blue-600 text-white",
  comprador: "bg-green-600 text-white",
  solicitador: "bg-yellow-600 text-white",
  inactivo: "bg-muted text-muted-foreground",
};

const GestionUsuarios = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { user, isSuperadmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isSuperadmin) {
      toast.error("Acceso denegado");
      navigate("/dashboard");
    }
  }, [authLoading, isSuperadmin, navigate]);

  useEffect(() => {
    if (isSuperadmin) {
      fetchUsers();
    }
  }, [isSuperadmin]);

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }

      const response = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setUsers(response.data.users || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error(error.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: AppRole) => {
    setUpdating(targetUserId);
    try {
      const response = await supabase.functions.invoke('manage-users', {
        body: { 
          action: 'updateRole',
          targetUserId,
          newRole
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success("Rol actualizado correctamente");
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.user_id === targetUserId ? { ...u, role: newRole } : u
      ));
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || "Error al actualizar rol");
    } finally {
      setUpdating(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperadmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al menú
        </Button>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                Gestión de Usuarios
                <Shield className="w-5 h-5 text-primary" />
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                Administra los roles y permisos de los usuarios
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Email</TableHead>
                    <TableHead className="text-muted-foreground">Nombre</TableHead>
                    <TableHead className="text-muted-foreground">Rol Actual</TableHead>
                    <TableHead className="text-muted-foreground">Cambiar Rol</TableHead>
                    <TableHead className="text-muted-foreground">Fecha Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No hay usuarios registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.user_id} className="border-border">
                        <TableCell className="text-foreground font-medium">
                          {u.email}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {u.full_name || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={roleColors[u.role]}>
                            {roleLabels[u.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.user_id === user?.id ? (
                            <span className="text-muted-foreground text-sm">
                              (Tu cuenta)
                            </span>
                          ) : (
                            <Select
                              value={u.role}
                              onValueChange={(value) => handleRoleChange(u.user_id, value as AppRole)}
                              disabled={updating === u.user_id}
                            >
                              <SelectTrigger className="w-40 bg-input border-border">
                                {updating === u.user_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <SelectValue />
                                )}
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                <SelectItem value="superadmin">Super Admin</SelectItem>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="comprador">Comprador</SelectItem>
                                <SelectItem value="solicitador">Solicitador</SelectItem>
                                <SelectItem value="inactivo">Inactivo</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(u.created_at).toLocaleDateString('es-MX')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GestionUsuarios;
