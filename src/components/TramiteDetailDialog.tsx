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
import { ChevronRight, Download, Lightbulb, Loader2, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { renderNRTHeader } from "@/lib/pdfFonts";

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
  presupuesto_aproximado: number | null;
  datos_proveedor: string | null;
  datos_banco: string | null;
  deleted_at: string | null;
}

interface ReposicionDetail {
  id: string;
  folio: string;
  fecha_solicitud: string;
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

const TramiteDetailDialog = ({
  open,
  onOpenChange,
  tramiteId,
  tramiteTipo,
  onUpdated,
}: TramiteDetailDialogProps) => {
  const navigate = useNavigate();
  const { user, isAutorizador, isSuperadmin, isAdmin, isComprador, isPresupuestos, isTesoreria, isSolicitador } = useAuth();
  const { empresas, unidadesNegocio, sucursales } = useCatalogos();
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
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showRejectByCompradorConfirm, setShowRejectByCompradorConfirm] = useState(false);
  const [rejectJustification, setRejectJustification] = useState("");

  useEffect(() => {
    if (open && tramiteId && tramiteTipo) {
      fetchDetails();
      setAiAnalysis(null);
    }
  }, [open, tramiteId, tramiteTipo]);

  // Real-time subscription for status updates
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, tramiteId, tramiteTipo]);

  const fetchDetails = async () => {
    if (!tramiteId || !tramiteTipo) return;
    setLoading(true);

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
        setReposicion(null);

        // Fetch partidas
        const { data: partidasData } = await supabase
          .from("requisicion_partidas")
          .select("*")
          .eq("requisicion_id", tramiteId)
          .order("numero_partida");
        setPartidas(partidasData || []);
        setGastos([]);

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

  // Tesoreria: can move from pedido_autorizado to pedido_pagado
  const canPayPedido = () => {
    if (!requisicion || !user) return false;
    return requisicion.estado === "pedido_autorizado" && (isTesoreria || isSuperadmin);
  };

  // Solicitador can delete their own pending requisitions
  const canDelete = () => {
    if (!requisicion || !user) return false;
    // Can only delete if: user is owner, is pending, and not deleted already
    const isOwner = requisicion.solicitado_por === user.id;
    const isPending = requisicion.estado === "pendiente";
    const notDeleted = !requisicion.deleted_at;
    return isOwner && isPending && notDeleted && (isSolicitador || isAdmin || isSuperadmin);
  };

  // Superadmin can restore deleted requisitions
  const canRestore = () => {
    if (!requisicion || !user) return false;
    return requisicion.deleted_at !== null && isSuperadmin;
  };

  // Solicitador can edit their own rejected requisitions
  const canEditRejected = () => {
    if (!requisicion || !user) return false;
    const isOwner = requisicion.solicitado_por === user.id;
    const hasRejection = !!requisicion.justificacion_rechazo;
    const isPending = requisicion.estado === "pendiente";
    return isOwner && hasRejection && isPending;
  };

  const handleEditRejected = () => {
    if (requisicion) {
      onOpenChange(false);
      navigate(`/requisicion/${requisicion.id}`);
    }
  };

  const handleDelete = async () => {
    if (!tramiteId) return;
    setDeleteLoading(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Requisición eliminada exitosamente");
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Error al eliminar la requisición");
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
      const table = tramiteTipo === "Reposición" ? "reposiciones" : "requisiciones";
      const { error } = await supabase
        .from(table)
        .update({ 
          estado: "aprobado",
          autorizado_por: user.id,
          fecha_autorizacion_real: new Date().toISOString()
        })
        .eq("id", tramiteId);

      if (error) throw error;
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
    setActionLoading(true);

    try {
      const table = tramiteTipo === "Reposición" ? "reposiciones" : "requisiciones";
      const { error } = await supabase
        .from(table)
        .update({ estado: "rechazado" })
        .eq("id", tramiteId);

      if (error) throw error;
      toast.success("Trámite rechazado");
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
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from("requisiciones")
        .update({ 
          estado: "pedido_colocado",
          pedido_colocado_por: user.id,
          fecha_pedido_colocado: new Date().toISOString()
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
      addField("Sucursal", getSucursalNombre(requisicion.sucursal));
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
        head: [["#", "Descripción", "Cantidad", "Unidad", "Modelo/Parte", "Fecha Necesidad"]],
        body: partidas.map((partida) => [
          partida.numero_partida.toString(),
          partida.descripcion || "-",
          partida.cantidad?.toString() || "-",
          partida.unidad_medida || "-",
          partida.modelo_parte || "-",
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
                {timelineSteps.map((step, index) => (
                  <div key={step.key} className="flex items-center">
                    <div className="flex flex-col items-center min-w-[80px]">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                          index < currentStep
                            ? "bg-muted border-muted-foreground/50"
                            : index === currentStep
                            ? "bg-transparent border-red-500"
                            : "bg-muted border-muted-foreground/30"
                        }`}
                      >
                        {index === currentStep && (
                          <div className="w-3 h-3 rounded-full bg-red-500" />
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
                ))}
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
                      <p className="text-muted-foreground text-sm">Sucursal:</p>
                      <p className="text-foreground">{getSucursalNombre(requisicion.sucursal)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Departamento:</p>
                      <p className="text-foreground">
                        {requisicion.departamento_solicitante || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Presupuesto:</p>
                      <p className="text-foreground">
                        {formatCurrency(requisicion.presupuesto_aproximado)}
                      </p>
                    </div>
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
                        <TableHead className="text-muted-foreground">Descripción</TableHead>
                        <TableHead className="text-muted-foreground">Cantidad</TableHead>
                        <TableHead className="text-muted-foreground">Unidad</TableHead>
                        <TableHead className="text-muted-foreground">Modelo/Parte</TableHead>
                        <TableHead className="text-muted-foreground">Fecha Necesidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partidas.map((partida) => (
                        <TableRow key={partida.id} className="hover:bg-muted/20">
                          <TableCell>{partida.numero_partida}</TableCell>
                          <TableCell>{partida.descripcion || "-"}</TableCell>
                          <TableCell>{partida.cantidad || "-"}</TableCell>
                          <TableCell>{partida.unidad_medida || "-"}</TableCell>
                          <TableCell>{partida.modelo_parte || "-"}</TableCell>
                          <TableCell>{formatDate(partida.fecha_necesidad)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
            {requisicion?.justificacion_rechazo && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                <h3 className="text-destructive font-semibold mb-2">Justificación del Rechazo</h3>
                <p className="text-foreground">
                  {requisicion.justificacion_rechazo}
                </p>
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
                    onClick={handleReject}
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
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={handleMoveToPedidoColocado}
                  disabled={actionLoading}
                >
                  Colocar Pedido
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
            </div>
          </div>
        )}
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar requisición?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la requisición <strong>{requisicion?.folio}</strong>. 
              Solo el superadmin podrá restaurarla posteriormente.
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
              Eliminar
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
    </Dialog>
  );
};

export default TramiteDetailDialog;
