import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCatalogos } from "@/hooks/useCatalogos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import FileUploadSection from "@/components/FileUploadSection";

interface Partida {
  id: string;
  numero_partida: number;
  descripcion: string;
  modelo_parte: string;
  unidad_medida: string;
  cantidad: number;
  fecha_necesidad: Date | null;
  tipo_gasto: string;
  categoria_gasto: string;
  costo_estimado: number | null;
  sucursal: string;
}

// Categorías de gasto por tipo
const categoriasGasto: Record<string, string[]> = {
  administrativo: [
    "Arreglos, festejos y festividades",
    "Arrendamiento de equipo de oficina",
    "Asesorías, cursos y capacitación no técnica",
    "Papelería y consumibles",
    "Cuotas y suscripciones",
    "Gastos de oficina",
    "Impuestos y derechos",
    "Licenciamiento administrativo",
    "Servicios y renta de línea",
    "Mantenimiento y conservación",
    "Servicios y líneas de celular",
    "Pagos trámites administrativos",
    "Préstamos",
    "Productos de limpieza",
    "Renta de oficinas",
    "Seguros y pólizas",
    "Uniformes",
    "Viáticos",
  ],
  operativo: [
    "Arrendamiento de espacio o infraestructura",
    "Capacitación técnica",
    "CFE, fuentes, postería",
    "Comisiones de operación",
    "Consultoría técnica",
    "Coubicación",
    "Desarrollo de software",
    "Equipo para la operación",
    "Equipos terminales",
    "Gastos relacionados con equipo de transporte",
    "Herramientas",
    "Licenciamiento operativo",
    "Material de instalación",
    "Operación de canal/radio",
    "Otros gastos operativos",
    "Pagos a ei!",
    "Pagos a Optifibra",
    "Publicidad",
    "Señales",
    "Servicios de internet",
    "Soporte técnico, Hosting",
    "Starlink",
  ],
  proyecto_inversion: [
    "Celulares",
    "Construcción",
    "Equipo de cómputo",
    "Equipo de oficina",
    "Equipo de transporte",
    "Fibra óptica",
    "Infraestructura de red",
    "Licencias de software",
    "Maquinaria y equipo",
    "Mobiliario",
    "Otros activos fijos",
  ],
};

interface UserOption {
  user_id: string;
  email: string;
  full_name: string | null;
}

const Requisicion = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEditMode = !!editId;
  const { user, loading: authLoading, canAccessApp, isSolicitador, isSuperadmin, isAdmin } = useAuth();
  const { 
    tiposRequisicion, 
    empresas, 
    sucursales, 
    getUnidadesByEmpresa,
    loading: catalogosLoading 
  } = useCatalogos();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [autorizadores, setAutorizadores] = useState<UserOption[]>([]);
  const [originalRequisicionId, setOriginalRequisicionId] = useState<string | null>(null);
  const [wasRejected, setWasRejected] = useState(false); // Track if editing a rejected requisition

  // Form state
  const [folio, setFolio] = useState(`REQ-${Date.now()}`);
  const [tipoRequisicion, setTipoRequisicion] = useState("");
  const [unidadNegocio, setUnidadNegocio] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [fechaAutorizacion, setFechaAutorizacion] = useState<Date>(new Date());
  const [sucursal, setSucursal] = useState("");
  const [autorizadorId, setAutorizadorId] = useState("");
  const [departamentoSolicitante, setDepartamentoSolicitante] = useState("");
  const [presupuestoAproximado, setPresupuestoAproximado] = useState("");
  const [seDividiraGasto, setSeDividiraGasto] = useState(false);
  const [unDivisionGasto, setUnDivisionGasto] = useState("");
  const [porcentajeCadaUn, setPorcentajeCadaUn] = useState("");
  const [datosProveedor, setDatosProveedor] = useState("");
  const [datosBanco, setDatosBanco] = useState("");
  const [nombreProyecto, setNombreProyecto] = useState("");
  const [asunto, setAsunto] = useState("");
  const [justificacion, setJustificacion] = useState("");

  // Files state
  interface UploadedFile {
    id?: string;
    file_name: string;
    file_url: string;
    file_type?: string;
    file_size?: number;
  }
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [requisicionIdForFiles, setRequisicionIdForFiles] = useState<string>(crypto.randomUUID());
  const [partidas, setPartidas] = useState<Partida[]>([
    {
      id: crypto.randomUUID(),
      numero_partida: 1,
      descripcion: "",
      modelo_parte: "",
      unidad_medida: "",
      cantidad: 1,
      fecha_necesidad: new Date(),
      tipo_gasto: "",
      categoria_gasto: "",
      costo_estimado: null,
      sucursal: "",
    },
  ]);

  // Calculate approximate budget from sum of all partidas' costo_estimado
  useEffect(() => {
    const total = partidas.reduce((sum, p) => sum + (p.costo_estimado || 0), 0);
    setPresupuestoAproximado(total > 0 ? total.toString() : "");
  }, [partidas]);

  useEffect(() => {
    if (!authLoading && !canAccessApp && !isEditMode) {
      navigate("/");
    }
  }, [authLoading, canAccessApp, navigate, isEditMode]);

  useEffect(() => {
    fetchAutorizadores();
  }, []);

  // Load existing requisicion data for editing
  useEffect(() => {
    if (editId && user) {
      loadRequisicionForEdit(editId);
    }
  }, [editId, user]);

  const loadRequisicionForEdit = async (requisicionId: string) => {
    setIsLoadingEdit(true);
    try {
      // Fetch requisicion
      const { data: req, error: reqError } = await supabase
        .from("requisiciones")
        .select("*")
        .eq("id", requisicionId)
        .single();

      if (reqError) throw reqError;
      if (!req) {
        toast.error("Requisición no encontrada");
        navigate("/tramites");
        return;
      }

      // Check if user owns this requisition
      if (req.solicitado_por !== user?.id) {
        toast.error("No tienes permiso para editar esta requisición");
        navigate("/tramites");
        return;
      }

      // Can edit if pending or rejected
      const isPending = req.estado === "pendiente" && !req.deleted_at;
      const isRejected = req.estado === "rechazado" && !req.deleted_at;
      
      if (!isPending && !isRejected) {
        toast.error("Solo puedes editar requisiciones pendientes o rechazadas");
        navigate("/tramites");
        return;
      }

      // Track if this is a rejected requisition being resubmitted
      setWasRejected(isRejected);

      // Load requisicion data into form
      setFolio(req.folio);
      setOriginalRequisicionId(req.id);
      setTipoRequisicion(req.tipo_requisicion || "");
      setEmpresa(req.empresa || "");
      setUnidadNegocio(req.unidad_negocio || "");
      setSucursal(req.sucursal || "");
      setAutorizadorId(req.autorizador_id || "");
      setDepartamentoSolicitante(req.departamento_solicitante || "");
      setPresupuestoAproximado(req.presupuesto_aproximado?.toString() || "");
      setSeDividiraGasto(req.se_dividira_gasto || false);
      setUnDivisionGasto(req.un_division_gasto || "");
      setPorcentajeCadaUn(req.porcentaje_cada_un || "");
      setDatosProveedor(req.datos_proveedor || "");
      setDatosBanco(req.datos_banco || "");
      setNombreProyecto(req.nombre_proyecto || "");
      setAsunto(req.asunto || "");
      setJustificacion(req.justificacion || "");
      if (req.fecha_autorizacion) {
        setFechaAutorizacion(new Date(req.fecha_autorizacion));
      }

      // Fetch partidas
      const { data: partidasData, error: partidasError } = await supabase
        .from("requisicion_partidas")
        .select("*")
        .eq("requisicion_id", requisicionId)
        .order("numero_partida", { ascending: true });

      if (partidasError) throw partidasError;

      if (partidasData && partidasData.length > 0) {
        setPartidas(partidasData.map(p => ({
          id: p.id,
          numero_partida: p.numero_partida,
          descripcion: p.descripcion || "",
          modelo_parte: p.modelo_parte || "",
          unidad_medida: p.unidad_medida || "",
          cantidad: p.cantidad || 1,
          fecha_necesidad: p.fecha_necesidad ? new Date(p.fecha_necesidad) : null,
          tipo_gasto: p.tipo_gasto || "",
          categoria_gasto: p.categoria_gasto || "",
          costo_estimado: (p as any).costo_estimado ?? null,
          sucursal: (p as any).sucursal || "",
        })));
      }

      // Fetch existing files
      const { data: filesData } = await supabase
        .from("requisicion_archivos")
        .select("*")
        .eq("requisicion_id", requisicionId);

      if (filesData && filesData.length > 0) {
        setUploadedFiles(filesData.map(f => ({
          id: f.id,
          file_name: f.file_name,
          file_url: f.file_url,
          file_type: f.file_type || undefined,
          file_size: f.file_size || undefined,
        })));
      }

      setRequisicionIdForFiles(requisicionId);
    } catch (error) {
      console.error("Error loading requisicion:", error);
      toast.error("Error al cargar la requisición");
      navigate("/tramites");
    } finally {
      setIsLoadingEdit(false);
    }
  };

  const fetchAutorizadores = async () => {
    try {
      // Get only users with 'autorizador' role using the security definer function
      const { data, error } = await supabase.rpc('get_autorizadores');

      if (error) throw error;
      setAutorizadores(data || []);
    } catch (error) {
      console.error("Error fetching autorizadores:", error);
    }
  };

  const addPartida = () => {
    const newPartida: Partida = {
      id: crypto.randomUUID(),
      numero_partida: partidas.length + 1,
      descripcion: "",
      modelo_parte: "",
      unidad_medida: "",
      cantidad: 1,
      fecha_necesidad: new Date(),
      tipo_gasto: "",
      categoria_gasto: "",
      costo_estimado: null,
      sucursal: "",
    };
    setPartidas([...partidas, newPartida]);
  };

  const removePartida = (id: string) => {
    if (partidas.length === 1) {
      toast.error("Debe haber al menos una partida");
      return;
    }
    const updatedPartidas = partidas
      .filter((p) => p.id !== id)
      .map((p, index) => ({ ...p, numero_partida: index + 1 }));
    setPartidas(updatedPartidas);
  };

  const updatePartida = (id: string, field: keyof Partida, value: any) => {
    setPartidas(
      partidas.map((p) => {
        if (p.id !== id) return p;
        // Si cambia el tipo_gasto, limpiar la categoria_gasto
        if (field === "tipo_gasto" && p.tipo_gasto !== value) {
          return { ...p, [field]: value, categoria_gasto: "" };
        }
        return { ...p, [field]: value };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Debes iniciar sesión");
      return;
    }

    // Validar campos obligatorios del formulario principal
    const requiredErrors: string[] = [];
    
    if (!tipoRequisicion) requiredErrors.push("Tipo de requisición");
    if (!empresa) requiredErrors.push("Empresa");
    if (!unidadNegocio) requiredErrors.push("Unidad de Negocio");
    if (!autorizadorId) requiredErrors.push("Autorizador");
    if (!departamentoSolicitante.trim()) requiredErrors.push("Departamento Solicitante");
    if (!asunto.trim()) requiredErrors.push("Asunto");
    if (!justificacion.trim()) requiredErrors.push("Justificación");

    // Validar campos obligatorios de cada partida
    const partidasErrors: string[] = [];
    partidas.forEach((partida, index) => {
      const partidaNum = index + 1;
      if (!partida.descripcion.trim()) {
        partidasErrors.push(`Partida ${partidaNum}: Descripción`);
      }
      if (!partida.cantidad || partida.cantidad <= 0) {
        partidasErrors.push(`Partida ${partidaNum}: Cantidad`);
      }
      if (!partida.tipo_gasto) {
        partidasErrors.push(`Partida ${partidaNum}: Tipo de gasto`);
      }
      if (!partida.categoria_gasto) {
        partidasErrors.push(`Partida ${partidaNum}: Categoría de gasto`);
      }
    });

    if (requiredErrors.length > 0 || partidasErrors.length > 0) {
      const allErrors = [...requiredErrors, ...partidasErrors];
      toast.error(`Campos obligatorios faltantes: ${allErrors.slice(0, 3).join(", ")}${allErrors.length > 3 ? ` y ${allErrors.length - 3} más` : ""}`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Asegura una sesión válida antes de mutar (evita requests sin JWT → RLS 403)
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Tu sesión expiró. Inicia sesión nuevamente.");
        navigate("/");
        return;
      }

      // Fuerza refresh para evitar tokens vencidos / desincronizados
      await supabase.auth.refreshSession();

      // Toma el access token vigente y lo fuerza en un cliente por-request (evita requests que salen como anon)
      const { data: refreshed } = await supabase.auth.getSession();
      const accessToken = refreshed.session?.access_token;
      if (!accessToken) {
        toast.error("No se encontró token de sesión. Inicia sesión nuevamente.");
        navigate("/");
        return;
      }

      const supabaseAuthed = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        {
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        }
      );

      if (isEditMode && originalRequisicionId) {
        // UPDATE mode - clear justificacion_rechazo and update requisicion
        // IMPORTANT: Delete partidas FIRST while the estado is still 'pendiente'
        // Then update the requisicion (which changes estado to 'aprobado')
        
        // Step 1: Delete existing partidas (while estado is still pendiente/rechazado)
        const { error: deletePartidasError } = await supabaseAuthed
          .from("requisicion_partidas")
          .delete()
          .eq("requisicion_id", originalRequisicionId);

        if (deletePartidasError) throw deletePartidasError;

        // Step 2: Insert new partidas
        const partidasToInsert = partidas.map((p) => ({
          requisicion_id: originalRequisicionId,
          numero_partida: p.numero_partida,
          descripcion: p.descripcion,
          modelo_parte: p.modelo_parte,
          unidad_medida: p.unidad_medida,
          cantidad: p.cantidad,
          fecha_necesidad: p.fecha_necesidad?.toISOString().split("T")[0],
          tipo_gasto: p.tipo_gasto || null,
          categoria_gasto: p.categoria_gasto || null,
          costo_estimado: p.costo_estimado,
          sucursal: p.sucursal || null,
        }));

        const { error: partidasError } = await supabaseAuthed
          .from("requisicion_partidas")
          .insert(partidasToInsert);

        if (partidasError) throw partidasError;

        // Step 3: Update requisicion
        // Always keep estado as 'pendiente' so the authorizer must approve again
        // This ensures rejected items go back to the authorizer for review
        const newEstado = "pendiente";
        
        const updateData = {
          tipo_requisicion: tipoRequisicion,
          unidad_negocio: unidadNegocio,
          empresa,
          fecha_autorizacion: fechaAutorizacion.toISOString().split("T")[0],
          sucursal,
          autorizador_id: autorizadorId || null,
          departamento_solicitante: departamentoSolicitante,
          presupuesto_aproximado: presupuestoAproximado
            ? parseFloat(presupuestoAproximado)
            : null,
          se_dividira_gasto: seDividiraGasto,
          un_division_gasto: seDividiraGasto ? unDivisionGasto : null,
          porcentaje_cada_un: seDividiraGasto ? porcentajeCadaUn : null,
          datos_proveedor: datosProveedor,
          datos_banco: datosBanco,
          nombre_proyecto: nombreProyecto,
          asunto,
          justificacion,
          justificacion_rechazo: wasRejected ? null : undefined, // Only clear if was rejected
          estado: newEstado as any,
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabaseAuthed
          .from("requisiciones")
          .update(updateData)
          .eq("id", originalRequisicionId);

        if (updateError) throw updateError;

        // Save files metadata (delete existing and insert new)
        await supabaseAuthed
          .from("requisicion_archivos")
          .delete()
          .eq("requisicion_id", originalRequisicionId);

        if (uploadedFiles.length > 0) {
          const filesToInsert = uploadedFiles.map(f => ({
            requisicion_id: originalRequisicionId,
            file_name: f.file_name,
            file_url: f.file_url,
            file_type: f.file_type,
            file_size: f.file_size,
            uploaded_by: user.id,
          }));
          await supabaseAuthed.from("requisicion_archivos").insert(filesToInsert);
        }

        toast.success("Requisición actualizada y reenviada exitosamente");
        navigate("/tramites");
      } else {
        // INSERT mode - create new requisicion
        const requisicionId = requisicionIdForFiles; // Use the same ID that was used for file uploads

        const insertRequisicion = async () => {
          const { error } = await supabaseAuthed.from("requisiciones").insert({
            id: requisicionId,
            folio,
            tipo_requisicion: tipoRequisicion,
            unidad_negocio: unidadNegocio,
            empresa,
            fecha_autorizacion: fechaAutorizacion.toISOString().split("T")[0],
            sucursal,
            autorizador_id: autorizadorId || null,
            departamento_solicitante: departamentoSolicitante,
            solicitado_por: user.id,
            presupuesto_aproximado: presupuestoAproximado
              ? parseFloat(presupuestoAproximado)
              : null,
            se_dividira_gasto: seDividiraGasto,
            un_division_gasto: seDividiraGasto ? unDivisionGasto : null,
            porcentaje_cada_un: seDividiraGasto ? porcentajeCadaUn : null,
            datos_proveedor: datosProveedor,
            datos_banco: datosBanco,
            nombre_proyecto: nombreProyecto,
            asunto,
            justificacion,
            estado: "pendiente",
          });

          return { error };
        };

        // Insert requisicion (reintenta si la sesión aún no se adjuntó)
        let { error: reqError } = await insertRequisicion();

        if (
          reqError &&
          (reqError.code === "42501" ||
            /row-level security/i.test(reqError.message ?? ""))
        ) {
          const retry = await insertRequisicion();
          reqError = retry.error;
        }

        if (reqError) throw reqError;

        // Insert partidas
        const partidasToInsert = partidas.map((p) => ({
          requisicion_id: requisicionId,
          numero_partida: p.numero_partida,
          descripcion: p.descripcion,
          modelo_parte: p.modelo_parte,
          unidad_medida: p.unidad_medida,
          cantidad: p.cantidad,
          fecha_necesidad: p.fecha_necesidad?.toISOString().split("T")[0],
          tipo_gasto: p.tipo_gasto || null,
          categoria_gasto: p.categoria_gasto || null,
          costo_estimado: p.costo_estimado,
          sucursal: p.sucursal || null,
        }));

        const { error: partidasError } = await supabaseAuthed
          .from("requisicion_partidas")
          .insert(partidasToInsert);

        if (partidasError) throw partidasError;

        // Save files metadata
        if (uploadedFiles.length > 0) {
          const filesToInsert = uploadedFiles.map(f => ({
            requisicion_id: requisicionId,
            file_name: f.file_name,
            file_url: f.file_url,
            file_type: f.file_type,
            file_size: f.file_size,
            uploaded_by: user.id,
          }));
          await supabaseAuthed.from("requisicion_archivos").insert(filesToInsert);
        }

        toast.success("Requisición guardada exitosamente");
        navigate("/tramites");
      }
    } catch (error: any) {
      console.error("Error saving requisicion:", error);
      const msg =
        error?.code === "42501"
          ? "No se pudo guardar: tu sesión no se está aplicando al backend (RLS). Cierra sesión e inicia nuevamente."
          : error?.message || "Error al guardar la requisición";
      toast.error(msg);
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
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(isEditMode ? "/tramites" : "/dashboard")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-2xl font-bold text-primary">
            {isEditMode ? "Editar y Reenviar Requisición" : "Formato de Requisición"}
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="border-border bg-card mb-6">
            <CardContent className="p-6 space-y-6">
              {/* Tipo de requisición y Asunto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Tipo de requisición <span className="text-destructive">*</span></Label>
                  <Select value={tipoRequisicion} onValueChange={setTipoRequisicion}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Seleccione un tipo de requisición" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border z-50">
                      {tiposRequisicion.map((tipo) => (
                        <SelectItem key={tipo.id} value={tipo.id}>
                          <div className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", tipo.color_class)} />
                            {tipo.nombre}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">
                    Asunto <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={asunto}
                    onChange={(e) => setAsunto(e.target.value)}
                    className="bg-input border-border"
                    placeholder="Ej: viáticos, viaje a Monterrey..."
                    required
                  />
                </div>
              </div>

              {/* Row: Empresa, Unidad de Negocio, Folio, Fecha */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Empresa <span className="text-destructive">*</span></Label>
                  <Select 
                    value={empresa} 
                    onValueChange={(value) => {
                      setEmpresa(value);
                      setUnidadNegocio(""); // Reset unidad when empresa changes
                    }}
                  >
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

                <div className="space-y-2">
                  <Label className="text-foreground">Unidad de negocio <span className="text-destructive">*</span></Label>
                  <Select 
                    value={unidadNegocio} 
                    onValueChange={setUnidadNegocio}
                    disabled={!empresa}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder={empresa ? "Seleccione una unidad" : "Primero seleccione empresa"} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border z-50">
                      {getUnidadesByEmpresa(empresa).map((unidad) => (
                        <SelectItem key={unidad.id} value={unidad.id}>
                          {unidad.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Folio</Label>
                  <Input
                    value={folio}
                    disabled
                    className="bg-muted border-border text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Fecha de autorización</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-input border-border",
                          !fechaAutorizacion && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaAutorizacion
                          ? format(fechaAutorizacion, "dd/MM/yyyy", { locale: es })
                          : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border z-50">
                      <Calendar
                        mode="single"
                        selected={fechaAutorizacion}
                        onSelect={(date) => date && setFechaAutorizacion(date)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Row: Autorizador, Departamento, Solicitado por */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div className="space-y-2">
                  <Label className="text-foreground">Autorizador <span className="text-destructive">*</span></Label>
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

                <div className="space-y-2">
                  <Label className="text-foreground">Departamento Solicitante <span className="text-destructive">*</span></Label>
                  <Input
                    value={departamentoSolicitante}
                    onChange={(e) => setDepartamentoSolicitante(e.target.value)}
                    className="bg-input border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Solicitado por</Label>
                  <Input
                    value={user?.email || ""}
                    disabled
                    className="bg-muted border-border text-muted-foreground"
                  />
                </div>
              </div>

              {/* Partidas Section */}
              <div className="space-y-4">
                <Label className="text-foreground text-lg font-semibold">Partidas</Label>
                <div className="rounded-md border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground w-20">Partida</TableHead>
                        <TableHead className="text-muted-foreground w-36">Sucursal</TableHead>
                        <TableHead className="text-muted-foreground w-40">Tipo de Gasto <span className="text-destructive">*</span></TableHead>
                        <TableHead className="text-muted-foreground w-52">Categoría de Gasto <span className="text-destructive">*</span></TableHead>
                        <TableHead className="text-muted-foreground">Descripción <span className="text-destructive">*</span></TableHead>
                        <TableHead className="text-muted-foreground">Modelo/# Parte</TableHead>
                        <TableHead className="text-muted-foreground w-24">UM</TableHead>
                        <TableHead className="text-muted-foreground w-24">Cantidad <span className="text-destructive">*</span></TableHead>
                        <TableHead className="text-muted-foreground w-32">Costo Estimado</TableHead>
                        <TableHead className="text-muted-foreground w-40">Fecha de Necesidad</TableHead>
                        <TableHead className="text-muted-foreground w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partidas.map((partida) => (
                        <TableRow key={partida.id} className="border-border">
                          <TableCell>
                            <Input
                              value={partida.numero_partida}
                              disabled
                              className="bg-muted border-border text-center w-16"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={partida.sucursal}
                              onValueChange={(value) =>
                                updatePartida(partida.id, "sucursal", value)
                              }
                            >
                              <SelectTrigger className="bg-input border-border w-32">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border z-50">
                                {sucursales.map((suc) => (
                                  <SelectItem key={suc.id} value={suc.nombre}>
                                    {suc.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={partida.tipo_gasto}
                              onValueChange={(value) =>
                                updatePartida(partida.id, "tipo_gasto", value)
                              }
                            >
                              <SelectTrigger className="bg-input border-border w-36">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                <SelectItem value="administrativo">Administrativo</SelectItem>
                                <SelectItem value="operativo">Operativo</SelectItem>
                                <SelectItem value="proyecto_inversion">Proyecto/Inversión</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={partida.categoria_gasto}
                              onValueChange={(value) =>
                                updatePartida(partida.id, "categoria_gasto", value)
                              }
                              disabled={!partida.tipo_gasto}
                            >
                              <SelectTrigger className="bg-input border-border w-48">
                                <SelectValue placeholder={partida.tipo_gasto ? "Seleccionar categoría" : "Primero seleccione tipo"} />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border max-h-60">
                                {partida.tipo_gasto && categoriasGasto[partida.tipo_gasto]?.map((cat) => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={partida.descripcion}
                              onChange={(e) =>
                                updatePartida(partida.id, "descripcion", e.target.value)
                              }
                              className="bg-input border-border"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={partida.modelo_parte}
                              onChange={(e) =>
                                updatePartida(partida.id, "modelo_parte", e.target.value)
                              }
                              className="bg-input border-border"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={partida.unidad_medida}
                              onChange={(e) =>
                                updatePartida(partida.id, "unidad_medida", e.target.value)
                              }
                              className="bg-input border-border w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={partida.cantidad}
                              onChange={(e) =>
                                updatePartida(
                                  partida.id,
                                  "cantidad",
                                  parseFloat(e.target.value) || 1
                                )
                              }
                              className="bg-input border-border w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="$"
                              value={partida.costo_estimado ?? ""}
                              onChange={(e) =>
                                updatePartida(
                                  partida.id,
                                  "costo_estimado",
                                  e.target.value ? parseFloat(e.target.value) : null
                                )
                              }
                              className="bg-input border-border w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal bg-input border-border text-sm",
                                    !partida.fecha_necesidad && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-3 w-3" />
                                  {partida.fecha_necesidad
                                    ? format(partida.fecha_necesidad, "dd/MM/yy", {
                                        locale: es,
                                      })
                                    : "Fecha"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 bg-card border-border z-50">
                                <Calendar
                                  mode="single"
                                  selected={partida.fecha_necesidad || undefined}
                                  onSelect={(date) =>
                                    updatePartida(partida.id, "fecha_necesidad", date)
                                  }
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removePartida(partida.id)}
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
                    onClick={addPartida}
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Partida
                  </Button>
                </div>
              </div>

              {/* Presupuesto y División de gasto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Presupuesto aproximado ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={presupuestoAproximado}
                    readOnly
                    disabled
                    className="bg-muted border-border text-muted-foreground"
                    placeholder="Suma automática de costos estimados"
                  />
                </div>

                <div className="flex items-center space-x-3 pt-8">
                  <Checkbox
                    id="dividir-gasto"
                    checked={seDividiraGasto}
                    onCheckedChange={(checked) => setSeDividiraGasto(!!checked)}
                    className="border-primary data-[state=checked]:bg-primary"
                  />
                  <Label htmlFor="dividir-gasto" className="text-foreground cursor-pointer">
                    ¿Se dividirá el gasto?
                  </Label>
                </div>
              </div>

              {/* Campos condicionales si se divide el gasto */}
              {seDividiraGasto && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
                  <div className="space-y-2">
                    <Label className="text-foreground">UN en que se dividirá el gasto</Label>
                    <Input
                      value={unDivisionGasto}
                      onChange={(e) => setUnDivisionGasto(e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">% Que se aplicará en cada UN</Label>
                    <Input
                      value={porcentajeCadaUn}
                      onChange={(e) => setPorcentajeCadaUn(e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>
                </div>
              )}

              {/* Datos de proveedor */}
              <div className="space-y-2">
                <Label className="text-foreground">
                  Si tramita pago a proveedor adjuntar sus datos, CSF, forma y datos para el pago
                </Label>
                <Textarea
                  value={datosProveedor}
                  onChange={(e) => setDatosProveedor(e.target.value)}
                  className="bg-input border-border min-h-24"
                />
              </div>

              {/* Datos bancarios */}
              <div className="space-y-2">
                <Label className="text-foreground">
                  Adjuntar nombre/banco/CLABE/cuenta/tarjeta según corresponda
                </Label>
                <Textarea
                  value={datosBanco}
                  onChange={(e) => setDatosBanco(e.target.value)}
                  className="bg-input border-border min-h-24"
                />
              </div>

              {/* Nombre de proyecto */}
              <div className="space-y-2">
                <Label className="text-foreground">
                  Si pertenece a un proyecto indicar el nombre:
                </Label>
                <Input
                  value={nombreProyecto}
                  onChange={(e) => setNombreProyecto(e.target.value)}
                  className="bg-input border-border"
                />
              </div>

              {/* Justificación */}
              <div className="space-y-2">
                <Label className="text-foreground">Justificación <span className="text-destructive">*</span></Label>
                <Textarea
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  className="bg-input border-border min-h-24"
                />
              </div>

              {/* File Upload Section */}
              {user && (
                <FileUploadSection
                  requisicionId={isEditMode && originalRequisicionId ? originalRequisicionId : requisicionIdForFiles}
                  userId={user.id}
                  files={uploadedFiles}
                  onFilesChange={setUploadedFiles}
                  disabled={false}
                />
              )}

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "w-full font-medium py-6",
                  isEditMode 
                    ? "bg-green-600 hover:bg-green-700 text-white" 
                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isEditMode ? "Reenviando..." : "Guardando..."}
                  </>
                ) : (
                  isEditMode ? "Reenviar Requisición" : "Guardar Requisición"
                )}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
};

export default Requisicion;
