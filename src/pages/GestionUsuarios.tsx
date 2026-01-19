import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Shield, Loader2, UserPlus, Trash2, Pencil, Key } from "lucide-react";
import { toast } from "sonner";

interface UserWithRoles {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles: AppRole[];
}

const allRoles: AppRole[] = ['superadmin', 'admin', 'autorizador', 'comprador', 'solicitador', 'inactivo'];

const roleLabels: Record<AppRole, string> = {
  superadmin: "Super Admin",
  admin: "Administrador",
  autorizador: "Autorizador",
  comprador: "Comprador",
  solicitador: "Solicitador",
  inactivo: "Inactivo",
};

const roleColors: Record<AppRole, string> = {
  superadmin: "bg-primary text-primary-foreground",
  admin: "bg-blue-600 text-white",
  autorizador: "bg-purple-600 text-white",
  comprador: "bg-green-600 text-white",
  solicitador: "bg-yellow-600 text-white",
  inactivo: "bg-muted text-muted-foreground",
};

const GestionUsuarios = () => {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Edit user state
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRoles, setEditRoles] = useState<AppRole[]>([]);
  
  // Password change state
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Form state for new user
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserRoles, setNewUserRoles] = useState<AppRole[]>(["solicitador"]);

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

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast.error("Email y contraseña son requeridos");
      return;
    }

    if (newUserPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (newUserRoles.length === 0) {
      toast.error("Debe seleccionar al menos un rol");
      return;
    }

    setIsCreating(true);
    try {
      const response = await supabase.functions.invoke('manage-users', {
        body: { 
          action: 'createUser',
          email: newUserEmail,
          password: newUserPassword,
          fullName: newUserFullName,
          roles: newUserRoles
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success("Usuario creado correctamente");
      setIsCreateDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || "Error al crear usuario");
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserFullName("");
    setNewUserRoles(["solicitador"]);
  };

  const handleEditUser = (u: UserWithRoles) => {
    setEditingUser(u);
    setEditFullName(u.full_name || "");
    setEditEmail(u.email);
    setEditRoles([...u.roles]);
    setIsEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    if (editRoles.length === 0) {
      toast.error("Debe seleccionar al menos un rol");
      return;
    }

    setIsSaving(true);
    try {
      // Update user info
      const updateResponse = await supabase.functions.invoke('manage-users', {
        body: { 
          action: 'updateUser',
          targetUserId: editingUser.user_id,
          fullName: editFullName,
          email: editEmail !== editingUser.email ? editEmail : undefined
        }
      });

      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
      }

      if (updateResponse.data?.error) {
        throw new Error(updateResponse.data.error);
      }

      // Update roles
      const rolesResponse = await supabase.functions.invoke('manage-users', {
        body: { 
          action: 'setRoles',
          targetUserId: editingUser.user_id,
          roles: editRoles
        }
      });

      if (rolesResponse.error) {
        throw new Error(rolesResponse.error.message);
      }

      if (rolesResponse.data?.error) {
        throw new Error(rolesResponse.data.error);
      }

      toast.success("Usuario actualizado correctamente");
      setIsEditDialogOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || "Error al actualizar usuario");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordUserId || !newPassword) return;

    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await supabase.functions.invoke('manage-users', {
        body: { 
          action: 'updatePassword',
          targetUserId: passwordUserId,
          newPassword
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success("Contraseña actualizada correctamente");
      setPasswordUserId(null);
      setNewPassword("");
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || "Error al cambiar contraseña");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    setIsDeleting(true);
    try {
      const response = await supabase.functions.invoke('manage-users', {
        body: { 
          action: 'deleteUser',
          targetUserId: deleteUserId
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success("Usuario eliminado correctamente");
      setUsers(prev => prev.filter(u => u.user_id !== deleteUserId));
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || "Error al eliminar usuario");
    } finally {
      setIsDeleting(false);
      setDeleteUserId(null);
    }
  };

  const toggleRole = (role: AppRole, currentRoles: AppRole[], setRoles: (roles: AppRole[]) => void) => {
    if (currentRoles.includes(role)) {
      // Don't allow removing the last role
      if (currentRoles.length > 1) {
        setRoles(currentRoles.filter(r => r !== role));
      }
    } else {
      // If adding a role other than inactivo, remove inactivo
      let newRoles = [...currentRoles, role];
      if (role !== 'inactivo') {
        newRoles = newRoles.filter(r => r !== 'inactivo');
      } else {
        // If adding inactivo, remove all other roles
        newRoles = ['inactivo'];
      }
      setRoles(newRoles);
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
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al menú
        </Button>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
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
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Crear Usuario
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Crear Nuevo Usuario</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Ingresa los datos del nuevo usuario. Se creará con acceso inmediato.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">
                      Correo Electrónico *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@ejemplo.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground">
                      Contraseña *
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-foreground">
                      Nombre Completo
                    </Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Juan Pérez"
                      value={newUserFullName}
                      onChange={(e) => setNewUserFullName(e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">Roles</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {allRoles.map(role => (
                        <div key={role} className="flex items-center space-x-2">
                          <Checkbox
                            id={`new-${role}`}
                            checked={newUserRoles.includes(role)}
                            onCheckedChange={() => toggleRole(role, newUserRoles, setNewUserRoles)}
                          />
                          <label
                            htmlFor={`new-${role}`}
                            className="text-sm text-foreground cursor-pointer"
                          >
                            {roleLabels[role]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      resetForm();
                    }}
                    className="border-border"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreateUser}
                    disabled={isCreating}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      "Crear Usuario"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Email</TableHead>
                    <TableHead className="text-muted-foreground">Nombre</TableHead>
                    <TableHead className="text-muted-foreground">Roles</TableHead>
                    <TableHead className="text-muted-foreground">Fecha Registro</TableHead>
                    <TableHead className="text-muted-foreground text-right">Acciones</TableHead>
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
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map(role => (
                              <Badge key={role} className={roleColors[role]}>
                                {roleLabels[role]}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(u.created_at).toLocaleDateString('es-MX')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {u.user_id !== user?.id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-foreground"
                                  onClick={() => handleEditUser(u)}
                                  title="Editar usuario"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-foreground"
                                  onClick={() => setPasswordUserId(u.user_id)}
                                  title="Cambiar contraseña"
                                >
                                  <Key className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteUserId(u.user_id)}
                                  title="Eliminar usuario"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {u.user_id === user?.id && (
                              <span className="text-muted-foreground text-sm">
                                (Tu cuenta)
                              </span>
                            )}
                          </div>
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

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Usuario</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Modifica los datos y roles del usuario.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editEmail" className="text-foreground">
                Correo Electrónico
              </Label>
              <Input
                id="editEmail"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editFullName" className="text-foreground">
                Nombre Completo
              </Label>
              <Input
                id="editFullName"
                type="text"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Roles</Label>
              <div className="grid grid-cols-2 gap-2">
                {allRoles.map(role => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-${role}`}
                      checked={editRoles.includes(role)}
                      onCheckedChange={() => toggleRole(role, editRoles, setEditRoles)}
                    />
                    <label
                      htmlFor={`edit-${role}`}
                      className="text-sm text-foreground cursor-pointer"
                    >
                      {roleLabels[role]}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingUser(null);
              }}
              className="border-border"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveUser}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={!!passwordUserId} onOpenChange={() => { setPasswordUserId(null); setNewPassword(""); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Cambiar Contraseña</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Ingresa la nueva contraseña para el usuario.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-foreground">
                Nueva Contraseña
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-input border-border"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setPasswordUserId(null); setNewPassword(""); }}
              className="border-border"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || newPassword.length < 6}
              className="bg-primary hover:bg-primary/90"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cambiando...
                </>
              ) : (
                "Cambiar Contraseña"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta acción no se puede deshacer. El usuario será eliminado permanentemente
              junto con todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GestionUsuarios;