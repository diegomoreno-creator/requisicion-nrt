import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, ArrowLeft, Bell, CheckCircle, FolderSearch, RefreshCw, RotateCcw, Search, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import TramiteDetailDialog from "@/components/TramiteDetailDialog";
import { useCatalogos } from "@/hooks/useCatalogos";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

interface Tramite {
  id: string;
  folio: string;
  tipo: "Requisición" | "Reposición";
  tipoRequisicionId?: string | null;
  asunto?: string | null;
  fecha: string;
  fechaOrden?: string | null; // For comprador ordering by authorization date
  solicitante: string;
  estado: string;
  deleted_at?: string | null;
  // Tracking who processed each phase
  autorizado_por?: string | null;
  licitado_por?: string | null;
  pedido_colocado_por?: string | null;
  pedido_autorizado_por?: string | null;
  pagado_por?: string | null;
}

const estadoColors: Record<string, string> = {
  pendiente: "bg-yellow-500/20 text-yellow-500",
  aprobado: "bg-green-500/20 text-green-500",
  rechazado: "bg-red-500/20 text-red-500",
  cancelado: "bg-muted text-muted-foreground",
  en_licitacion: "bg-blue-500/20 text-blue-500",
  pedido_colocado: "bg-purple-500/20 text-purple-500",
  pedido_autorizado: "bg-orange-500/20 text-orange-500",
  pedido_pagado: "bg-emerald-500/20 text-emerald-500",
};

const estadoLabels: Record<string, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  en_licitacion: "En Licitación",
  pedido_colocado: "Pedido Colocado",
  pedido_autorizado: "Pedido Autorizado",
  pedido_pagado: "Pedido Pagado",
};

const Tramites = () => {
  const navigate = useNavigate();
  const { user, isSuperadmin, isAdmin, isComprador, isAutorizador, isPresupuestos, isTesoreria, isSolicitador, loading: authLoading } = useAuth();
  const { tiposRequisicion, getTipoColor, getTipoNombre } = useCatalogos();
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [attendedTramites, setAttendedTramites] = useState<Tramite[]>([]);
  const [rejectedTramites, setRejectedTramites] = useState<Tramite[]>([]);
  const [deletedTramites, setDeletedTramites] = useState<Tramite[]>([]);
  
  // Enable realtime notifications
  useRealtimeNotifications();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [selectedTramite, setSelectedTramite] = useState<{
    id: string;
    tipo: "Requisición" | "Reposición";
  } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("activos");
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Determine which processor field to check based on user role
  const getProcessorField = (): string | null => {
    if (isAutorizador) return 'autorizado_por';
    if (isPresupuestos) return 'pedido_autorizado_por';
    if (isTesoreria) return 'pagado_por';
    // Comprador handles multiple phases, so we don't use "Atendidos" for them
    return null;
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchTramites();
    }
  }, [user, authLoading]);

  const fetchTramites = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch requisiciones - RLS policies will handle visibility
      // For compradores, order by fecha_autorizacion_real; for others, by created_at
      const { data: requisiciones, error: reqError } = await supabase
        .from("requisiciones")
        .select("id, folio, created_at, fecha_autorizacion_real, solicitado_por, estado, tipo_requisicion, asunto, justificacion_rechazo, justificacion_rechazo_presupuestos, autorizador_id, deleted_at, autorizado_por, licitado_por, pedido_colocado_por, pedido_autorizado_por, pagado_por")
        .order(isComprador ? "fecha_autorizacion_real" : "created_at", { ascending: false, nullsFirst: false });

      if (reqError) {
        console.error("Error fetching requisiciones:", reqError);
      }

      // Fetch reposiciones - RLS policies will handle visibility
      const { data: reposiciones, error: repoError } = await supabase
        .from("reposiciones")
        .select("id, folio, fecha_solicitud, solicitado_por, estado, asunto, autorizado_por, pagado_por")
        .order("created_at", { ascending: false });

      if (repoError) {
        console.error("Error fetching reposiciones:", repoError);
      }

      // Get all unique user IDs to fetch their names using security definer function
      const userIds = new Set<string>();
      requisiciones?.forEach((r) => userIds.add(r.solicitado_por));
      reposiciones?.forEach((r) => userIds.add(r.solicitado_por));

      // Fetch user names using the security definer function for each unique user
      const userMap = new Map<string, string>();
      const userIdArray = Array.from(userIds);
      
      // Fetch names in parallel using the security definer function
      const namePromises = userIdArray.map(async (userId) => {
        const { data } = await supabase.rpc('get_profile_name', { _user_id: userId });
        return { userId, name: data || "Usuario" };
      });
      
      const nameResults = await Promise.all(namePromises);
      nameResults.forEach(({ userId, name }) => {
        userMap.set(userId, name);
      });

      // Combine and format tramites - separate active, attended, rejected, and deleted
      const activeTramites: Tramite[] = [];
      const attended: Tramite[] = [];
      const rejected: Tramite[] = [];
      const deleted: Tramite[] = [];
      
      const processorField = getProcessorField();

      requisiciones?.forEach((r) => {
        const tramite: Tramite = {
          id: r.id,
          folio: r.folio,
          tipo: "Requisición",
          tipoRequisicionId: r.tipo_requisicion,
          asunto: r.asunto,
          fecha: r.created_at,
          fechaOrden: (r as any).fecha_autorizacion_real || r.created_at,
          solicitante: userMap.get(r.solicitado_por) || "Usuario",
          estado: r.estado || "borrador",
          deleted_at: r.deleted_at,
          autorizado_por: r.autorizado_por,
          licitado_por: r.licitado_por,
          pedido_colocado_por: r.pedido_colocado_por,
          pedido_autorizado_por: r.pedido_autorizado_por,
          pagado_por: r.pagado_por,
        };
        
        if (r.deleted_at) {
          deleted.push(tramite);
        } else if ((isSolicitador && r.solicitado_por === user.id && r.estado === 'pendiente' && r.justificacion_rechazo) ||
                   (isComprador && r.justificacion_rechazo && r.estado === 'pendiente') ||
                   (isAutorizador && r.autorizador_id === user.id && (r as any).justificacion_rechazo_presupuestos)) {
          // Items with rejection justification go to rejected tab
          // For solicitador: their own items with justificacion_rechazo
          // For comprador: items they rejected (any item with justificacion_rechazo)
          // For autorizador: items they authorized that have justificacion_rechazo_presupuestos
          rejected.push(tramite);
        } else if (isComprador && r.pedido_colocado_por === user.id) {
          // Comprador: only items where they completed both phases (pedido_colocado)
          // Items in "en_licitacion" stay in Pendientes since comprador still needs to place the order
          attended.push(tramite);
        } else if (processorField && (r as any)[processorField] === user.id) {
          // User processed this tramite - goes to Atendidos
          attended.push(tramite);
        } else {
          activeTramites.push(tramite);
        }
      });

      reposiciones?.forEach((r) => {
        const tramite: Tramite = {
          id: r.id,
          folio: r.folio,
          tipo: "Reposición",
          asunto: r.asunto,
          fecha: r.fecha_solicitud,
          solicitante: userMap.get(r.solicitado_por) || "Usuario",
          estado: r.estado || "borrador",
          autorizado_por: r.autorizado_por,
          pagado_por: r.pagado_por,
        };
        
        // For reposiciones, check autorizador (autorizado_por) and tesoreria (pagado_por)
        if (processorField === 'autorizado_por' && r.autorizado_por === user.id) {
          attended.push(tramite);
        } else if (processorField === 'pagado_por' && r.pagado_por === user.id) {
          attended.push(tramite);
        } else {
          activeTramites.push(tramite);
        }
      });

      // Sort by date descending - for comprador use fechaOrden (authorization date)
      const sortByDate = isComprador 
        ? (a: Tramite, b: Tramite) => new Date(b.fechaOrden || b.fecha).getTime() - new Date(a.fechaOrden || a.fecha).getTime()
        : (a: Tramite, b: Tramite) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      
      activeTramites.sort(sortByDate);
      attended.sort(sortByDate);
      rejected.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      deleted.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      setTramites(activeTramites);
      setAttendedTramites(attended);
      setRejectedTramites(rejected);
      setDeletedTramites(deleted);
    } catch (error) {
      console.error("Error fetching tramites:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTramites = tramites.filter((tramite) => {
    const matchesSearch =
      tramite.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tramite.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tramite.solicitante.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTipo =
      filterTipo === "todos" ||
      (filterTipo === "requisicion" && tramite.tipo === "Requisición") ||
      (filterTipo === "reposicion" && tramite.tipo === "Reposición");

    return matchesSearch && matchesTipo;
  });

  const filteredAttendedTramites = attendedTramites.filter((tramite) => {
    const matchesSearch =
      tramite.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tramite.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tramite.solicitante.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTipo =
      filterTipo === "todos" ||
      (filterTipo === "requisicion" && tramite.tipo === "Requisición") ||
      (filterTipo === "reposicion" && tramite.tipo === "Reposición");

    return matchesSearch && matchesTipo;
  });

  const filteredRejectedTramites = rejectedTramites.filter((tramite) => {
    const matchesSearch =
      tramite.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tramite.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tramite.solicitante.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTipo =
      filterTipo === "todos" ||
      (filterTipo === "requisicion" && tramite.tipo === "Requisición") ||
      (filterTipo === "reposicion" && tramite.tipo === "Reposición");

    return matchesSearch && matchesTipo;
  });

  // Check if current user role shows attended tab
  const showAttendedTab = isAutorizador || isPresupuestos || isTesoreria || isComprador;
  // Solicitador, Comprador, and Autorizador show rejected tab
  const showRejectedTab = isSolicitador || isComprador || isAutorizador;

  const formatFecha = (fecha: string) => {
    try {
      return format(new Date(fecha), "d/M/yyyy", { locale: es });
    } catch {
      return fecha;
    }
  };

  // Handle restore soft-deleted tramite (only requisiciones have deleted_at)
  const handleRestoreTramite = async (tramite: Tramite) => {
    try {
      if (tramite.tipo === "Requisición") {
        const { error } = await supabase
          .from("requisiciones")
          .update({ deleted_at: null })
          .eq("id", tramite.id);
        
        if (error) throw error;
        toast.success(`Requisición ${tramite.folio} restaurada exitosamente`);
        fetchTramites();
      } else {
        toast.error("Las reposiciones no soportan restauración");
      }
    } catch (error: any) {
      console.error("Error restoring tramite:", error);
      toast.error("Error al restaurar el trámite");
    }
  };

  // Handle permanent delete
  const handlePermanentDelete = async (tramite: Tramite) => {
    try {
      if (tramite.tipo === "Requisición") {
        // Delete related partidas first
        const { error: partidasError } = await supabase
          .from("requisicion_partidas")
          .delete()
          .eq("requisicion_id", tramite.id);
        
        if (partidasError) {
          console.error("Error deleting partidas:", partidasError);
        }

        // Delete historial
        const { error: historialError } = await supabase
          .from("requisicion_texto_compras_historial")
          .delete()
          .eq("requisicion_id", tramite.id);
        
        if (historialError) {
          console.error("Error deleting historial:", historialError);
        }

        // Delete requisicion
        const { error } = await supabase
          .from("requisiciones")
          .delete()
          .eq("id", tramite.id);
        
        if (error) throw error;
      } else {
        // Delete related gastos first
        const { error: gastosError } = await supabase
          .from("reposicion_gastos")
          .delete()
          .eq("reposicion_id", tramite.id);
        
        if (gastosError) {
          console.error("Error deleting gastos:", gastosError);
        }

        // Delete reposicion
        const { error } = await supabase
          .from("reposiciones")
          .delete()
          .eq("id", tramite.id);
        
        if (error) throw error;
      }
      
      toast.success(`${tramite.tipo} ${tramite.folio} eliminada permanentemente`);
      fetchTramites();
    } catch (error: any) {
      console.error("Error permanently deleting tramite:", error);
      toast.error("Error al eliminar el trámite permanentemente");
    }
  };

  // Toggle selection for a single tramite
  const toggleTramiteSelection = (tramiteId: string) => {
    setSelectedForDeletion(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tramiteId)) {
        newSet.delete(tramiteId);
      } else {
        newSet.add(tramiteId);
      }
      return newSet;
    });
  };

  // Toggle select all deleted tramites
  const toggleSelectAllDeleted = () => {
    if (selectedForDeletion.size === deletedTramites.length) {
      setSelectedForDeletion(new Set());
    } else {
      setSelectedForDeletion(new Set(deletedTramites.map(t => t.id)));
    }
  };

  // Handle bulk permanent delete
  const handleBulkPermanentDelete = async () => {
    if (selectedForDeletion.size === 0) return;
    
    setBulkDeleteLoading(true);
    setShowBulkDeleteConfirm(false);
    
    try {
      const tramitesToDelete = deletedTramites.filter(t => selectedForDeletion.has(t.id));
      let successCount = 0;
      let errorCount = 0;

      for (const tramite of tramitesToDelete) {
        try {
          if (tramite.tipo === "Requisición") {
            // Delete related partidas first
            await supabase
              .from("requisicion_partidas")
              .delete()
              .eq("requisicion_id", tramite.id);

            // Delete historial
            await supabase
              .from("requisicion_texto_compras_historial")
              .delete()
              .eq("requisicion_id", tramite.id);

            // Delete requisicion
            const { error } = await supabase
              .from("requisiciones")
              .delete()
              .eq("id", tramite.id);
            
            if (error) throw error;
          } else {
            // Delete related gastos first
            await supabase
              .from("reposicion_gastos")
              .delete()
              .eq("reposicion_id", tramite.id);

            // Delete reposicion
            const { error } = await supabase
              .from("reposiciones")
              .delete()
              .eq("id", tramite.id);
            
            if (error) throw error;
          }
          successCount++;
        } catch (err) {
          console.error(`Error deleting ${tramite.folio}:`, err);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast.success(`${successCount} trámite(s) eliminado(s) permanentemente`);
      } else {
        toast.warning(`${successCount} eliminado(s), ${errorCount} error(es)`);
      }
      
      setSelectedForDeletion(new Set());
      fetchTramites();
    } catch (error: any) {
      console.error("Error in bulk delete:", error);
      toast.error("Error al eliminar los trámites");
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const renderTramitesTable = (tramitesList: Tramite[], showDeleted = false) => {
    if (loading) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <p>Cargando trámites...</p>
        </div>
      );
    }

    if (tramitesList.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <p>{showDeleted ? "No hay trámites borrados" : "No se encontraron trámites"}</p>
          {!showDeleted && (
            <p className="text-sm mt-2">
              {searchTerm || filterTipo !== "todos"
                ? "Intenta ajustar los filtros de búsqueda"
                : "Aún no tienes trámites registrados"}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {showDeleted && (
                <TableHead className="w-10 p-2">
                  <Checkbox
                    checked={selectedForDeletion.size === tramitesList.length && tramitesList.length > 0}
                    onCheckedChange={toggleSelectAllDeleted}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
              )}
              <TableHead className="text-muted-foreground font-medium w-4"></TableHead>
              <TableHead className="text-muted-foreground font-medium">Folio</TableHead>
              <TableHead className="text-muted-foreground font-medium">Tipo de Trámite</TableHead>
              <TableHead className="text-muted-foreground font-medium">Asunto</TableHead>
              <TableHead className="text-muted-foreground font-medium">Fecha</TableHead>
              <TableHead className="text-muted-foreground font-medium">Solicitante</TableHead>
              <TableHead className="text-muted-foreground font-medium">Estado</TableHead>
              {showDeleted && (
                <TableHead className="text-muted-foreground font-medium">Borrado</TableHead>
              )}
              {showDeleted && (
                <TableHead className="text-muted-foreground font-medium text-right">Acciones</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tramitesList.map((tramite) => (
              <TableRow
                key={`${tramite.tipo}-${tramite.id}`}
                className={`hover:bg-muted/20 cursor-pointer ${showDeleted && selectedForDeletion.has(tramite.id) ? 'bg-destructive/10' : ''}`}
                onClick={() => {
                  if (!showDeleted) {
                    setSelectedTramite({ id: tramite.id, tipo: tramite.tipo });
                    setDetailOpen(true);
                  }
                }}
              >
                {showDeleted && (
                  <TableCell className="w-10 p-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedForDeletion.has(tramite.id)}
                      onCheckedChange={() => toggleTramiteSelection(tramite.id)}
                      aria-label={`Seleccionar ${tramite.folio}`}
                    />
                  </TableCell>
                )}
                <TableCell className="w-4 p-2">
                  {tramite.tipo === "Requisición" && tramite.tipoRequisicionId ? (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: `hsl(${getTipoColor(tramite.tipoRequisicionId)})`,
                      }}
                      title={getTipoNombre(tramite.tipoRequisicionId)}
                    />
                  ) : tramite.tipo === "Reposición" ? (
                    <div
                      className="w-3 h-3 rounded-full bg-blue-500"
                      title="Reposición"
                    />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-muted" />
                  )}
                </TableCell>
                <TableCell className="text-primary font-medium">
                  {tramite.folio}
                </TableCell>
                <TableCell className="text-foreground">
                  {tramite.tipo}
                </TableCell>
                <TableCell className="text-foreground text-sm">
                  {tramite.asunto || "-"}
                </TableCell>
                <TableCell className="text-foreground">
                  {formatFecha(tramite.fecha)}
                </TableCell>
                <TableCell className="text-foreground">
                  {tramite.solicitante}
                </TableCell>
                <TableCell>
                  <Badge
                    className={`${
                      estadoColors[tramite.estado] || estadoColors.borrador
                    } border-0`}
                  >
                    {estadoLabels[tramite.estado] || tramite.estado}
                  </Badge>
                </TableCell>
                {showDeleted && tramite.deleted_at && (
                  <TableCell className="text-muted-foreground text-sm">
                    {formatFecha(tramite.deleted_at)}
                  </TableCell>
                )}
                {showDeleted && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-primary hover:text-primary"
                        onClick={() => handleRestoreTramite(tramite)}
                        title="Restaurar"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive hover:text-destructive"
                            title="Eliminar permanentemente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar permanentemente?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. El trámite <strong>{tramite.folio}</strong> y todos sus datos asociados serán eliminados permanentemente del sistema.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handlePermanentDelete(tramite)}
                            >
                              Eliminar permanentemente
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderSearch className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-foreground">Consulta de Trámites</CardTitle>
                <p className="text-muted-foreground text-sm">
                  {isSuperadmin
                    ? "Vista de todos los trámites"
                    : isAdmin
                    ? "Trámites asignados y creados"
                    : isComprador
                    ? "Requisiciones aprobadas y en licitación"
                    : isAutorizador
                    ? "Trámites pendientes de autorización"
                    : isPresupuestos
                    ? "Pedidos colocados para autorizar"
                    : isTesoreria
                    ? "Pedidos autorizados para pagar"
                    : "Mis trámites"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Notifications Bell */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="relative text-muted-foreground hover:text-foreground"
                  >
                    <Bell className="w-5 h-5" />
                    {rejectedTramites.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                        {rejectedTramites.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="p-4 border-b border-border">
                    <h4 className="font-semibold text-foreground">Notificaciones</h4>
                    <p className="text-sm text-muted-foreground">
                      Trámites que requieren tu atención
                    </p>
                  </div>
                  <ScrollArea className="max-h-80">
                    {rejectedTramites.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        No hay notificaciones pendientes
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {rejectedTramites.slice(0, 5).map((tramite) => (
                          <div
                            key={tramite.id}
                            className="p-3 hover:bg-muted/50 cursor-pointer"
                            onClick={() => {
                              setSelectedTramite({ id: tramite.id, tipo: tramite.tipo });
                              setDetailOpen(true);
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {tramite.folio} rechazada
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Revisa la justificación del rechazo
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {rejectedTramites.length > 5 && (
                          <div className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActiveTab("rechazadas")}
                            >
                              Ver todas ({rejectedTramites.length})
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              
              <Button
                variant="outline"
                onClick={() => {
                  fetchTramites();
                  toast.success("Lista actualizada");
                }}
                disabled={loading}
                className="text-muted-foreground hover:text-foreground"
                title="Actualizar lista"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Panel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por folio, tipo, solicitante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background border-border"
                />
              </div>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-full sm:w-[200px] bg-background border-border">
                  <SelectValue placeholder="Todos los Trámites" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="todos">Todos los Trámites</SelectItem>
                  <SelectItem value="requisicion">Requisiciones</SelectItem>
                  <SelectItem value="reposicion">Reposiciones</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabs based on role */}
            {isSuperadmin ? (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="activos">Activos</TabsTrigger>
                  <TabsTrigger value="borrados" className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Borrados ({deletedTramites.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="activos">
                  {renderTramitesTable(filteredTramites)}
                </TabsContent>
                <TabsContent value="borrados">
                  {/* Bulk actions bar */}
                  {selectedForDeletion.size > 0 && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {selectedForDeletion.size} trámite(s) seleccionado(s)
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedForDeletion(new Set())}
                        >
                          Deseleccionar todo
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowBulkDeleteConfirm(true)}
                          disabled={bulkDeleteLoading}
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          {bulkDeleteLoading ? "Eliminando..." : "Eliminar seleccionados"}
                        </Button>
                      </div>
                    </div>
                  )}
                  {renderTramitesTable(deletedTramites, true)}
                </TabsContent>
              </Tabs>
            ) : showAttendedTab && showRejectedTab ? (
              // Comprador: shows both Atendidas and Rechazadas tabs
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="activos">Pendientes</TabsTrigger>
                  <TabsTrigger value="atendidos" className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Atendidos ({attendedTramites.length})
                  </TabsTrigger>
                  <TabsTrigger value="rechazadas" className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Rechazadas ({rejectedTramites.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="activos">
                  {renderTramitesTable(filteredTramites)}
                </TabsContent>
                <TabsContent value="atendidos">
                  {renderTramitesTable(filteredAttendedTramites)}
                </TabsContent>
                <TabsContent value="rechazadas">
                  {renderTramitesTable(filteredRejectedTramites)}
                </TabsContent>
              </Tabs>
            ) : showAttendedTab ? (
              // Autorizador, Presupuestos, Tesoreria: only Atendidos tab
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="activos">Pendientes</TabsTrigger>
                  <TabsTrigger value="atendidos" className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Atendidos ({attendedTramites.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="activos">
                  {renderTramitesTable(filteredTramites)}
                </TabsContent>
                <TabsContent value="atendidos">
                  {renderTramitesTable(filteredAttendedTramites)}
                </TabsContent>
              </Tabs>
            ) : showRejectedTab ? (
              // Solicitador: only Rechazadas tab
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="activos">Mis Trámites</TabsTrigger>
                  <TabsTrigger value="rechazadas" className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Rechazadas ({rejectedTramites.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="activos">
                  {renderTramitesTable(filteredTramites)}
                </TabsContent>
                <TabsContent value="rechazadas">
                  {renderTramitesTable(filteredRejectedTramites)}
                </TabsContent>
              </Tabs>
            ) : (
              renderTramitesTable(filteredTramites)
            )}
          </CardContent>
        </Card>

        <TramiteDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          tramiteId={selectedTramite?.id || null}
          tramiteTipo={selectedTramite?.tipo || null}
          onUpdated={fetchTramites}
        />

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                ¿Eliminar {selectedForDeletion.size} trámite(s) permanentemente?
              </AlertDialogTitle>
              <AlertDialogDescription>
                <strong className="text-destructive">Esta acción es permanente e irreversible.</strong>
                <br /><br />
                Los siguientes trámites y todos sus datos asociados serán eliminados definitivamente:
                <ul className="mt-2 text-sm max-h-32 overflow-y-auto">
                  {deletedTramites
                    .filter(t => selectedForDeletion.has(t.id))
                    .map(t => (
                      <li key={t.id} className="py-0.5">• {t.folio} ({t.tipo})</li>
                    ))}
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleBulkPermanentDelete}
              >
                Eliminar permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Tramites;
