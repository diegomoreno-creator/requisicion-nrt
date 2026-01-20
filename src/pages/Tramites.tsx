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
import { ArrowLeft, CheckCircle, FolderSearch, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import TramiteDetailDialog from "@/components/TramiteDetailDialog";
import { useCatalogos } from "@/hooks/useCatalogos";

interface Tramite {
  id: string;
  folio: string;
  tipo: "Requisición" | "Reposición";
  tipoRequisicionId?: string | null;
  fecha: string;
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
  const [deletedTramites, setDeletedTramites] = useState<Tramite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [selectedTramite, setSelectedTramite] = useState<{
    id: string;
    tipo: "Requisición" | "Reposición";
  } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("activos");

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
      const { data: requisiciones, error: reqError } = await supabase
        .from("requisiciones")
        .select("id, folio, created_at, solicitado_por, estado, tipo_requisicion, deleted_at, autorizado_por, licitado_por, pedido_colocado_por, pedido_autorizado_por, pagado_por")
        .order("created_at", { ascending: false });

      if (reqError) {
        console.error("Error fetching requisiciones:", reqError);
      }

      // Fetch reposiciones - RLS policies will handle visibility
      const { data: reposiciones, error: repoError } = await supabase
        .from("reposiciones")
        .select("id, folio, fecha_solicitud, solicitado_por, estado, autorizado_por, pagado_por")
        .order("created_at", { ascending: false });

      if (repoError) {
        console.error("Error fetching reposiciones:", repoError);
      }

      // Get all unique user IDs to fetch their emails
      const userIds = new Set<string>();
      requisiciones?.forEach((r) => userIds.add(r.solicitado_por));
      reposiciones?.forEach((r) => userIds.add(r.solicitado_por));

      // Fetch user emails from profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", Array.from(userIds));

      const userMap = new Map<string, string>();
      profiles?.forEach((p) => {
        userMap.set(p.user_id, p.full_name || p.email || "Usuario");
      });

      // Combine and format tramites - separate active, attended, and deleted
      const activeTramites: Tramite[] = [];
      const attended: Tramite[] = [];
      const deleted: Tramite[] = [];
      
      const processorField = getProcessorField();

      requisiciones?.forEach((r) => {
        const tramite: Tramite = {
          id: r.id,
          folio: r.folio,
          tipo: "Requisición",
          tipoRequisicionId: r.tipo_requisicion,
          fecha: r.created_at,
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

      // Sort by date descending
      activeTramites.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      attended.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      deleted.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      setTramites(activeTramites);
      setAttendedTramites(attended);
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

  // Check if current user role shows attended tab (not for comprador, superadmin, admin, solicitador)
  const showAttendedTab = isAutorizador || isPresupuestos || isTesoreria;

  const formatFecha = (fecha: string) => {
    try {
      return format(new Date(fecha), "d/M/yyyy", { locale: es });
    } catch {
      return fecha;
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
              <TableHead className="text-muted-foreground font-medium w-4"></TableHead>
              <TableHead className="text-muted-foreground font-medium">Folio</TableHead>
              <TableHead className="text-muted-foreground font-medium">Tipo de Trámite</TableHead>
              <TableHead className="text-muted-foreground font-medium">Fecha</TableHead>
              <TableHead className="text-muted-foreground font-medium">Solicitante</TableHead>
              <TableHead className="text-muted-foreground font-medium">Estado</TableHead>
              {showDeleted && (
                <TableHead className="text-muted-foreground font-medium">Borrado</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tramitesList.map((tramite) => (
              <TableRow
                key={`${tramite.tipo}-${tramite.id}`}
                className="hover:bg-muted/20 cursor-pointer"
                onClick={() => {
                  setSelectedTramite({ id: tramite.id, tipo: tramite.tipo });
                  setDetailOpen(true);
                }}
              >
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
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Panel
            </Button>
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
                  {renderTramitesTable(deletedTramites, true)}
                </TabsContent>
              </Tabs>
            ) : showAttendedTab ? (
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
      </div>
    </div>
  );
};

export default Tramites;
