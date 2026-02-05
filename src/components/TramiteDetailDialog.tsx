import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCatalogos } from "@/hooks/useCatalogos";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, Download, Eye, ExternalLink, FileText, Lightbulb, Loader2, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { renderNRTHeader } from "@/lib/pdfFonts";
import FilePreviewModal from "@/components/FilePreviewModal";

interface TramiteDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tramiteId: string | null;
  tramiteTipo: "Requisición" | "Reposición" | null;
  onUpdated?: () => void;
}

interface RequisicionDetail {
  id: string;
  folio: string;
  created_at: string;
  solicitado_por: string;
  autorizador_id: string | null;
  estado: string;
  tipo_requisicion: string | null;
  empresa: string | null;
  unidad_negocio: string | null;
  sucursal: string | null;
  departamento_solicitante: string | null;
  nombre_proyecto: string | null;
  asunto: string | null;
  justificacion: string | null;
  justificacion_rechazo: string | null;
  justificacion_rechazo_presupuestos: string | null;
  rechazado_por_presupuestos_nombre: string | null;
  fecha_rechazo_presupuestos: string | null;
  presupuesto_aproximado: number | null;
  datos_proveedor: string | null;
  datos_banco: string | null;
  deleted_at: string | null;
  apuntes_licitacion: string | null;
  texto_compras: string | null;
  texto_compras_editado_por: string | null;
  texto_compras_editado_at: string | null;
  monto_total_compra: number | null;
  // Additional form fields
  se_dividira_gasto: boolean | null;
  un_division_gasto: string | null;
  porcentaje_cada_un: string | null;
  // Timestamp fields for timeline
  fecha_autorizacion_real: string | null;
  fecha_licitacion: string | null;
  fecha_pedido_colocado: string | null;
  fecha_pedido_autorizado: string | null;
  fecha_pago: string | null;
}

interface ReposicionDetail {
  id: string;
  folio: string;
  fecha_solicitud: string;
  created_at: string;
  solicitado_por: string;
  autorizador_id: string | null;
  estado: string;
  tipo_reposicion: string;
  gastos_semana: number | null;
  monto_total: number | null;
  reponer_a: string | null;
  banco: string | null;
  cuenta_clabe: string | null;
  justificacion: string | null;
  justificacion_rechazo: string | null;
  // Timestamp fields for timeline
  fecha_autorizacion: string | null;
  fecha_pago: string | null;
}

interface Gasto {
  id: string;
  unidad_negocio_id: string | null;
  empresa_id: string | null;
  descripcion: string | null;
  departamento: string | null;
  proveedor_negocio: string | null;
  fecha_gasto: string | null;
  factura_no: string | null;
  importe: number | null;
}

interface Partida {
  id: string;
  numero_partida: number;
  descripcion: string | null;
  cantidad: number | null;
  unidad_medida: string | null;
  modelo_parte: string | null;
  fecha_necesidad: string | null;
  tipo_gasto: string | null;
  categoria_gasto: string | null;
  sucursal: string | null;
  costo_estimado: number | null;
}

interface ArchivoAdjunto {
  id: string;
  file_name: string;
  file_url: string;
  file_type?: string | null;
  file_size?: number | null;
}

const timelineSteps = [
  { key: "pendiente", label: "Requisición\nPendiente" },
  { key: "aprobado", label: "Requisición\nAutorizada" },
  { key: "en_licitacion", label: "Requisición\nLicitada" },
  { key: "pedido_colocado", label: "Pedido\nColocado" },
  { key: "pedido_autorizado", label: "Pedido\nAutorizado" },
  { key: "pedido_pagado", label: "Pedido\nPagado" },
];

const getStepIndex = (estado: string): number => {
  const index = timelineSteps.findIndex((s) => s.key === estado);
  return index >= 0 ? index : 0;
};

// Helper function to get the timestamp for each timeline step
const getStepTimestamp = (
  stepKey: string, 
  requisicion: RequisicionDetail | null, 
  reposicion: ReposicionDetail | null
): string | null => {
  if (requisicion) {
    switch (stepKey) {
      case "pendiente":
        return requisicion.created_at;
      case "aprobado":
        return requisicion.fecha_autorizacion_real;
      case "en_licitacion":
        return requisicion.fecha_licitacion;
      case "pedido_colocado":
        return requisicion.fecha_pedido_colocado;
      case "pedido_autorizado":
        return requisicion.fecha_pedido_autorizado;
      case "pedido_pagado":
        return requisicion.fecha_pago;
      default:
        return null;
    }
  } else if (reposicion) {
    switch (stepKey) {
      case "pendiente":
        return reposicion.created_at;
      case "aprobado":
        return reposicion.fecha_autorizacion;
      case "pedido_pagado":
        return reposicion.fecha_pago;
      default:
        return null;
    }
  }
  return null;
};

const formatTimestamp = (timestamp: string | null): string => {
  if (!timestamp) return "";
  try {
    return format(new Date(timestamp), "d/MMM/yy HH:mm", { locale: es });
  } catch {
    return "";
  }
};

const TramiteDetailDialog = ({
  open,
  onOpenChange,
  tramiteId,
  tramiteTipo,
  onUpdated,
}: TramiteDetailDialogProps) => {
  const navigate = useNavigate();
  const { user, isAutorizador, isSuperadmin, isAdmin, isComprador, isPresupuestos, isTesoreria, isSolicitador } = useAuth();
  const { empresas, unidadesNegocio, sucursales, getTipoNombre } = useCatalogos();
  const [loading, setLoading] = useState(true);
  const [requisicion, setRequisicion] = useState<RequisicionDetail | null>(null);
  const [reposicion, setReposicion] = useState<ReposicionDetail | null>(null);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [solicitanteEmail, setSolicitanteEmail] = useState("");
  const [autorizadorEmail, setAutorizadorEmail] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [archivosAdjuntos, setArchivosAdjuntos] = useState<ArchivoAdjunto[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showRejectByCompradorConfirm, setShowRejectByCompradorConfirm] = useState(false);
  const [showRejectByPresupuestosConfirm, setShowRejectByPresupuestosConfirm] = useState(false);
  const [showRejectPresupuestosToSolicitadorConfirm, setShowRejectPresupuestosToSolicitadorConfirm] = useState(false);
  const [showRejectByAutorizadorConfirm, setShowRejectByAutorizadorConfirm] = useState(false);
  const [rejectJustification, setRejectJustification] = useState("");
  const [rejectAutorizadorJustification, setRejectAutorizadorJustification] = useState("");
  const [rejectPresupuestosJustification, setRejectPresupuestosJustification] = useState("");
  const [rejectPresupuestosToSolicitadorJustification, setRejectPresupuestosToSolicitadorJustification] = useState("");
  const [apuntesLicitacion, setApuntesLicitacion] = useState("");
  const [savingApuntes, setSavingApuntes] = useState(false);
  const [apuntesPresupuesto, setApuntesPresupuesto] = useState("");
  const [savingApuntesPresupuesto, setSavingApuntesPresupuesto] = useState(false);
  const [apuntesTesoreria, setApuntesTesoreria] = useState("");
  const [savingApuntesTesoreria, setSavingApuntesTesoreria] = useState(false);
  const [apuntesCompras, setApuntesCompras] = useState("");
  const [savingApuntesCompras, setSavingApuntesCompras] = useState(false);
  const [textoCompras, setTextoCompras] = useState("");
  const [savingTextoCompras, setSavingTextoCompras] = useState(false);
  const [textoComprasHistorial, setTextoComprasHistorial] = useState<Array<{
    id: string;
    texto: string;
    editado_por: string;
    editado_at: string;
    editor_name?: string;
    editor_role?: string;
    estado_al_comentar?: string;
  }>>([]);
  const [montoTotalCompra, setMontoTotalCompra] = useState("");
  const [previewFile, setPreviewFile] = useState<ArchivoAdjunto | null>(null);

  useEffect(() => {
    if (open && tramiteId && tramiteTipo) {
      fetchDetails();
      setAiAnalysis(null);
    }
  }, [open, tramiteId, tramiteTipo]);

  // Real-time subscription for status updates and historial
  useEffect(() => {
    if (!open || !tramiteId || !tramiteTipo) return;

    const table = tramiteTipo === "Reposición" ? "reposiciones" : "requisiciones";
    
    const channel = supabase
      .channel(`tramite-detail-${tramiteId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: table,
          filter: `id=eq.${tramiteId}`,
        },
        (payload) => {
          // Update the local state with new data
          if (tramiteTipo === "Reposición") {
            setReposicion(prev => prev ? { ...prev, ...payload.new } : null);
          } else {
            setRequisicion(prev => prev ? { ...prev, ...payload.new } : null);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'requisicion_texto_compras_historial',
          filter: `requisicion_id=eq.${tramiteId}`,
        },
        async (payload) => {
          // Fetch editor info for new entry
          const newRecord = payload.new as any;
          const [nameResult, roleResult] = await Promise.all([
            supabase.rpc('get_profile_name', { _user_id: newRecord.editado_por }),
            supabase.rpc('get_user_role_text', { _user_id: newRecord.editado_por })
          ]);
          
          const newEntry = {
            id: newRecord.id,
            texto: newRecord.texto,
            editado_por: newRecord.editado_por,
            editado_at: newRecord.editado_at,
            editor_name: nameResult.data || "Usuario",
            editor_role: roleResult.data || "sin rol",
            estado_al_comentar: newRecord.estado_al_comentar
          };
          
          // Add to historial if not already present
          setTextoComprasHistorial(prev => {
            if (prev.some(e => e.id === newEntry.id)) return prev;
            return [newEntry, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, tramiteId, tramiteTipo]);

  const fetchDetails = async () => {
    if (!tramiteId || !tramiteTipo) return;
    setLoading(true);
    // Reset state to prevent duplications
    setPartidas([]);
    setGastos([]);
    setTextoComprasHistorial([]);
    setArchivosAdjuntos([]);

    try {
      if (tramiteTipo === "Reposición") {
        const { data: repo, error } = await supabase
          .from("reposiciones")
          .select("*")
          .eq("id", tramiteId)
          .single();

        if (error) throw error;
        setReposicion(repo);
        setRequisicion(null);

        // Fetch gastos
        const { data: gastosData } = await supabase
          .from("reposicion_gastos")
          .select("*")
          .eq("reposicion_id", tramiteId);
        setGastos(gastosData || []);
        setPartidas([]);

        // Fetch archivos adjuntos for reposicion
        const { data: archivosData } = await supabase
          .from("reposicion_archivos" as any)
          .select("*")
          .eq("reposicion_id", tramiteId);
        if (archivosData) {
          setArchivosAdjuntos((archivosData as any[]).map((a: any) => ({
            id: a.id,
            file_name: a.file_name,
            file_url: a.file_url,
            file_type: a.file_type,
            file_size: a.file_size,
          })));
        } else {
          setArchivosAdjuntos([]);
        }

        // Fetch user emails
        await fetchUserEmails(repo.solicitado_por, repo.autorizador_id);
      } else {
        const { data: req, error } = await supabase
          .from("requisiciones")
          .select("*")
          .eq("id", tramiteId)
          .single();

        if (error) throw error;
        setRequisicion(req);
        setApuntesLicitacion(req.apuntes_licitacion || "");
        setApuntesPresupuesto((req as any).apuntes_presupuesto || "");
        setApuntesTesoreria((req as any).apuntes_tesoreria || "");
        setApuntesCompras((req as any).apuntes_compras || "");
        setTextoCompras("");
        setMontoTotalCompra(req.monto_total_compra?.toString() || "");
        
        // Fetch texto compras historial
        const { data: historialData } = await supabase
          .from("requisicion_texto_compras_historial")
          .select("*")
          .eq("requisicion_id", tramiteId)
          .order("editado_at", { ascending: false });
        
        // Get editor names for each entry
        if (historialData && historialData.length > 0) {
          const historialWithNames = await Promise.all(
            historialData.map(async (entry: any) => {
              const [nameResult, roleResult] = await Promise.all([
                supabase.rpc('get_profile_name', { _user_id: entry.editado_por }),
                supabase.rpc('get_user_role_text', { _user_id: entry.editado_por })
              ]);
              return { 
                ...entry, 
                editor_name: nameResult.data || "Usuario desconocido",
                editor_role: roleResult.data || "sin rol"
              };
            })
          );
          setTextoComprasHistorial(historialWithNames);
        } else {
          setTextoComprasHistorial([]);
        }
        setReposicion(null);

        // Fetch partidas
        const { data: partidasData } = await supabase
          .from("requisicion_partidas")
          .select("*")
          .eq("requisicion_id", tramiteId)
          .order("numero_partida");
        setPartidas(partidasData || []);
        setGastos([]);

        // Fetch archivos adjuntos
        const { data: archivosData } = await supabase
          .from("requisicion_archivos")
          .select("*")
          .eq("requisicion_id", tramiteId);
        setArchivosAdjuntos(archivosData || []);

        // Fetch user emails
        await fetchUserEmails(req.solicitado_por, req.autorizador_id);
      }
    } catch (error) {
      console.error("Error fetching details:", error);
      toast.error("Error al cargar los detalles del trámite");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserEmails = async (solicitadoPor: string, autorizadorId: string | null) => {
    // Fetch solicitante using security definer function (bypasses RLS)
    const { data: solicitanteData } = await supabase.rpc("get_solicitante_info", { 
      _user_id: solicitadoPor 
    });

    if (solicitanteData && solicitanteData.length > 0) {
      const solicitante = solicitanteData[0];
      setSolicitanteEmail(solicitante.full_name || solicitante.email || "Usuario");
    } else {
      // Fallback: try direct profile access (works for own profile)
      const { data: solicitanteProfile } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .eq("user_id", solicitadoPor)
        .maybeSingle();

      if (solicitanteProfile) {
        setSolicitanteEmail(solicitanteProfile.full_name || solicitanteProfile.email || "Usuario");
      } else {
        setSolicitanteEmail("Usuario");
      }
    }

    // Fetch autorizador using the get_autorizadores function (bypasses RLS)
    if (autorizadorId) {
      const { data: autorizadores } = await supabase.rpc("get_autorizadores");
      const autorizador = autorizadores?.find((a: any) => a.user_id === autorizadorId);
      if (autorizador) {
        setAutorizadorEmail(autorizador.full_name || autorizador.email || "");
      } else {
        // Fallback: try get_solicitante_info function
        const { data: authData } = await supabase.rpc("get_solicitante_info", { 
          _user_id: autorizadorId 
        });
        if (authData && authData.length > 0) {
          const auth = authData[0];
          setAutorizadorEmail(auth.full_name || auth.email || "");
        }
      }
    }
  };

  const canAuthorize = () => {
    const tramite = reposicion || requisicion;
    if (!tramite || !user) return false;
    
    // Check if user is the assigned autorizador or is superadmin/admin
    const isAssignedAutorizador = tramite.autorizador_id === user.id;
    const isPending = tramite.estado === "pendiente";
    
    return isPending && (isAssignedAutorizador || isSuperadmin || isAdmin || isAutorizador);
  };

  const canCancel = () => {
    const tramite = reposicion || requisicion;
    if (!tramite || !user) return false;
    
    // Only the owner can cancel their own trámite (solicitador)
    const isOwner = tramite.solicitado_por === user.id;
    const isCancellable = tramite.estado === "pendiente";
    
    return isOwner && isCancellable && !isSuperadmin && !isAdmin && !isAutorizador;
  };

  const canRevert = () => {
    const tramite = reposicion || requisicion;
    if (!tramite || !user) return false;
    
    // Autorizador/admin/superadmin can revert approved/rejected to pendiente
    const isAssignedAutorizador = tramite.autorizador_id === user.id;
    const isRevertible = tramite.estado === "aprobado" || tramite.estado === "rechazado";
    
    return isRevertible && (isAssignedAutorizador || isSuperadmin || isAdmin || isAutorizador);
  };

  // Comprador: can move from aprobado to en_licitacion
  const canMoveToLicitacion = () => {
    if (!requisicion || !user) return false;
    return requisicion.estado === "aprobado" && (isComprador || isSuperadmin);
  };

  // Comprador: can reject before licitación (when status is aprobado)
  const canRejectBeforeLicitacion = () => {
    if (!requisicion || !user) return false;
    return requisicion.estado === "aprobado" && (isComprador || isSuperadmin);
  };

  // Comprador: can move from en_licitacion to pedido_colocado
  const canMoveToPedidoColocado = () => {
    if (!requisicion || !user) return false;
    return requisicion.estado === "en_licitacion" && (isComprador || isSuperadmin);
  };

  // Presupuestos: can move from pedido_colocado to pedido_autorizado
  const canAuthorizePedido = () => {
    if (!requisicion || !user) return false;
    return requisicion.estado === "pedido_colocado" && (isPresupuestos || isSuperadmin);
  };

  // Presupuestos: can reject when status is pedido_colocado
  const canRejectByPresupuestos = () => {
    if (!requisicion || !user) return false;
    return requisicion.estado === "pedido_colocado" && (isPresupuestos || isSuperadmin);
  };

  // Autorizador: can handle items rejected by presupuestos
  const canHandlePresupuestosRejection = () => {
    if (!requisicion || !user) return false;
    const isAssignedAutorizador = requisicion.autorizador_id === user.id;
    const hasPresupuestosRejection = !!requisicion.justificacion_rechazo_presupuestos;
    // Only show when status is still pedido_colocado and there's a presupuestos rejection
    return hasPresupuestosRejection && requisicion.estado === "pedido_colocado" && 
           (isAssignedAutorizador || isSuperadmin || isAdmin);
  };

  // Tesoreria: can move from pedido_autorizado to pedido_pagado
  const canPayPedido = () => {
    if (!requisicion || !user) return false;
    return requisicion.estado === "pedido_autorizado" && (isTesoreria || isSuperadmin);
  };

  // Solicitador can delete their own pending requisitions
  // Superadmins can permanently delete any tramite regardless of status
  const canDelete = () => {
    const tramite = reposicion || requisicion;
    if (!tramite || !user) return false;
    const notDeleted = tramiteTipo === "Requisición" 
      ? !requisicion?.deleted_at 
      : true; // reposiciones don't have soft delete
    
    // Superadmin can delete any tramite regardless of status
    if (isSuperadmin && notDeleted) return true;
    
    // For requisiciones: owner can soft delete if pending
    if (tramiteTipo === "Requisición" && requisicion) {
      const isOwner = requisicion.solicitado_por === user.id;
      const isPending = requisicion.estado === "pendiente";
      return isOwner && isPending && notDeleted && (isSolicitador || isAdmin);
    }
    
    // For reposiciones: owner can delete if pending (permanent delete since no soft-delete support)
    if (tramiteTipo === "Reposición" && reposicion) {
      const isOwner = reposicion.solicitado_por === user.id;
      const isPending = reposicion.estado === "pendiente";
      return isOwner && isPending && (isSolicitador || isAdmin);
    }
    
    return false;
  };

  // Superadmin can restore deleted requisitions
  const canRestore = () => {
    if (!requisicion || !user) return false;
    return requisicion.deleted_at !== null && isSuperadmin;
  };

  // Solicitador can edit their own rejected requisitions
  const canEditRejected = () => {
    // For requisiciones
    if (requisicion && user) {
      const isOwner = requisicion.solicitado_por === user.id;
      const isRejected = requisicion.estado === "rechazado";
      const notDeleted = !requisicion.deleted_at;
      // Owner can edit rejected items regardless of their current roles
      return isOwner && isRejected && notDeleted;
    }
    // For reposiciones - check if rejected
    if (reposicion && user) {
      const isOwner = reposicion.solicitado_por === user.id;
      const isRejected = reposicion.estado === "rechazado";
      // Owner can edit rejected items regardless of their current roles
      return isOwner && isRejected;
    }
    return false;
  };

  // Solicitador can edit their own pending requisitions/reposiciones (before authorization)
  const canEditPending = () => {
    // For requisiciones
    if (requisicion && user) {
      const isOwner = requisicion.solicitado_por === user.id;
      const isPending = requisicion.estado === "pendiente";
      const notDeleted = !requisicion.deleted_at;
      // Owner can edit pending items (removed notRejected check as status is what matters)
      return isOwner && isPending && notDeleted && (isSolicitador || isAdmin || isSuperadmin);
    }
    // For reposiciones
    if (reposicion && user) {
      const isOwner = reposicion.solicitado_por === user.id;
      const isPending = reposicion.estado === "pendiente";
      return isOwner && isPending && (isSolicitador || isAdmin || isSuperadmin);
    }
    return false;
  };

  const handleEditPending = () => {
    onOpenChange(false);
    if (requisicion) {
      navigate(`/requisicion/${requisicion.id}`);
    } else if (reposicion) {
      navigate(`/reposicion/${reposicion.id}`);
    }
  };

  const handleEditRejected = () => {
    onOpenChange(false);
    if (requisicion) {
      navigate(`/requisicion/${requisicion.id}`);
    } else if (reposicion) {
      navigate(`/reposicion/${reposicion.id}`);
    }
  };

  const handleDelete = async () => {
    if (!tramiteId || !tramiteTipo) return;
    setDeleteLoading(true);

    try {
      // Superadmin performs permanent delete, others do soft delete (requisiciones only)
      if (isSuperadmin) {
        // Permanent delete with cascade
        if (tramiteTipo === "Requisición") {
          // Delete related partidas first
          const { error: partidasError } = await supabase
            .from("requisicion_partidas")
            .delete()
            .eq("requisicion_id", tramiteId);
          
          if (partidasError) console.error("Error deleting partidas:", partidasError);

          // Delete historial
          const { error: historialError } = await supabase
            .from("requisicion_texto_compras_historial")
            .delete()
            .eq("requisicion_id", tramiteId);
          
          if (historialError) console.error("Error deleting historial:", historialError);

          // Delete requisicion
          const { error } = await supabase
            .from("requisiciones")
            .delete()
            .eq("id", tramiteId);
          
          if (error) throw error;
        } else {
          // Reposición - delete gastos first
          const { error: gastosError } = await supabase
            .from("reposicion_gastos")
            .delete()
            .eq("reposicion_id", tramiteId);
          
          if (gastosError) console.error("Error deleting gastos:", gastosError);

          // Delete reposicion
          const { error } = await supabase
            .from("reposiciones")
            .delete()
            .eq("id", tramiteId);
          
          if (error) throw error;
        }
        
        toast.success(`${tramiteTipo} eliminada permanentemente`);
      } else {
        // Soft delete for non-superadmins (requisiciones only)
        const { error } = await supabase
          .from("requisiciones")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", tramiteId);

        if (error) throw error;
        toast.success("Requisición eliminada exitosamente");
      }
      
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(`Error al eliminar ${tramiteTipo?.toLowerCase()}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!tramiteId) return;
    setRestoreLoading(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ deleted_at: null })
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Requisición restaurada exitosamente");
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error restoring:", error);
      toast.error("Error al restaurar la requisición");
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!tramiteId || !tramiteTipo || !user) return;
    setActionLoading(true);

    try {
      if (tramiteTipo === "Reposición") {
        // Reposiciones don't have fecha_autorizacion_real column
        const { error } = await supabase
          .from("reposiciones")
          .update({ 
            estado: "aprobado",
            autorizado_por: user.id,
            fecha_autorizacion: new Date().toISOString()
          })
          .eq("id", tramiteId);

        if (error) throw error;
      } else {
        // Requisiciones have fecha_autorizacion_real column
        const { error } = await supabase
          .from("requisiciones")
          .update({ 
            estado: "aprobado",
            autorizado_por: user.id,
            fecha_autorizacion_real: new Date().toISOString()
          })
          .eq("id", tramiteId);

        if (error) throw error;
      }
      
      toast.success("Trámite aprobado exitosamente");
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("Error al aprobar el trámite");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!tramiteId || !tramiteTipo) return;
    if (!rejectAutorizadorJustification.trim()) {
      toast.error("Debe proporcionar una justificación para el rechazo");
      return;
    }
    setActionLoading(true);

    try {
      const table = tramiteTipo === "Reposición" ? "reposiciones" : "requisiciones";
      const { error } = await supabase
        .from(table)
        .update({ 
          estado: "rechazado",
          justificacion_rechazo: rejectAutorizadorJustification.trim()
        })
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Trámite rechazado");
      setRejectAutorizadorJustification("");
      setShowRejectByAutorizadorConfirm(false);
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error rejecting:", error);
      toast.error("Error al rechazar el trámite");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!tramiteId || !tramiteTipo) return;
    setActionLoading(true);

    try {
      const table = tramiteTipo === "Reposición" ? "reposiciones" : "requisiciones";
      const { error } = await supabase
        .from(table)
        .update({ estado: "cancelado" })
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Trámite cancelado");
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error canceling:", error);
      toast.error("Error al cancelar el trámite");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevert = async () => {
    if (!tramiteId || !tramiteTipo) return;
    setActionLoading(true);

    try {
      const table = tramiteTipo === "Reposición" ? "reposiciones" : "requisiciones";
      const { error } = await supabase
        .from(table)
        .update({ estado: "pendiente" })
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Trámite revertido a pendiente");
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error reverting:", error);
      toast.error("Error al revertir el trámite");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveToLicitacion = async () => {
    if (!tramiteId || !user) return;
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ 
          estado: "en_licitacion",
          licitado_por: user.id,
          fecha_licitacion: new Date().toISOString()
        })
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Requisición movida a Licitación");
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error moving to licitacion:", error);
      toast.error("Error al mover a licitación");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectBeforeLicitacion = async () => {
    if (!tramiteId || !user) return;
    if (!rejectJustification.trim()) {
      toast.error("Debe ingresar una justificación para el rechazo");
      return;
    }
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ 
          estado: "pendiente",
          justificacion_rechazo: rejectJustification.trim()
        })
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Requisición rechazada y devuelta al solicitador");
      setShowRejectByCompradorConfirm(false);
      setRejectJustification("");
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error rejecting before licitacion:", error);
      toast.error("Error al rechazar la requisición");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveToPedidoColocado = async () => {
    if (!tramiteId || !user) return;
    
    const monto = parseFloat(montoTotalCompra);
    if (!montoTotalCompra || isNaN(monto) || monto <= 0) {
      toast.error("Debe ingresar un monto total válido antes de colocar el pedido");
      return;
    }
    
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ 
          estado: "pedido_colocado",
          pedido_colocado_por: user.id,
          fecha_pedido_colocado: new Date().toISOString(),
          monto_total_compra: monto
        })
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Pedido colocado exitosamente");
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error moving to pedido colocado:", error);
      toast.error("Error al colocar pedido");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAuthorizePedido = async () => {
    if (!tramiteId || !user) return;
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ 
          estado: "pedido_autorizado",
          pedido_autorizado_por: user.id,
          fecha_pedido_autorizado: new Date().toISOString()
        })
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Pedido autorizado exitosamente");
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error authorizing pedido:", error);
      toast.error("Error al autorizar pedido");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectByPresupuestos = async () => {
    if (!tramiteId || !user) return;
    if (!rejectPresupuestosJustification.trim()) {
      toast.error("Debe ingresar una justificación para el rechazo");
      return;
    }
    setActionLoading(true);

    try {
      // Get user name and role
      const [nameResult, roleResult] = await Promise.all([
        supabase.rpc('get_profile_name', { _user_id: user.id }),
        supabase.rpc('get_user_role_text', { _user_id: user.id })
      ]);

      const { error } = await supabase
        .from("requisiciones")
        .update({ 
          justificacion_rechazo_presupuestos: rejectPresupuestosJustification.trim(),
          rechazado_por_presupuestos_id: user.id,
          rechazado_por_presupuestos_nombre: nameResult.data || "Usuario",
          rechazado_por_presupuestos_rol: roleResult.data || "presupuestos",
          fecha_rechazo_presupuestos: new Date().toISOString()
        } as any)
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Requisición rechazada por Presupuestos");
      setShowRejectByPresupuestosConfirm(false);
      setRejectPresupuestosJustification("");
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error rejecting by presupuestos:", error);
      toast.error("Error al rechazar la requisición");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayPedido = async () => {
    if (!tramiteId || !user) return;
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ 
          estado: "pedido_pagado",
          pagado_por: user.id,
          fecha_pago: new Date().toISOString()
        })
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Pedido marcado como pagado");
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error paying pedido:", error);
      toast.error("Error al marcar como pagado");
    } finally {
      setActionLoading(false);
    }
  };

  // Autorizador: Accept presupuestos rejection decision (clear rejection and keep at pedido_colocado for presupuestos to review again)
  const handleAcceptPresupuestosRejection = async () => {
    if (!tramiteId || !user) return;
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ 
          // Keep estado as pedido_colocado so it goes back to presupuestos
          // Just clear the rejection fields
          justificacion_rechazo_presupuestos: null,
          rechazado_por_presupuestos_id: null,
          rechazado_por_presupuestos_nombre: null,
          rechazado_por_presupuestos_rol: null,
          fecha_rechazo_presupuestos: null
        } as any)
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Requisición devuelta a Presupuestos para revisión");
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error accepting presupuestos rejection:", error);
      toast.error("Error al procesar la decisión");
    } finally {
      setActionLoading(false);
    }
  };

  // Autorizador: Reject presupuestos rejection decision (send back to solicitador)
  const handleRejectPresupuestosToSolicitador = async () => {
    if (!tramiteId || !user) return;
    if (!rejectPresupuestosToSolicitadorJustification.trim()) {
      toast.error("Debe ingresar una justificación para devolver al solicitador");
      return;
    }
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ 
          estado: "pendiente",
          justificacion_rechazo: rejectPresupuestosToSolicitadorJustification.trim(),
          // Clear the presupuestos rejection
          justificacion_rechazo_presupuestos: null,
          rechazado_por_presupuestos_id: null,
          rechazado_por_presupuestos_nombre: null,
          rechazado_por_presupuestos_rol: null,
          fecha_rechazo_presupuestos: null,
          // Clear all workflow fields
          pedido_colocado_por: null,
          fecha_pedido_colocado: null,
          monto_total_compra: null,
          licitado_por: null,
          fecha_licitacion: null,
          autorizado_por: null,
          fecha_autorizacion_real: null
        } as any)
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Requisición devuelta al solicitador");
      setShowRejectPresupuestosToSolicitadorConfirm(false);
      setRejectPresupuestosToSolicitadorJustification("");
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error rejecting to solicitador:", error);
      toast.error("Error al devolver al solicitador");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveApuntesLicitacion = async () => {
    if (!tramiteId) return;
    setSavingApuntes(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ apuntes_licitacion: apuntesLicitacion.trim() || null })
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Apuntes de licitación guardados");
      // Update local state
      setRequisicion(prev => prev ? { ...prev, apuntes_licitacion: apuntesLicitacion.trim() || null } : null);
    } catch (error) {
      console.error("Error saving apuntes:", error);
      toast.error("Error al guardar apuntes de licitación");
    } finally {
      setSavingApuntes(false);
    }
  };

  const handleSaveApuntesPresupuesto = async () => {
    if (!tramiteId) return;
    setSavingApuntesPresupuesto(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ apuntes_presupuesto: apuntesPresupuesto.trim() || null } as any)
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Apuntes de presupuesto guardados");
      // Update local state
      setRequisicion(prev => prev ? { ...prev, ...(({ apuntes_presupuesto: apuntesPresupuesto.trim() || null }) as any) } : null);
    } catch (error) {
      console.error("Error saving apuntes presupuesto:", error);
      toast.error("Error al guardar apuntes de presupuesto");
    } finally {
      setSavingApuntesPresupuesto(false);
    }
  };

  const handleSaveApuntesTesoreria = async () => {
    if (!tramiteId) return;
    setSavingApuntesTesoreria(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ apuntes_tesoreria: apuntesTesoreria.trim() || null } as any)
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Apuntes de tesorería guardados");
      // Update local state
      setRequisicion(prev => prev ? { ...prev, ...(({ apuntes_tesoreria: apuntesTesoreria.trim() || null }) as any) } : null);
    } catch (error) {
      console.error("Error saving apuntes tesoreria:", error);
      toast.error("Error al guardar apuntes de tesorería");
    } finally {
      setSavingApuntesTesoreria(false);
    }
  };

  const handleSaveApuntesCompras = async () => {
    if (!tramiteId) return;
    setSavingApuntesCompras(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ apuntes_compras: apuntesCompras.trim() || null } as any)
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Apuntes de compras guardados");
      // Update local state
      setRequisicion(prev => prev ? { ...prev, ...(({ apuntes_compras: apuntesCompras.trim() || null }) as any) } : null);
    } catch (error) {
      console.error("Error saving apuntes compras:", error);
      toast.error("Error al guardar apuntes de compras");
    } finally {
      setSavingApuntesCompras(false);
    }
  };

  const handleSaveTextoCompras = async () => {
    if (!tramiteId || !user || !textoCompras.trim() || !requisicion) {
      toast.error("Debe escribir un texto antes de guardar");
      return;
    }
    setSavingTextoCompras(true);

    try {
      const now = new Date().toISOString();
      const currentEstado = requisicion.estado;
      
      // Insert into historial table with estado
      const { error } = await supabase
        .from("requisicion_texto_compras_historial")
        .insert({
          requisicion_id: tramiteId,
          texto: textoCompras.trim(),
          editado_por: user.id,
          editado_at: now,
          estado_al_comentar: currentEstado
        });

      if (error) throw error;
      toast.success("Comentario guardado");
      
      // Get editor name and role, add to local historial
      const [nameResult, roleResult] = await Promise.all([
        supabase.rpc('get_profile_name', { _user_id: user.id }),
        supabase.rpc('get_user_role_text', { _user_id: user.id })
      ]);
      
      const newEntry = {
        id: crypto.randomUUID(),
        texto: textoCompras.trim(),
        editado_por: user.id,
        editado_at: now,
        editor_name: nameResult.data || "Usuario",
        editor_role: roleResult.data || "sin rol",
        estado_al_comentar: currentEstado
      };
      
      setTextoComprasHistorial(prev => [newEntry, ...prev]);
      setTextoCompras(""); // Clear input after saving
    } catch (error) {
      console.error("Error saving comentario:", error);
      toast.error("Error al guardar comentario");
    } finally {
      setSavingTextoCompras(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!tramite) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // NRT MÉXICO Branding Header with Barlow Black font
    yPosition = renderNRTHeader(doc, pageWidth, yPosition);

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`${tramiteTipo}: ${tramite.folio}`, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 12;

    // Estado badge
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const estadoLabel = timelineSteps.find(s => s.key === tramite.estado)?.label.replace("\n", " ") || tramite.estado;
    doc.text(`Estado: ${estadoLabel}`, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 15;

    // General Information Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Información General", 14, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const addField = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 14, yPosition);
      doc.setFont("helvetica", "normal");
      doc.text(value, 60, yPosition);
      yPosition += 6;
    };

    addField("Solicitado por", solicitanteEmail || "-");
    addField("Fecha Solicitud", reposicion 
      ? formatDate(reposicion.fecha_solicitud) 
      : requisicion 
        ? formatDate(requisicion.created_at) 
        : "-");
    addField("Autorizador", autorizadorEmail || "-");

    if (reposicion) {
      addField("Tipo Reposición", reposicion.tipo_reposicion || "-");
      addField("Gastos Semana", formatCurrency(reposicion.gastos_semana));
      addField("Monto Total", formatCurrency(reposicion.monto_total));
      if (reposicion.reponer_a) addField("Reponer a", reposicion.reponer_a);
      if (reposicion.tipo_reposicion === "colaborador") {
        if (reposicion.banco) addField("Banco", reposicion.banco);
        if (reposicion.cuenta_clabe) addField("Cuenta/CLABE", reposicion.cuenta_clabe);
      }
    }

    if (requisicion) {
      addField("Empresa", getEmpresaNombre(requisicion.empresa));
      addField("Unidad de Negocio", getUnidadNombre(requisicion.unidad_negocio));
      if (requisicion.departamento_solicitante) addField("Departamento", requisicion.departamento_solicitante);
      addField("Presupuesto", formatCurrency(requisicion.presupuesto_aproximado));
      if (requisicion.nombre_proyecto) addField("Proyecto", requisicion.nombre_proyecto);
    }

    yPosition += 5;

    // Gastos table for Reposición
    if (reposicion && gastos.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Gastos a Reponer", 14, yPosition);
      yPosition += 5;

      autoTable(doc, {
        startY: yPosition,
        head: [["Unidad", "Empresa", "Descripción", "Proveedor", "Fecha", "Factura", "Importe"]],
        body: gastos.map((gasto) => [
          getUnidadNombre(gasto.unidad_negocio_id),
          getEmpresaNombre(gasto.empresa_id),
          gasto.descripcion || "-",
          gasto.proveedor_negocio || "-",
          formatDate(gasto.fecha_gasto),
          gasto.factura_no || "-",
          formatCurrency(gasto.importe),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 100, 100] },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // Partidas table for Requisición
    if (requisicion && partidas.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Partidas", 14, yPosition);
      yPosition += 5;

      autoTable(doc, {
        startY: yPosition,
        head: [["#", "Sucursal", "Descripción", "Tipo Gasto", "Categoría", "Cantidad", "Unidad", "Costo Est.", "Fecha Necesidad"]],
        body: partidas.map((partida) => [
          partida.numero_partida.toString(),
          partida.sucursal || "-",
          partida.descripcion || "-",
          partida.tipo_gasto || "-",
          partida.categoria_gasto || "-",
          partida.cantidad?.toString() || "-",
          partida.unidad_medida || "-",
          partida.costo_estimado ? formatCurrency(partida.costo_estimado) : "-",
          formatDate(partida.fecha_necesidad),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 100, 100] },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // Justificación
    const justificacion = reposicion?.justificacion || requisicion?.justificacion;
    if (justificacion) {
      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Justificación", 14, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const splitText = doc.splitTextToSize(justificacion, pageWidth - 28);
      doc.text(splitText, 14, yPosition);
    }

    // Download
    const fileName = `${tramiteTipo}_${tramite.folio.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    doc.save(fileName);
    toast.success("PDF descargado exitosamente");
  };

  const handleAnalyzeWithAI = async () => {
    if (!tramite) return;
    setAiLoading(true);
    setAiAnalysis(null);

    try {
      const tramiteData = reposicion
        ? {
            tipo: "Reposición",
            folio: reposicion.folio,
            estado: reposicion.estado,
            fecha: reposicion.fecha_solicitud,
            solicitante: solicitanteEmail,
            autorizador: autorizadorEmail,
            tipoReposicion: reposicion.tipo_reposicion,
            gastosSemana: formatCurrency(reposicion.gastos_semana),
            montoTotal: formatCurrency(reposicion.monto_total),
            reponerA: reposicion.reponer_a,
            banco: reposicion.banco,
            cuentaClabe: reposicion.cuenta_clabe,
            justificacion: reposicion.justificacion,
            gastos: gastos.map((g) => ({
              descripcion: g.descripcion,
              importe: formatCurrency(g.importe),
              proveedor: g.proveedor_negocio,
              factura: g.factura_no,
            })),
          }
        : {
            tipo: "Requisición",
            folio: requisicion!.folio,
            estado: requisicion!.estado,
            fecha: requisicion!.created_at,
            solicitante: solicitanteEmail,
            autorizador: autorizadorEmail,
            empresa: requisicion!.empresa,
            unidadNegocio: requisicion!.unidad_negocio,
            sucursal: requisicion!.sucursal,
            departamento: requisicion!.departamento_solicitante,
            presupuesto: formatCurrency(requisicion!.presupuesto_aproximado),
            proyecto: requisicion!.nombre_proyecto,
            justificacion: requisicion!.justificacion,
            partidas: partidas.map((p) => ({
              descripcion: p.descripcion,
              cantidad: p.cantidad,
              unidad: p.unidad_medida,
            })),
          };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-tramite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ tramiteData }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al analizar el trámite");
      }

      const data = await response.json();
      setAiAnalysis(data.analysis);
    } catch (error) {
      console.error("Error analyzing with AI:", error);
      toast.error(error instanceof Error ? error.message : "Error al analizar con IA");
    } finally {
      setAiLoading(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "d/M/yyyy", { locale: es });
    } catch {
      return date;
    }
  };

  const getEmpresaNombre = (id: string | null) => {
    if (!id) return "-";
    const empresa = empresas.find((e) => e.id === id);
    return empresa?.nombre || id;
  };

  const getUnidadNombre = (id: string | null) => {
    if (!id) return "-";
    const unidad = unidadesNegocio.find((u) => u.id === id);
    return unidad?.nombre || id;
  };

  const getSucursalNombre = (id: string | null) => {
    if (!id) return "-";
    const sucursal = sucursales.find((s) => s.id === id);
    return sucursal?.nombre || id;
  };

  const tramite = reposicion || requisicion;
  const currentStep = tramite ? getStepIndex(tramite.estado) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl text-foreground">
                Detalles del Trámite: {tramite?.folio}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-muted-foreground text-sm">Tipo:</span>
                <Badge variant="secondary" className="bg-primary/20 text-primary">
                  {tramiteTipo}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            Cargando detalles...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Timeline */}
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="text-foreground font-semibold mb-4">
                Línea de Tiempo del Proceso
              </h3>
              <div className="flex items-center justify-between overflow-x-auto pb-2">
                {timelineSteps.map((step, index) => {
                  const stepTimestamp = getStepTimestamp(step.key, requisicion, reposicion);
                  const formattedTime = formatTimestamp(stepTimestamp);
                  const hasTimestamp = stepTimestamp && index <= currentStep;
                  
                  return (
                    <div key={step.key} className="flex items-center">
                      <div className="flex flex-col items-center min-w-[90px]">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                            index < currentStep
                              ? "bg-muted border-muted-foreground/50"
                              : index === currentStep
                              ? "bg-transparent border-destructive"
                              : "bg-muted border-muted-foreground/30"
                          }`}
                        >
                          {index === currentStep && (
                            <div className="w-3 h-3 rounded-full bg-destructive" />
                          )}
                        </div>
                        <span
                          className={`text-xs mt-2 text-center whitespace-pre-line ${
                            index === currentStep
                              ? "text-foreground font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </span>
                        {hasTimestamp && (
                          <span className="text-[10px] text-primary mt-1 text-center font-medium">
                            {formattedTime}
                          </span>
                        )}
                      </div>
                      {index < timelineSteps.length - 1 && (
                        <ChevronRight
                          className={`w-4 h-4 mx-1 flex-shrink-0 ${
                            index < currentStep
                              ? "text-muted-foreground"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* General Information */}
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="text-foreground font-semibold mb-4">
                Información General
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-muted-foreground text-sm">Solicitado por:</p>
                  <p className="text-foreground">{solicitanteEmail}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Fecha Solicitud:</p>
                  <p className="text-foreground">
                    {reposicion
                      ? formatDate(reposicion.fecha_solicitud)
                      : requisicion
                      ? formatDate(requisicion.created_at)
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Autorizador:</p>
                  <p className="text-foreground">{autorizadorEmail || "-"}</p>
                </div>

                {/* Reposición specific fields */}
                {reposicion && (
                  <>
                    <div>
                      <p className="text-muted-foreground text-sm">Gastos Semana:</p>
                      <p className="text-foreground">
                        {formatCurrency(reposicion.gastos_semana)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Monto Total:</p>
                      <p className="text-foreground">
                        {formatCurrency(reposicion.monto_total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Reponer a:</p>
                      <p className="text-foreground">{reposicion.reponer_a || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Reposición de:</p>
                      <p className="text-foreground">{reposicion.tipo_reposicion}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Asunto:</p>
                      <p className="text-foreground">{(reposicion as any).asunto || "-"}</p>
                    </div>
                    {reposicion.tipo_reposicion === "colaborador" && (
                      <>
                        <div>
                          <p className="text-muted-foreground text-sm">Banco:</p>
                          <p className="text-foreground">{reposicion.banco || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">Cuenta/CLABE:</p>
                          <p className="text-foreground">
                            {reposicion.cuenta_clabe || "-"}
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Requisición specific fields */}
                {requisicion && (
                  <>
                    <div>
                      <p className="text-muted-foreground text-sm">Tipo de Requisición:</p>
                      <p className="text-foreground">{getTipoNombre(requisicion.tipo_requisicion || "") || requisicion.tipo_requisicion || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Empresa:</p>
                      <p className="text-foreground">{getEmpresaNombre(requisicion.empresa)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Unidad de Negocio:</p>
                      <p className="text-foreground">
                        {getUnidadNombre(requisicion.unidad_negocio)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Departamento:</p>
                      <p className="text-foreground">
                        {requisicion.departamento_solicitante || "-"}
                      </p>
                    </div>
                    {/* Hide budget from comprador role */}
                    {!isComprador && (
                      <div>
                        <p className="text-muted-foreground text-sm">Presupuesto:</p>
                        <p className="text-foreground">
                          {formatCurrency(requisicion.presupuesto_aproximado)}
                        </p>
                      </div>
                    )}
                    {/* Show monto total compra when available (after pedido colocado) */}
                    {requisicion.monto_total_compra && (
                      <div>
                        <p className="text-muted-foreground text-sm">Monto Total Compra:</p>
                        <p className="text-foreground font-semibold">
                          {formatCurrency(requisicion.monto_total_compra)}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground text-sm">Proyecto:</p>
                      <p className="text-foreground">
                        {requisicion.nombre_proyecto || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Asunto:</p>
                      <p className="text-foreground">
                        {requisicion.asunto || "-"}
                      </p>
                    </div>
                    {/* División de gasto */}
                    <div>
                      <p className="text-muted-foreground text-sm">¿Se dividirá gasto?:</p>
                      <p className="text-foreground">{requisicion.se_dividira_gasto ? "Sí" : "No"}</p>
                    </div>
                    {requisicion.se_dividira_gasto && (
                      <>
                        <div>
                          <p className="text-muted-foreground text-sm">División UN:</p>
                          <p className="text-foreground">{requisicion.un_division_gasto || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">Porcentaje c/UN:</p>
                          <p className="text-foreground">{requisicion.porcentaje_cada_un || "-"}</p>
                        </div>
                      </>
                    )}
                    {/* Datos Proveedor y Banco */}
                    {requisicion.datos_proveedor && (
                      <div className="md:col-span-3">
                        <p className="text-muted-foreground text-sm">Datos del Proveedor:</p>
                        <p className="text-foreground whitespace-pre-wrap">{requisicion.datos_proveedor}</p>
                      </div>
                    )}
                    {requisicion.datos_banco && (
                      <div className="md:col-span-3">
                        <p className="text-muted-foreground text-sm">Datos Bancarios:</p>
                        <p className="text-foreground whitespace-pre-wrap">{requisicion.datos_banco}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Gastos a Reponer (for Reposición) */}
            {reposicion && gastos.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="text-primary font-semibold mb-4">Gastos a Reponer</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-muted-foreground">Unidad</TableHead>
                        <TableHead className="text-muted-foreground">Empresa</TableHead>
                        <TableHead className="text-muted-foreground">Descripción</TableHead>
                        <TableHead className="text-muted-foreground">Proveedor</TableHead>
                        <TableHead className="text-muted-foreground">Fecha</TableHead>
                        <TableHead className="text-muted-foreground">Factura</TableHead>
                        <TableHead className="text-muted-foreground">Importe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gastos.map((gasto) => (
                        <TableRow key={gasto.id} className="hover:bg-muted/20">
                          <TableCell>{getUnidadNombre(gasto.unidad_negocio_id)}</TableCell>
                          <TableCell>{getEmpresaNombre(gasto.empresa_id)}</TableCell>
                          <TableCell>{gasto.descripcion || "-"}</TableCell>
                          <TableCell>{gasto.proveedor_negocio || "-"}</TableCell>
                          <TableCell>{formatDate(gasto.fecha_gasto)}</TableCell>
                          <TableCell>{gasto.factura_no || "-"}</TableCell>
                          <TableCell>{formatCurrency(gasto.importe)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Partidas (for Requisición) */}
            {requisicion && partidas.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="text-primary font-semibold mb-4">Partidas</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-muted-foreground">#</TableHead>
                        <TableHead className="text-muted-foreground">Sucursal</TableHead>
                        <TableHead className="text-muted-foreground">Descripción</TableHead>
                        <TableHead className="text-muted-foreground">Tipo Gasto</TableHead>
                        <TableHead className="text-muted-foreground">Categoría</TableHead>
                        <TableHead className="text-muted-foreground">Cantidad</TableHead>
                        <TableHead className="text-muted-foreground">Unidad</TableHead>
                        <TableHead className="text-muted-foreground">Modelo/Parte</TableHead>
                        <TableHead className="text-muted-foreground">Costo Est.</TableHead>
                        <TableHead className="text-muted-foreground">Fecha Necesidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partidas.map((partida) => (
                        <TableRow key={partida.id} className="hover:bg-muted/20">
                          <TableCell>{partida.numero_partida}</TableCell>
                          <TableCell>{partida.sucursal || "-"}</TableCell>
                          <TableCell>{partida.descripcion || "-"}</TableCell>
                          <TableCell>{partida.tipo_gasto || "-"}</TableCell>
                          <TableCell>{partida.categoria_gasto || "-"}</TableCell>
                          <TableCell>{partida.cantidad || "-"}</TableCell>
                          <TableCell>{partida.unidad_medida || "-"}</TableCell>
                          <TableCell>{partida.modelo_parte || "-"}</TableCell>
                          <TableCell>{partida.costo_estimado ? formatCurrency(partida.costo_estimado) : "-"}</TableCell>
                          <TableCell>{formatDate(partida.fecha_necesidad)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Archivos Adjuntos */}
            {archivosAdjuntos.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="text-primary font-semibold mb-4">Archivos de Referencia</h3>
                <div className="space-y-2">
                  {archivosAdjuntos.map((archivo) => (
                    <div
                      key={archivo.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-background"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{archivo.file_name}</p>
                          {archivo.file_size && (
                            <p className="text-xs text-muted-foreground">
                              {archivo.file_size < 1024 
                                ? `${archivo.file_size} B` 
                                : archivo.file_size < 1024 * 1024 
                                  ? `${(archivo.file_size / 1024).toFixed(1)} KB`
                                  : `${(archivo.file_size / (1024 * 1024)).toFixed(1)} MB`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewFile(archivo)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={archivo.file_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Justificación */}
            {(reposicion?.justificacion || requisicion?.justificacion) && (
              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="text-primary font-semibold mb-2">Justificación</h3>
                <p className="text-foreground">
                  {reposicion?.justificacion || requisicion?.justificacion}
                </p>
              </div>
            )}

            {/* Justificación de Rechazo */}
            {((requisicion?.estado === "rechazado" || reposicion?.estado === "rechazado") ||
              requisicion?.justificacion_rechazo ||
              reposicion?.justificacion_rechazo) && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                <h3 className="text-destructive font-semibold mb-2">Justificación del Rechazo</h3>
                <p className="text-foreground">
                  {requisicion?.justificacion_rechazo ||
                    reposicion?.justificacion_rechazo ||
                    "Sin justificación registrada"}
                </p>
              </div>
            )}

            {/* Justificación de Rechazo de Presupuestos */}
            {requisicion && (requisicion as any).justificacion_rechazo_presupuestos && (
              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-yellow-600 dark:text-yellow-400 font-semibold">Rechazo de Presupuestos</h3>
                </div>
                <div className="bg-yellow-500/10 rounded p-3">
                  <p className="text-foreground whitespace-pre-wrap">
                    {(requisicion as any).justificacion_rechazo_presupuestos}
                  </p>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  <p><strong>Rechazado por:</strong> {(requisicion as any).rechazado_por_presupuestos_nombre || "Usuario"}</p>
                  <p><strong>Rol:</strong> {(requisicion as any).rechazado_por_presupuestos_rol || "presupuestos"}</p>
                  {(requisicion as any).fecha_rechazo_presupuestos && (
                    <p><strong>Fecha:</strong> {format(new Date((requisicion as any).fecha_rechazo_presupuestos), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                  )}
                </div>
              </div>
            )}

            {/* Apuntes de Compras - visible when in aprobado or later, editable only by comprador when aprobado, hidden from solicitador */}
            {requisicion && !isSolicitador && (requisicion.estado === 'aprobado' || (requisicion as any).apuntes_compras) && (
              <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4">
                <h3 className="text-pink-400 font-semibold mb-2">Apuntes de Compras</h3>
                {requisicion.estado === 'aprobado' && (isComprador || isSuperadmin) ? (
                  <div className="space-y-3">
                    <Textarea
                      value={apuntesCompras}
                      onChange={(e) => setApuntesCompras(e.target.value)}
                      placeholder="Escriba aquí cualquier suceso o nota relevante del proceso de compras..."
                      className="min-h-[100px] bg-background/50"
                    />
                    <Button
                      onClick={handleSaveApuntesCompras}
                      disabled={savingApuntesCompras}
                      size="sm"
                      className="bg-pink-600 hover:bg-pink-700"
                    >
                      {savingApuntesCompras ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        "Guardar Apuntes"
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-foreground whitespace-pre-wrap">
                    {(requisicion as any).apuntes_compras || "Sin apuntes registrados"}
                  </p>
                )}
              </div>
            )}

            {/* Apuntes de Licitación - visible when in en_licitacion or later, editable only by comprador when en_licitacion, hidden from solicitador */}
            {requisicion && !isSolicitador && (requisicion.estado === 'en_licitacion' || requisicion.apuntes_licitacion) && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h3 className="text-blue-400 font-semibold mb-2">Apuntes de Licitación</h3>
                {requisicion.estado === 'en_licitacion' && (isComprador || isSuperadmin) ? (
                  <div className="space-y-3">
                    <Textarea
                      value={apuntesLicitacion}
                      onChange={(e) => setApuntesLicitacion(e.target.value)}
                      placeholder="Escriba aquí cualquier suceso o nota relevante del proceso de licitación..."
                      className="min-h-[100px] bg-background/50"
                    />
                    <Button
                      onClick={handleSaveApuntesLicitacion}
                      disabled={savingApuntes}
                      size="sm"
                    >
                      {savingApuntes ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        "Guardar Apuntes"
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-foreground whitespace-pre-wrap">
                    {requisicion.apuntes_licitacion || "Sin apuntes registrados"}
                  </p>
                )}
              </div>
            )}

            {/* Apuntes de Presupuesto - visible when in pedido_colocado or later, editable only by presupuestos when pedido_colocado, hidden from solicitador */}
            {requisicion && !isSolicitador && (requisicion.estado === 'pedido_colocado' || (requisicion as any).apuntes_presupuesto) && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h3 className="text-purple-400 font-semibold mb-2">Apuntes de Presupuesto</h3>
                {requisicion.estado === 'pedido_colocado' && (isPresupuestos || isSuperadmin) ? (
                  <div className="space-y-3">
                    <Textarea
                      value={apuntesPresupuesto}
                      onChange={(e) => setApuntesPresupuesto(e.target.value)}
                      placeholder="Escriba aquí cualquier suceso o nota relevante del proceso de autorización de presupuesto..."
                      className="min-h-[100px] bg-background/50"
                    />
                    <Button
                      onClick={handleSaveApuntesPresupuesto}
                      disabled={savingApuntesPresupuesto}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {savingApuntesPresupuesto ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        "Guardar Apuntes"
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-foreground whitespace-pre-wrap">
                    {(requisicion as any).apuntes_presupuesto || "Sin apuntes registrados"}
                  </p>
                )}
              </div>
            )}

            {/* Apuntes de Tesorería - visible when in pedido_autorizado or later, editable only by tesoreria when pedido_autorizado, hidden from solicitador */}
            {requisicion && !isSolicitador && (requisicion.estado === 'pedido_autorizado' || (requisicion as any).apuntes_tesoreria) && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <h3 className="text-orange-400 font-semibold mb-2">Apuntes de Tesorería</h3>
                {requisicion.estado === 'pedido_autorizado' && (isTesoreria || isSuperadmin) ? (
                  <div className="space-y-3">
                    <Textarea
                      value={apuntesTesoreria}
                      onChange={(e) => setApuntesTesoreria(e.target.value)}
                      placeholder="Escriba aquí cualquier suceso o nota relevante del proceso de pago..."
                      className="min-h-[100px] bg-background/50"
                    />
                    <Button
                      onClick={handleSaveApuntesTesoreria}
                      disabled={savingApuntesTesoreria}
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {savingApuntesTesoreria ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        "Guardar Apuntes"
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-foreground whitespace-pre-wrap">
                    {(requisicion as any).apuntes_tesoreria || "Sin apuntes registrados"}
                  </p>
                )}
              </div>
            )}

            {/* Información Relevante - editable por cualquier usuario con historial */}
            {requisicion && (
              <div className="bg-accent/20 border border-accent/30 rounded-lg p-4">
                <h3 className="text-accent-foreground font-semibold mb-3">Información Relevante</h3>
                
                {/* Historial de cambios */}
                {textoComprasHistorial.length > 0 && (
                  <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
                    {textoComprasHistorial.map((entry) => (
                      <div key={entry.id} className="text-sm border-l-2 border-accent/50 pl-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                          <span>{format(new Date(entry.editado_at), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                          <span>por <span className="font-medium text-foreground">{entry.editor_name}</span></span>
                          {entry.editor_role && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {entry.editor_role}
                            </Badge>
                          )}
                          {entry.estado_al_comentar && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Etapa: {entry.estado_al_comentar.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-foreground">{entry.texto}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Input para nuevo texto */}
                <div className="space-y-3">
                  <Textarea
                    value={textoCompras}
                    onChange={(e) => setTextoCompras(e.target.value)}
                    placeholder="Escriba aquí notas, comentarios o información relevante..."
                    className="min-h-[80px] bg-background/50"
                  />
                  <Button
                    onClick={handleSaveTextoCompras}
                    disabled={savingTextoCompras || !textoCompras.trim()}
                    size="sm"
                  >
                    {savingTextoCompras ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      "Agregar Comentario"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* AI Assistance */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                <h3 className="text-foreground font-semibold">Asistencia con IA</h3>
              </div>
              <p className="text-muted-foreground text-sm mb-3">
                Obtén una recomendación basada en IA para este trámite.
              </p>
              
              {aiAnalysis ? (
                <div className="bg-background/50 rounded-lg p-4 mt-3">
                  <ScrollArea className="max-h-64">
                    <div className="text-foreground text-sm whitespace-pre-wrap prose prose-invert prose-sm max-w-none">
                      {aiAnalysis}
                    </div>
                  </ScrollArea>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    onClick={() => setAiAnalysis(null)}
                  >
                    Limpiar análisis
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyzeWithAI}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    "Analizar Trámite"
                  )}
                </Button>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={handleDownloadPDF}>
                <Download className="w-4 h-4 mr-2" />
                Descargar PDF
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
              {canEditPending() && (
                <Button
                  variant="outline"
                  onClick={handleEditPending}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}
              {canEditRejected() && (
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleEditRejected}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar y Reenviar
                </Button>
              )}
              {canRestore() && (
                <Button
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-600/10"
                  onClick={() => setShowRestoreConfirm(true)}
                  disabled={restoreLoading}
                >
                  {restoreLoading ? "Restaurando..." : "Restaurar"}
                </Button>
              )}
              {canDelete() && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? "Eliminando..." : "Eliminar"}
                </Button>
              )}
              {canCancel() && (
                <Button
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  Cancelar Trámite
                </Button>
              )}
              {canRevert() && (
                <Button
                  variant="secondary"
                  onClick={handleRevert}
                  disabled={actionLoading}
                >
                  Revertir a Pendiente
                </Button>
              )}
              {canAuthorize() && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => setShowRejectByAutorizadorConfirm(true)}
                    disabled={actionLoading}
                  >
                    Rechazar
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleApprove}
                    disabled={actionLoading}
                  >
                    Aprobar
                  </Button>
                </>
              )}
              {canRejectBeforeLicitacion() && (
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectByCompradorConfirm(true)}
                  disabled={actionLoading}
                >
                  Rechazar
                </Button>
              )}
              {canMoveToLicitacion() && (
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleMoveToLicitacion}
                  disabled={actionLoading}
                >
                  Pasar a Licitación
                </Button>
              )}
              {canMoveToPedidoColocado() && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="montoTotal" className="text-sm whitespace-nowrap">Monto Total:</Label>
                    <Input
                      id="montoTotal"
                      type="number"
                      placeholder="0.00"
                      value={montoTotalCompra}
                      onChange={(e) => setMontoTotalCompra(e.target.value)}
                      className="w-32"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <Button
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={handleMoveToPedidoColocado}
                    disabled={actionLoading || !montoTotalCompra}
                  >
                    Colocar Pedido
                  </Button>
                </div>
              )}
              {canRejectByPresupuestos() && (
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectByPresupuestosConfirm(true)}
                  disabled={actionLoading}
                >
                  Rechazar
                </Button>
              )}
              {canAuthorizePedido() && (
                <Button
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={handleAuthorizePedido}
                  disabled={actionLoading}
                >
                  Autorizar Pedido
                </Button>
              )}
              {canPayPedido() && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={handlePayPedido}
                  disabled={actionLoading}
                >
                  Marcar como Pagado
                </Button>
              )}
              {canHandlePresupuestosRejection() && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => setShowRejectPresupuestosToSolicitadorConfirm(true)}
                    disabled={actionLoading}
                  >
                    Devolver a Solicitador
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleAcceptPresupuestosRejection}
                    disabled={actionLoading}
                  >
                    Aprobar y Reenviar a Presupuestos
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={isSuperadmin ? "flex items-center gap-2" : ""}>
              {isSuperadmin && <AlertTriangle className="w-5 h-5 text-destructive" />}
              ¿Eliminar {tramiteTipo?.toLowerCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSuperadmin ? (
                <>
                  <strong className="text-destructive">Esta acción es permanente e irreversible.</strong>
                  <br />
                  El trámite <strong>{reposicion?.folio || requisicion?.folio}</strong> y todos sus datos relacionados serán eliminados definitivamente.
                </>
              ) : (
                <>
                  Esta acción eliminará la requisición <strong>{requisicion?.folio}</strong>. 
                  Solo el superadmin podrá restaurarla posteriormente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowDeleteConfirm(false);
                handleDelete();
              }}
            >
              {isSuperadmin ? "Eliminar Permanentemente" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar requisición?</AlertDialogTitle>
            <AlertDialogDescription>
              La requisición <strong>{requisicion?.folio}</strong> será restaurada 
              y volverá a aparecer en la lista de trámites activos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => {
                setShowRestoreConfirm(false);
                handleRestore();
              }}
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Before Licitación Confirmation Dialog */}
      <AlertDialog open={showRejectByCompradorConfirm} onOpenChange={setShowRejectByCompradorConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar requisición?</AlertDialogTitle>
            <AlertDialogDescription>
              La requisición <strong>{requisicion?.folio}</strong> será devuelta al solicitador
              con la justificación del rechazo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-justification" className="text-sm font-medium">
              Justificación del rechazo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-justification"
              value={rejectJustification}
              onChange={(e) => setRejectJustification(e.target.value)}
              placeholder="Ingrese el motivo del rechazo..."
              className="mt-2"
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setRejectJustification("");
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRejectBeforeLicitacion}
              disabled={actionLoading || !rejectJustification.trim()}
            >
              {actionLoading ? "Rechazando..." : "Confirmar Rechazo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject by Presupuestos Confirmation Dialog */}
      <AlertDialog open={showRejectByPresupuestosConfirm} onOpenChange={setShowRejectByPresupuestosConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              ¿Rechazar requisición?
            </AlertDialogTitle>
            <AlertDialogDescription>
              La requisición <strong>{requisicion?.folio}</strong> será marcada como rechazada por el área de Presupuestos.
              El autorizador asignado será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-presupuestos-justification" className="text-sm font-medium">
              Justificación del rechazo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-presupuestos-justification"
              value={rejectPresupuestosJustification}
              onChange={(e) => setRejectPresupuestosJustification(e.target.value)}
              placeholder="Ingrese el motivo del rechazo..."
              className="mt-2"
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setRejectPresupuestosJustification("");
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRejectByPresupuestos}
              disabled={actionLoading || !rejectPresupuestosJustification.trim()}
            >
              {actionLoading ? "Rechazando..." : "Confirmar Rechazo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject to Solicitador Confirmation Dialog (Autorizador handling presupuestos rejection) */}
      <AlertDialog open={showRejectPresupuestosToSolicitadorConfirm} onOpenChange={setShowRejectPresupuestosToSolicitadorConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              ¿Devolver requisición al solicitador?
            </AlertDialogTitle>
            <AlertDialogDescription>
              La requisición <strong>{requisicion?.folio}</strong> será devuelta al solicitador para que realice las correcciones necesarias.
              El proceso comenzará nuevamente desde el inicio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-presupuestos-to-solicitador-justification" className="text-sm font-medium">
              Justificación para el solicitador <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-presupuestos-to-solicitador-justification"
              value={rejectPresupuestosToSolicitadorJustification}
              onChange={(e) => setRejectPresupuestosToSolicitadorJustification(e.target.value)}
              placeholder="Ingrese el motivo por el cual se devuelve al solicitador..."
              className="mt-2"
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setRejectPresupuestosToSolicitadorJustification("");
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRejectPresupuestosToSolicitador}
              disabled={actionLoading || !rejectPresupuestosToSolicitadorJustification.trim()}
            >
              {actionLoading ? "Procesando..." : "Confirmar Devolución"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject by Autorizador Confirmation Dialog */}
      <AlertDialog open={showRejectByAutorizadorConfirm} onOpenChange={setShowRejectByAutorizadorConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar trámite?</AlertDialogTitle>
            <AlertDialogDescription>
              El trámite <strong>{tramite?.folio}</strong> será devuelto al solicitador
              para que realice las correcciones necesarias.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-autorizador-justification" className="text-sm font-medium">
              Justificación del rechazo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-autorizador-justification"
              value={rejectAutorizadorJustification}
              onChange={(e) => setRejectAutorizadorJustification(e.target.value)}
              placeholder="Ingrese el motivo del rechazo..."
              className="mt-2"
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setRejectAutorizadorJustification("");
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleReject}
              disabled={actionLoading || !rejectAutorizadorJustification.trim()}
            >
              {actionLoading ? "Rechazando..." : "Confirmar Rechazo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de vista previa de archivos */}
      <FilePreviewModal
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        file={previewFile}
      />
    </Dialog>
  );
};

export default TramiteDetailDialog;
