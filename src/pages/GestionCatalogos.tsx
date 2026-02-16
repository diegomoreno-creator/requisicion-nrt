import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, 
  Settings, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Palette,
  Building2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CatalogoItem {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  color_class?: string;
  color_hsl?: string;
  empresa_id?: string;
  default_role?: string | null;
}

interface EmpresaItem {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  revision_habilitada?: boolean;
}

const colorOptions = [
  { value: "bg-black", label: "Negro", preview: "bg-black" },
  { value: "bg-red-500", label: "Rojo", preview: "bg-red-500" },
  { value: "bg-orange-500", label: "Naranja", preview: "bg-orange-500" },
  { value: "bg-yellow-500", label: "Amarillo", preview: "bg-yellow-500" },
  { value: "bg-green-500", label: "Verde", preview: "bg-green-500" },
  { value: "bg-blue-500", label: "Azul", preview: "bg-blue-500" },
  { value: "bg-purple-500", label: "Morado", preview: "bg-purple-500" },
  { value: "bg-pink-500", label: "Rosa", preview: "bg-pink-500" },
  { value: "bg-gray-500", label: "Gris", preview: "bg-gray-500" },
];

const GestionCatalogos = () => {
  const navigate = useNavigate();
  const { hasPermission, isSuperadmin, user, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState("tipos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmpresaId, setUserEmpresaId] = useState<string | null>(null);
  
  // Data states
  const [tiposRequisicion, setTiposRequisicion] = useState<CatalogoItem[]>([]);
  const [unidadesNegocio, setUnidadesNegocio] = useState<CatalogoItem[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [sucursales, setSucursales] = useState<CatalogoItem[]>([]);
  const [departamentos, setDepartamentos] = useState<CatalogoItem[]>([]);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogoItem | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formColor, setFormColor] = useState("bg-yellow-500");
  const [formActivo, setFormActivo] = useState(true);
  const [formEmpresaId, setFormEmpresaId] = useState<string>("");
  const [formDefaultRole, setFormDefaultRole] = useState<string>("");

  // Fetch user's empresa_id for non-superadmin scoping
  useEffect(() => {
    const fetchUserEmpresa = async () => {
      if (!user || isSuperadmin) return;
      const { data } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", user.id)
        .single();
      if (data?.empresa_id) setUserEmpresaId(data.empresa_id);
    };
    if (!authLoading && user) fetchUserEmpresa();
  }, [authLoading, user, isSuperadmin]);

  // Set default tab for non-superadmin (they can't see global catalogs)
  useEffect(() => {
    if (!authLoading && !isSuperadmin) {
      if (["tipos", "empresas", "sucursales"].includes(activeTab)) {
        setActiveTab("unidades");
      }
    }
  }, [authLoading, isSuperadmin]);

  useEffect(() => {
    if (!authLoading && !hasPermission('gestionar_catalogos')) {
      toast.error("Acceso denegado");
      navigate("/dashboard");
    }
  }, [authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && hasPermission('gestionar_catalogos')) {
      fetchAllCatalogs();
    }
  }, [authLoading]);

  const fetchAllCatalogs = async () => {
    setLoading(true);
    try {
      const [tiposRes, unidadesRes, empresasRes, sucursalesRes, departamentosRes] = await Promise.all([
        supabase.from("catalogo_tipos_requisicion").select("*").order("orden"),
        supabase.from("catalogo_unidades_negocio").select("*").order("orden"),
        supabase.from("catalogo_empresas").select("*").order("orden"),
        supabase.from("catalogo_sucursales").select("*").order("orden"),
        supabase.from("catalogo_departamentos").select("*").order("orden"),
      ]);

      if (tiposRes.data) setTiposRequisicion(tiposRes.data);
      if (unidadesRes.data) setUnidadesNegocio(unidadesRes.data);
      if (empresasRes.data) setEmpresas(empresasRes.data);
      if (sucursalesRes.data) setSucursales(sucursalesRes.data);
      if (departamentosRes.data) setDepartamentos(departamentosRes.data);
    } catch (error) {
      console.error("Error fetching catalogs:", error);
      toast.error("Error al cargar catálogos");
    } finally {
      setLoading(false);
    }
  };

  const getTableName = (): "catalogo_tipos_requisicion" | "catalogo_unidades_negocio" | "catalogo_empresas" | "catalogo_sucursales" | "catalogo_departamentos" => {
    switch (activeTab) {
      case "tipos": return "catalogo_tipos_requisicion";
      case "unidades": return "catalogo_unidades_negocio";
      case "empresas": return "catalogo_empresas";
      case "sucursales": return "catalogo_sucursales";
      case "departamentos": return "catalogo_departamentos";
      default: return "catalogo_tipos_requisicion";
    }
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case "tipos": return tiposRequisicion;
      case "unidades": return filteredUnidades;
      case "empresas": return empresas;
      case "sucursales": return sucursales;
      case "departamentos": return filteredDepartamentos;
      default: return [];
    }
  };

  // Filter data by empresa for non-superadmins
  const filteredUnidades = !isSuperadmin && userEmpresaId
    ? unidadesNegocio.filter(u => u.empresa_id === userEmpresaId)
    : unidadesNegocio;

  const filteredDepartamentos = !isSuperadmin && userEmpresaId
    ? departamentos.filter(d => d.empresa_id === userEmpresaId)
    : departamentos;

  const filteredEmpresas = !isSuperadmin && userEmpresaId
    ? empresas.filter(e => e.id === userEmpresaId)
    : empresas;

  const getEmpresaNombre = (empresaId: string | undefined): string => {
    if (!empresaId) return "-";
    const empresa = empresas.find(e => e.id === empresaId);
    return empresa?.nombre || "-";
  };

  const roleOptions = [
    { value: "solicitador", label: "Solicitante" },
    { value: "autorizador", label: "Autorizador" },
    { value: "comprador", label: "Comprador" },
    { value: "revision", label: "Revisión" },
    { value: "presupuestos", label: "Presupuestos" },
    { value: "tesoreria", label: "Tesorería" },
  ];

  const getRolLabel = (role: string | null | undefined): string => {
    if (!role) return "Sin asignar";
    return roleOptions.find(r => r.value === role)?.label || role;
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setFormNombre("");
    setFormColor("bg-yellow-500");
    setFormActivo(true);
    setFormEmpresaId(!isSuperadmin && userEmpresaId ? userEmpresaId : "");
    setFormDefaultRole("");
    setDialogOpen(true);
  };

  const openEditDialog = (item: CatalogoItem) => {
    setEditingItem(item);
    setFormNombre(item.nombre);
    setFormColor(item.color_class || "bg-yellow-500");
    setFormActivo(item.activo);
    setFormEmpresaId(item.empresa_id || "");
    setFormDefaultRole(item.default_role || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formNombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    if ((activeTab === "unidades" || activeTab === "departamentos") && !formEmpresaId && isSuperadmin) {
      toast.error("Debe seleccionar una empresa");
      return;
    }

    setSaving(true);
    const tableName = getTableName();

    try {
      if (editingItem) {
        // Update
        const updateData: any = { nombre: formNombre, activo: formActivo };
        if (activeTab === "tipos") {
          updateData.color_class = formColor;
        }
        if (activeTab === "unidades" || activeTab === "departamentos") {
          updateData.empresa_id = formEmpresaId;
        }
        if (activeTab === "departamentos") {
          updateData.default_role = formDefaultRole || null;
        }

        const { error } = await supabase
          .from(tableName)
          .update(updateData)
          .eq("id", editingItem.id);

        if (error) throw error;
        toast.success("Elemento actualizado");
      } else {
        // Insert
        const insertData: any = { 
          nombre: formNombre, 
          activo: formActivo,
          orden: getCurrentData().length + 1
        };
        if (activeTab === "tipos") {
          insertData.color_class = formColor;
        }
        if (activeTab === "unidades" || activeTab === "departamentos") {
          insertData.empresa_id = formEmpresaId;
        }
        if (activeTab === "departamentos") {
          insertData.default_role = formDefaultRole || null;
        }

        const { error } = await supabase
          .from(tableName)
          .insert(insertData);

        if (error) throw error;
        toast.success("Elemento agregado");
      }

      setDialogOpen(false);
      fetchAllCatalogs();
    } catch (error: any) {
      console.error("Error saving:", error);
      if (error.message?.includes("duplicate")) {
        toast.error("Ya existe un elemento con ese nombre");
      } else {
        toast.error(error.message || "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este elemento?")) return;

    try {
      const { error } = await supabase
        .from(getTableName())
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Elemento eliminado");
      fetchAllCatalogs();
    } catch (error: any) {
      console.error("Error deleting:", error);
      toast.error(error.message || "Error al eliminar");
    }
  };

  const toggleActivo = async (item: CatalogoItem) => {
    try {
      const { error } = await supabase
        .from(getTableName())
        .update({ activo: !item.activo })
        .eq("id", item.id);

      if (error) throw error;
      fetchAllCatalogs();
    } catch (error: any) {
      console.error("Error toggling:", error);
      toast.error(error.message || "Error al actualizar");
    }
  };

  const toggleRevisionHabilitada = async (empresa: EmpresaItem) => {
    try {
      const { error } = await supabase
        .from("catalogo_empresas")
        .update({ revision_habilitada: !empresa.revision_habilitada })
        .eq("id", empresa.id);

      if (error) throw error;
      toast.success(`Revisión ${!empresa.revision_habilitada ? "habilitada" : "deshabilitada"} para ${empresa.nombre}`);
      fetchAllCatalogs();
    } catch (error: any) {
      console.error("Error toggling revision:", error);
      toast.error(error.message || "Error al actualizar");
    }
  };

  const renderEmpresasTable = () => (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">Nombre</TableHead>
            <TableHead className="text-muted-foreground w-28">Revisión</TableHead>
            <TableHead className="text-muted-foreground w-24">Activo</TableHead>
            <TableHead className="text-muted-foreground w-24 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {empresas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                No hay elementos
              </TableCell>
            </TableRow>
          ) : (
            empresas.map((item) => (
              <TableRow key={item.id} className="border-border">
                <TableCell className="text-foreground font-medium">{item.nombre}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!item.revision_habilitada}
                      onCheckedChange={() => toggleRevisionHabilitada(item)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {item.revision_habilitada ? "Sí" : "No"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={item.activo}
                    onCheckedChange={() => toggleActivo(item as any)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(item as any)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPermission('gestionar_catalogos')) return null;

  const renderTable = (data: CatalogoItem[], showColor: boolean = false, showEmpresa: boolean = false) => (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {showColor && <TableHead className="text-muted-foreground w-16">Color</TableHead>}
            <TableHead className="text-muted-foreground">Nombre</TableHead>
            {showEmpresa && <TableHead className="text-muted-foreground">Empresa</TableHead>}
            <TableHead className="text-muted-foreground w-24">Activo</TableHead>
            <TableHead className="text-muted-foreground w-24 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showColor ? 4 : showEmpresa ? 4 : 3} className="text-center text-muted-foreground py-8">
                No hay elementos
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow key={item.id} className="border-border">
                {showColor && (
                  <TableCell>
                    <span className={cn("w-4 h-4 rounded-full inline-block", item.color_class)} />
                  </TableCell>
                )}
                <TableCell className="text-foreground font-medium">{item.nombre}</TableCell>
                {showEmpresa && (
                  <TableCell className="text-muted-foreground text-sm">
                    {getEmpresaNombre(item.empresa_id)}
                  </TableCell>
                )}
                <TableCell>
                  <Switch
                    checked={item.activo}
                    onCheckedChange={() => toggleActivo(item)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(item)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  // Group unidades by empresa for better visualization
  const renderUnidadesGrouped = () => {
    const grouped = filteredEmpresas.map(empresa => ({
      empresa,
      unidades: filteredUnidades.filter(u => u.empresa_id === empresa.id)
    })).filter(g => g.unidades.length > 0);

    const sinEmpresa = filteredUnidades.filter(u => !u.empresa_id);

    return (
      <div className="space-y-6">
        {grouped.map(group => (
          <div key={group.empresa.id} className="space-y-2">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Building2 className="w-4 h-4" />
              {group.empresa.nombre}
            </div>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Unidad de Negocio</TableHead>
                    <TableHead className="text-muted-foreground w-24">Activo</TableHead>
                    <TableHead className="text-muted-foreground w-24 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.unidades.map((item) => (
                    <TableRow key={item.id} className="border-border">
                      <TableCell className="text-foreground">{item.nombre}</TableCell>
                      <TableCell>
                        <Switch
                          checked={item.activo}
                          onCheckedChange={() => toggleActivo(item)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(item)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
        
        {sinEmpresa.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground font-semibold">
              <Building2 className="w-4 h-4" />
              Sin empresa asignada
            </div>
            {renderTable(sinEmpresa)}
          </div>
        )}

        {grouped.length === 0 && sinEmpresa.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No hay unidades de negocio
          </div>
        )}
      </div>
    );
  };

  const renderDepartamentosGrouped = () => {
    const grouped = filteredEmpresas.map(empresa => ({
      empresa,
      deptos: filteredDepartamentos.filter(d => d.empresa_id === empresa.id)
    })).filter(g => g.deptos.length > 0);

    const sinEmpresa = filteredDepartamentos.filter(d => !d.empresa_id);

    return (
      <div className="space-y-6">
        {grouped.map(group => (
          <div key={group.empresa.id} className="space-y-2">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Building2 className="w-4 h-4" />
              {group.empresa.nombre}
            </div>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Departamento</TableHead>
                    <TableHead className="text-muted-foreground w-40">Función (Rol)</TableHead>
                    <TableHead className="text-muted-foreground w-24">Activo</TableHead>
                    <TableHead className="text-muted-foreground w-24 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.deptos.map((item) => (
                    <TableRow key={item.id} className="border-border">
                      <TableCell className="text-foreground">{item.nombre}</TableCell>
                      <TableCell>
                        <Select
                          value={item.default_role || "none"}
                          onValueChange={async (value) => {
                            const newRole = value === "none" ? null : value;
                            try {
                              const { error } = await supabase
                                .from("catalogo_departamentos")
                                .update({ default_role: newRole })
                                .eq("id", item.id);
                              if (error) throw error;
                              toast.success(`Función actualizada para ${item.nombre}`);
                              fetchAllCatalogs();
                            } catch (err: any) {
                              toast.error(err.message || "Error al actualizar");
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs w-36 bg-input border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border z-50">
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {roleOptions.map(r => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={item.activo}
                          onCheckedChange={() => toggleActivo(item)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="text-muted-foreground hover:text-foreground">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}

        {sinEmpresa.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground font-semibold">
              <Building2 className="w-4 h-4" />
              Sin empresa asignada
            </div>
            {renderTable(sinEmpresa)}
          </div>
        )}

        {grouped.length === 0 && sinEmpresa.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No hay departamentos
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
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
                <Settings className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-foreground">Gestión de Catálogos</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Administra los catálogos del sistema
                </p>
              </div>
            </div>
            <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className={cn("grid mb-6 bg-muted", isSuperadmin ? "grid-cols-5" : "grid-cols-2")}>
                {isSuperadmin && (
                  <TabsTrigger value="tipos" className="data-[state=active]:bg-background">
                    <Palette className="w-4 h-4 mr-2" />
                    Tipos
                  </TabsTrigger>
                )}
                {isSuperadmin && (
                  <TabsTrigger value="empresas" className="data-[state=active]:bg-background">
                    Empresas
                  </TabsTrigger>
                )}
                <TabsTrigger value="unidades" className="data-[state=active]:bg-background">
                  Unidades
                </TabsTrigger>
                <TabsTrigger value="departamentos" className="data-[state=active]:bg-background">
                  Deptos.
                </TabsTrigger>
                {isSuperadmin && (
                  <TabsTrigger value="sucursales" className="data-[state=active]:bg-background">
                    Sucursales
                  </TabsTrigger>
                )}
              </TabsList>

              {isSuperadmin && (
                <TabsContent value="tipos">
                  {renderTable(tiposRequisicion, true)}
                </TabsContent>
              )}
              {isSuperadmin && (
                <TabsContent value="empresas">
                  {renderEmpresasTable()}
                </TabsContent>
              )}
              <TabsContent value="unidades">
                {renderUnidadesGrouped()}
              </TabsContent>
              <TabsContent value="departamentos">
                {renderDepartamentosGrouped()}
              </TabsContent>
              {isSuperadmin && (
                <TabsContent value="sucursales">
                  {renderTable(sucursales)}
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingItem ? "Editar" : "Agregar"} Elemento
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {activeTab === "tipos" ? "Tipo de requisición" : 
               activeTab === "unidades" ? "Unidad de negocio" :
               activeTab === "empresas" ? "Empresa" : 
               activeTab === "departamentos" ? "Departamento" : "Sucursal"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground">Nombre *</Label>
              <Input
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                className="bg-input border-border"
                placeholder="Nombre del elemento"
              />
            </div>

            {activeTab === "tipos" && (
              <div className="space-y-2">
                <Label className="text-foreground">Color</Label>
                <Select value={formColor} onValueChange={setFormColor}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border z-50">
                    {colorOptions.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <span className={cn("w-4 h-4 rounded-full", color.preview)} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(activeTab === "unidades" || activeTab === "departamentos") && isSuperadmin && (
              <div className="space-y-2">
                <Label className="text-foreground">Empresa *</Label>
                <Select value={formEmpresaId} onValueChange={setFormEmpresaId}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Seleccione una empresa" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border z-50">
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeTab === "departamentos" && (
              <div className="space-y-2">
                <Label className="text-foreground">Función (Rol por defecto)</Label>
                <Select value={formDefaultRole || "none"} onValueChange={(v) => setFormDefaultRole(v === "none" ? "" : v)}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border z-50">
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {roleOptions.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Se asignará automáticamente al agregar un usuario a este departamento (solo si es inactivo).
                </p>
              </div>
            )}

            <div className="flex items-center space-x-3">
              <Switch
                id="activo"
                checked={formActivo}
                onCheckedChange={setFormActivo}
              />
              <Label htmlFor="activo" className="text-foreground cursor-pointer">
                Activo
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-border"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GestionCatalogos;