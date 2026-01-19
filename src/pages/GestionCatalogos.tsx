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
  Palette
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
  const { isSuperadmin, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState("tipos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data states
  const [tiposRequisicion, setTiposRequisicion] = useState<CatalogoItem[]>([]);
  const [unidadesNegocio, setUnidadesNegocio] = useState<CatalogoItem[]>([]);
  const [empresas, setEmpresas] = useState<CatalogoItem[]>([]);
  const [sucursales, setSucursales] = useState<CatalogoItem[]>([]);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogoItem | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formColor, setFormColor] = useState("bg-yellow-500");
  const [formActivo, setFormActivo] = useState(true);

  useEffect(() => {
    if (!authLoading && !isSuperadmin) {
      toast.error("Acceso denegado");
      navigate("/dashboard");
    }
  }, [authLoading, isSuperadmin, navigate]);

  useEffect(() => {
    if (isSuperadmin) {
      fetchAllCatalogs();
    }
  }, [isSuperadmin]);

  const fetchAllCatalogs = async () => {
    setLoading(true);
    try {
      const [tiposRes, unidadesRes, empresasRes, sucursalesRes] = await Promise.all([
        supabase.from("catalogo_tipos_requisicion").select("*").order("orden"),
        supabase.from("catalogo_unidades_negocio").select("*").order("orden"),
        supabase.from("catalogo_empresas").select("*").order("orden"),
        supabase.from("catalogo_sucursales").select("*").order("orden"),
      ]);

      if (tiposRes.data) setTiposRequisicion(tiposRes.data);
      if (unidadesRes.data) setUnidadesNegocio(unidadesRes.data);
      if (empresasRes.data) setEmpresas(empresasRes.data);
      if (sucursalesRes.data) setSucursales(sucursalesRes.data);
    } catch (error) {
      console.error("Error fetching catalogs:", error);
      toast.error("Error al cargar catálogos");
    } finally {
      setLoading(false);
    }
  };

  const getTableName = (): "catalogo_tipos_requisicion" | "catalogo_unidades_negocio" | "catalogo_empresas" | "catalogo_sucursales" => {
    switch (activeTab) {
      case "tipos": return "catalogo_tipos_requisicion";
      case "unidades": return "catalogo_unidades_negocio";
      case "empresas": return "catalogo_empresas";
      case "sucursales": return "catalogo_sucursales";
      default: return "catalogo_tipos_requisicion";
    }
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case "tipos": return tiposRequisicion;
      case "unidades": return unidadesNegocio;
      case "empresas": return empresas;
      case "sucursales": return sucursales;
      default: return [];
    }
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setFormNombre("");
    setFormColor("bg-yellow-500");
    setFormActivo(true);
    setDialogOpen(true);
  };

  const openEditDialog = (item: CatalogoItem) => {
    setEditingItem(item);
    setFormNombre(item.nombre);
    setFormColor(item.color_class || "bg-yellow-500");
    setFormActivo(item.activo);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formNombre.trim()) {
      toast.error("El nombre es requerido");
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperadmin) return null;

  const renderTable = (data: CatalogoItem[], showColor: boolean = false) => (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {showColor && <TableHead className="text-muted-foreground w-16">Color</TableHead>}
            <TableHead className="text-muted-foreground">Nombre</TableHead>
            <TableHead className="text-muted-foreground w-24">Activo</TableHead>
            <TableHead className="text-muted-foreground w-24 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showColor ? 4 : 3} className="text-center text-muted-foreground py-8">
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
              <TabsList className="grid grid-cols-4 mb-6 bg-muted">
                <TabsTrigger value="tipos" className="data-[state=active]:bg-background">
                  <Palette className="w-4 h-4 mr-2" />
                  Tipos
                </TabsTrigger>
                <TabsTrigger value="unidades" className="data-[state=active]:bg-background">
                  Unidades
                </TabsTrigger>
                <TabsTrigger value="empresas" className="data-[state=active]:bg-background">
                  Empresas
                </TabsTrigger>
                <TabsTrigger value="sucursales" className="data-[state=active]:bg-background">
                  Sucursales
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tipos">
                {renderTable(tiposRequisicion, true)}
              </TabsContent>
              <TabsContent value="unidades">
                {renderTable(unidadesNegocio)}
              </TabsContent>
              <TabsContent value="empresas">
                {renderTable(empresas)}
              </TabsContent>
              <TabsContent value="sucursales">
                {renderTable(sucursales)}
              </TabsContent>
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
               activeTab === "empresas" ? "Empresa" : "Sucursal"}
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
