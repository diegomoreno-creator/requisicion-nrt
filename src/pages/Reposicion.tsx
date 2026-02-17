import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCatalogos } from "@/hooks/useCatalogos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowLeft, Plus, Trash2, CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import ReposicionFileUploadSection from "@/components/ReposicionFileUploadSection";

interface UploadedFile {
  id?: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
}

interface Gasto {
  id: string;
  unidad_negocio_id: string;
  empresa_id: string;
  descripcion: string;
  departamento: string;
  proveedor_negocio: string;
  fecha_gasto: Date | null;
  factura_no: string;
  importe: number;
}

interface AutorizadorOption {
  user_id: string;
  email: string;
  full_name: string | null;
}

interface RevisorOption {
  user_id: string;
  email: string;
  full_name: string | null;
}

const Reposicion = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEditMode = !!editId;
  const { user, loading: authLoading, canAccessApp, isSolicitador, isSuperadmin, isAdmin } = useAuth();
  const { 
    empresas, 
    getUnidadesByEmpresa,
    loading: catalogosLoading 
  } = useCatalogos();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [autorizadores, setAutorizadores] = useState<AutorizadorOption[]>([]);
  const [revisores, setRevisores] = useState<RevisorOption[]>([]);
  const [originalReposicionId, setOriginalReposicionId] = useState<string | null>(null);

  // Form state
  const [folio, setFolio] = useState("");
  const [fechaSolicitud, setFechaSolicitud] = useState<Date>(new Date());
  const [gastosSemana, setGastosSemana] = useState("");
  const [autorizadorId, setAutorizadorId] = useState("");
  const [revisorId, setRevisorId] = useState("");
  const [tipoReposicion, setTipoReposicion] = useState("gastos_semanales");
  const [banco, setBanco] = useState("");
  const [cuentaClabe, setCuentaClabe] = useState("");
  const [reponerA, setReponerA] = useState("");
  const [asunto, setAsunto] = useState("");
  const [justificacion, setJustificacion] = useState("");

  // Gastos state
  const [gastos, setGastos] = useState<Gasto[]>([
    {
      id: crypto.randomUUID(),
      unidad_negocio_id: "",
      empresa_id: "",
      descripcion: "",
      departamento: "",
      proveedor_negocio: "",
      fecha_gasto: new Date(),
      factura_no: "",
      importe: 0,
    },
  ]);

  // Files state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [reposicionIdForFiles, setReposicionIdForFiles] = useState<string>(crypto.randomUUID());

  // Calculate total
  const montoTotal = gastos.reduce((sum, g) => sum + (g.importe || 0), 0);

  useEffect(() => {
    if (!authLoading && !canAccessApp) {
      navigate("/");
    }
  }, [authLoading, canAccessApp, navigate]);

  useEffect(() => {
    fetchAutorizadores();
    fetchRevisores();
  }, []);

  // Load existing reposición data for editing
  useEffect(() => {
    if (editId && user) {
      loadReposicionForEdit(editId);
    }
  }, [editId, user]);

  const loadReposicionForEdit = async (reposicionId: string) => {
    setIsLoadingEdit(true);
    try {
      // Fetch reposición
      const { data: repo, error: repoError } = await supabase
        .from("reposiciones")
        .select("*")
        .eq("id", reposicionId)
        .single();

      if (repoError) throw repoError;
      if (!repo) {
        toast.error("Reposición no encontrada");
        navigate("/tramites");
        return;
      }

      // Check if user owns this reposición
      if (repo.solicitado_por !== user?.id) {
        toast.error("No tienes permiso para editar esta reposición");
        navigate("/tramites");
        return;
      }

      // Can edit if pending or rejected
      const isPending = repo.estado === "pendiente";
      const isRejected = repo.estado === "rechazado";
      
      if (!isPending && !isRejected) {
        toast.error("Solo puedes editar reposiciones pendientes o rechazadas");
        navigate("/tramites");
        return;
      }

      // Load reposición data into form
      setFolio(repo.folio);
      setOriginalReposicionId(repo.id);
      setFechaSolicitud(new Date(repo.fecha_solicitud));
      setGastosSemana(repo.gastos_semana?.toString() || "");
      setAutorizadorId(repo.autorizador_id || "");
      setRevisorId((repo as any).revisor_id || "");
      setTipoReposicion(repo.tipo_reposicion || "gastos_semanales");
      setBanco(repo.banco || "");
      setCuentaClabe(repo.cuenta_clabe || "");
      setReponerA(repo.reponer_a || "");
      setAsunto((repo as any).asunto || "");
      setJustificacion(repo.justificacion || "");

      // Fetch gastos
      const { data: gastosData, error: gastosError } = await supabase
        .from("reposicion_gastos")
        .select("*")
        .eq("reposicion_id", reposicionId);

      if (gastosError) throw gastosError;

      if (gastosData && gastosData.length > 0) {
        setGastos(gastosData.map(g => ({
          id: g.id,
          unidad_negocio_id: g.unidad_negocio_id || "",
          empresa_id: g.empresa_id || "",
          descripcion: g.descripcion || "",
          departamento: g.departamento || "",
          proveedor_negocio: g.proveedor_negocio || "",
          fecha_gasto: g.fecha_gasto ? new Date(g.fecha_gasto) : null,
          factura_no: g.factura_no || "",
          importe: g.importe || 0,
        })));
      }

      // Fetch existing files
      const { data: filesData } = await supabase
        .from("reposicion_archivos" as any)
        .select("*")
        .eq("reposicion_id", reposicionId);

      if (filesData && filesData.length > 0) {
        setUploadedFiles(filesData.map((f: any) => ({
          id: f.id,
          file_name: f.file_name,
          file_url: f.file_url,
          file_type: f.file_type || undefined,
          file_size: f.file_size || undefined,
        })));
      }

      setReposicionIdForFiles(reposicionId);

    } catch (error) {
      console.error("Error loading reposición:", error);
      toast.error("Error al cargar la reposición");
      navigate("/tramites");
    } finally {
      setIsLoadingEdit(false);
    }
  };

  const fetchAutorizadores = async () => {
    try {
      const { data, error } = await supabase.rpc('get_autorizadores');
      if (error) throw error;
      setAutorizadores(data || []);
    } catch (error) {
      console.error("Error fetching autorizadores:", error);
    }
  };

  const fetchRevisores = async () => {
    try {
      const { data, error } = await supabase.rpc('get_revisores');
      if (error) throw error;
      setRevisores(data || []);
    } catch (error) {
      console.error("Error fetching revisores:", error);
    }
  };

  const addGasto = () => {
    const newGasto: Gasto = {
      id: crypto.randomUUID(),
      unidad_negocio_id: "",
      empresa_id: "",
      descripcion: "",
      departamento: "",
      proveedor_negocio: "",
      fecha_gasto: new Date(),
      factura_no: "",
      importe: 0,
    };
    setGastos([...gastos, newGasto]);
  };

  const removeGasto = (id: string) => {
    if (gastos.length === 1) {
      toast.error("Debe haber al menos un gasto");
      return;
    }
    setGastos(gastos.filter((g) => g.id !== id));
  };

  const updateGasto = (id: string, field: keyof Gasto, value: any) => {
    setGastos(
      gastos.map((g) => {
        if (g.id === id) {
          // If empresa changes, reset unidad
          if (field === "empresa_id") {
            return { ...g, [field]: value, unidad_negocio_id: "" };
          }
          return { ...g, [field]: value };
        }
        return g;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("Debes iniciar sesión");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && originalReposicionId) {
        // Update existing reposición
        const { error: repoError } = await supabase
          .from("reposiciones")
          .update({
            fecha_solicitud: fechaSolicitud?.toISOString().split("T")[0],
            gastos_semana: gastosSemana ? parseFloat(gastosSemana) : 0,
            autorizador_id: autorizadorId || null,
            revisor_id: revisorId || null,
            monto_total: montoTotal,
            tipo_reposicion: tipoReposicion,
            banco: tipoReposicion === "colaborador" ? banco : null,
            cuenta_clabe: tipoReposicion === "colaborador" ? cuentaClabe : null,
            reponer_a: reponerA,
            asunto,
            justificacion,
            estado: "pendiente",
            justificacion_rechazo: null,
            justificacion_devolucion_revision: null,
          } as any)
          .eq("id", originalReposicionId);

        if (repoError) throw repoError;

        // Delete existing gastos and re-insert
        const { error: deleteGastosError } = await supabase
          .from("reposicion_gastos")
          .delete()
          .eq("reposicion_id", originalReposicionId);

        if (deleteGastosError) throw deleteGastosError;

        // Insert updated gastos
        const gastosToInsert = gastos.map((g) => ({
          reposicion_id: originalReposicionId,
          unidad_negocio_id: g.unidad_negocio_id || null,
          empresa_id: g.empresa_id || null,
          descripcion: g.descripcion,
          departamento: g.departamento,
          proveedor_negocio: g.proveedor_negocio,
          fecha_gasto: g.fecha_gasto?.toISOString().split("T")[0],
          factura_no: g.factura_no,
          importe: g.importe,
        }));

        const { error: gastosError } = await supabase
          .from("reposicion_gastos")
          .insert(gastosToInsert);

        if (gastosError) throw gastosError;

        // Save files metadata - update existing
        if (uploadedFiles.length > 0) {
          // Delete existing file records
          await supabase
            .from("reposicion_archivos" as any)
            .delete()
            .eq("reposicion_id", originalReposicionId);

          // Insert updated files
          const filesToInsert = uploadedFiles.map((f) => ({
            reposicion_id: originalReposicionId,
            file_name: f.file_name,
            file_url: f.file_url,
            file_type: f.file_type,
            file_size: f.file_size,
            uploaded_by: user.id,
          }));

          await supabase.from("reposicion_archivos" as any).insert(filesToInsert);
        }

        toast.success("Reposición actualizada exitosamente");
      } else {
        // Get sequential folio from database
        const { data: folioData, error: folioError } = await supabase.rpc('get_next_folio', { sequence_type: 'reposiciones' });
        if (folioError) throw folioError;
        const newFolio = folioData as string;

        // Determine initial estado based on revision
        const selectedEmpresaForRevision = gastos[0]?.empresa_id ? empresas.find(e => e.id === gastos[0].empresa_id) : null;
        const revisionEnabled = selectedEmpresaForRevision?.revision_habilitada && revisorId;
        const finalEstado = revisionEnabled ? "pendiente_revision" : "pendiente";

        // Insert new reposición
        const { data: reposicion, error: repoError } = await supabase
          .from("reposiciones")
          .insert({
            folio: newFolio,
            fecha_solicitud: fechaSolicitud?.toISOString().split("T")[0],
            solicitado_por: user.id,
            gastos_semana: gastosSemana ? parseFloat(gastosSemana) : 0,
            autorizador_id: autorizadorId || null,
            revisor_id: revisorId || null,
            monto_total: montoTotal,
            tipo_reposicion: tipoReposicion,
            banco: tipoReposicion === "colaborador" ? banco : null,
            cuenta_clabe: tipoReposicion === "colaborador" ? cuentaClabe : null,
            reponer_a: reponerA,
            asunto,
            justificacion,
            estado: finalEstado,
          } as any)
          .select()
          .single();

        if (repoError) throw repoError;

        // Insert gastos
        const gastosToInsert = gastos.map((g) => ({
          reposicion_id: reposicion.id,
          unidad_negocio_id: g.unidad_negocio_id || null,
          empresa_id: g.empresa_id || null,
          descripcion: g.descripcion,
          departamento: g.departamento,
          proveedor_negocio: g.proveedor_negocio,
          fecha_gasto: g.fecha_gasto?.toISOString().split("T")[0],
          factura_no: g.factura_no,
          importe: g.importe,
        }));

        const { error: gastosError } = await supabase
          .from("reposicion_gastos")
          .insert(gastosToInsert);

        if (gastosError) throw gastosError;

        // Save files metadata for new reposicion
        if (uploadedFiles.length > 0) {
          const filesToInsert = uploadedFiles.map((f) => ({
            reposicion_id: reposicion.id,
            file_name: f.file_name,
            file_url: f.file_url,
            file_type: f.file_type,
            file_size: f.file_size,
            uploaded_by: user.id,
          }));

          await supabase.from("reposicion_archivos" as any).insert(filesToInsert);
        }

        toast.success("Reposición guardada exitosamente");
      }
      
      navigate("/tramites");
    } catch (error: any) {
      console.error("Error saving reposicion:", error);
      toast.error(error.message || "Error al guardar la reposición");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoadingEdit) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-2xl font-bold text-primary">
            {isEditMode ? "Editar Reposición" : "Formato de Reposición"}
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="border-border bg-card mb-6">
            <CardContent className="p-6 space-y-6">
              {/* Row: Folio, Fecha */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Folio</Label>
                  <Input
                    value={folio || "Se asignará automáticamente"}
                    placeholder="Se asignará automáticamente"
                    className="bg-muted border-border text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Fecha de solicitud de reposición</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-input border-border",
                          !fechaSolicitud && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaSolicitud
                          ? format(fechaSolicitud, "dd/MM/yyyy", { locale: es })
                          : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border z-50">
                      <Calendar
                        mode="single"
                        selected={fechaSolicitud}
                        onSelect={(date) => date && setFechaSolicitud(date)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Row: Solicitado por, Gastos de semana, Autorizador */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Solicitado por</Label>
                  <Input
                    value={user?.email || ""}
                    disabled
                    className="bg-muted border-border text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Gastos de semana (MXN)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={gastosSemana}
                    onChange={(e) => setGastosSemana(e.target.value)}
                    placeholder="0.00"
                    className="bg-input border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Autorizador</Label>
                  <Select value={autorizadorId} onValueChange={setAutorizadorId}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Seleccione un autorizador" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border z-50">
                      {autorizadores.map((aut) => (
                        <SelectItem key={aut.user_id} value={aut.user_id}>
                          {aut.full_name || aut.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Revisor selector - only show if any empresa has revision_habilitada */}
                {empresas.some(e => e.revision_habilitada) && revisores.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-foreground">Revisor <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                    <Select value={revisorId} onValueChange={setRevisorId}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Seleccione un revisor" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border z-50">
                        {revisores.map((rev) => (
                          <SelectItem key={rev.user_id} value={rev.user_id}>
                            {rev.full_name || rev.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Gastos a reponer Section */}
              <div className="space-y-4">
                <Label className="text-foreground text-lg font-semibold">Gastos a reponer</Label>
                <div className="rounded-md border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground">Empresa</TableHead>
                        <TableHead className="text-muted-foreground">Unidad</TableHead>
                        <TableHead className="text-muted-foreground">Descripción</TableHead>
                        <TableHead className="text-muted-foreground">Departamento</TableHead>
                        <TableHead className="text-muted-foreground">Proveedor/Negocio</TableHead>
                        <TableHead className="text-muted-foreground w-36">Fecha de gasto</TableHead>
                        <TableHead className="text-muted-foreground">Factura No.</TableHead>
                        <TableHead className="text-muted-foreground w-28">Importe ($)</TableHead>
                        <TableHead className="text-muted-foreground w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gastos.map((gasto) => (
                        <TableRow key={gasto.id} className="border-border">
                          <TableCell>
                            <Select
                              value={gasto.empresa_id}
                              onValueChange={(value) => updateGasto(gasto.id, "empresa_id", value)}
                            >
                              <SelectTrigger className="bg-input border-border min-w-28">
                                <SelectValue placeholder="Seleccione..." />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border z-50">
                                {empresas.map((emp) => (
                                  <SelectItem key={emp.id} value={emp.id}>
                                    {emp.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={gasto.unidad_negocio_id}
                              onValueChange={(value) => updateGasto(gasto.id, "unidad_negocio_id", value)}
                              disabled={!gasto.empresa_id}
                            >
                              <SelectTrigger className="bg-input border-border min-w-28">
                                <SelectValue placeholder={gasto.empresa_id ? "Seleccione..." : "Primero empresa"} />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border z-50">
                                {getUnidadesByEmpresa(gasto.empresa_id).map((unidad) => (
                                  <SelectItem key={unidad.id} value={unidad.id}>
                                    {unidad.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={gasto.descripcion}
                              onChange={(e) => updateGasto(gasto.id, "descripcion", e.target.value)}
                              placeholder="Descripción"
                              className="bg-input border-border min-w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={gasto.departamento}
                              onChange={(e) => updateGasto(gasto.id, "departamento", e.target.value)}
                              placeholder="Departamento"
                              className="bg-input border-border min-w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={gasto.proveedor_negocio}
                              onChange={(e) => updateGasto(gasto.id, "proveedor_negocio", e.target.value)}
                              placeholder="Proveedor o Negocio"
                              className="bg-input border-border min-w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={cn(
                                    "w-full justify-start text-left font-normal bg-input border-border",
                                    !gasto.fecha_gasto && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-1 h-3 w-3" />
                                  {gasto.fecha_gasto
                                    ? format(gasto.fecha_gasto, "dd/MM/yy", { locale: es })
                                    : "Fecha"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 bg-card border-border z-50">
                                <Calendar
                                  mode="single"
                                  selected={gasto.fecha_gasto || undefined}
                                  onSelect={(date) => updateGasto(gasto.id, "fecha_gasto", date)}
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={gasto.factura_no}
                              onChange={(e) => updateGasto(gasto.id, "factura_no", e.target.value)}
                              placeholder="Factura"
                              className="bg-input border-border min-w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={gasto.importe || ""}
                              onChange={(e) =>
                                updateGasto(gasto.id, "importe", parseFloat(e.target.value) || 0)
                              }
                              placeholder="0"
                              className="bg-input border-border w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeGasto(gasto.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addGasto}
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Gasto
                  </Button>
                </div>
              </div>

              {/* Row: Monto total, Tipo de reposición */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Monto total a reponer ($)</Label>
                  <Input
                    value={montoTotal.toFixed(2)}
                    disabled
                    className="bg-muted border-border text-muted-foreground font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Reposición de:</Label>
                  <Select value={tipoReposicion} onValueChange={setTipoReposicion}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border z-50">
                      <SelectItem value="gastos_semanales">Gastos Semanales</SelectItem>
                      <SelectItem value="colaborador">Colaborador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Campos adicionales para Colaborador */}
              {tipoReposicion === "colaborador" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">Banco</Label>
                    <Input
                      value={banco}
                      onChange={(e) => setBanco(e.target.value)}
                      placeholder="Nombre del banco"
                      className="bg-input border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">Cuenta/CLABE/Tarjeta</Label>
                    <Input
                      value={cuentaClabe}
                      onChange={(e) => setCuentaClabe(e.target.value)}
                      placeholder="Cuenta, CLABE o Tarjeta"
                      className="bg-input border-border"
                    />
                  </div>
                </div>
              )}

              {/* Reponer a */}
              <div className="space-y-2">
                <Label className="text-foreground">Reponer a sucursal/Unidad o Nombre de Colaborador:</Label>
                <Input
                  value={reponerA}
                  onChange={(e) => setReponerA(e.target.value)}
                  placeholder="Escriba aquí..."
                  className="bg-input border-border"
                />
              </div>

              {/* Asunto */}
              <div className="space-y-2">
                <Label className="text-foreground">Asunto:</Label>
                <Input
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  placeholder="Describe brevemente el asunto de la reposición"
                  className="bg-input border-border"
                />
              </div>

              {/* Justificación */}
              <div className="space-y-2">
                <Label className="text-foreground">Justificación:</Label>
                <Textarea
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  placeholder="Describe la justificación de la reposición."
                  rows={4}
                  className="bg-input border-border resize-none"
                />
              </div>

              {/* Files section */}
              {user && (
                <ReposicionFileUploadSection
                  reposicionId={isEditMode && originalReposicionId ? originalReposicionId : reposicionIdForFiles}
                  userId={user.id}
                  files={uploadedFiles}
                  onFilesChange={setUploadedFiles}
                  disabled={false}
                />
              )}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
};

export default Reposicion;