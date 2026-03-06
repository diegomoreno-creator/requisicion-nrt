import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Loader2, Package, PackageCheck, Plus, Upload, X, Eye } from "lucide-react";
import FilePreviewModal from "@/components/FilePreviewModal";

interface RequisicionPagada {
  id: string;
  folio: string;
  asunto: string | null;
  empresa: string | null;
  fecha_pago: string | null;
  monto_total_compra: number | null;
  presupuesto_aproximado: number | null;
  solicitado_por: string;
  estado: string;
}

interface Partida {
  id: string;
  numero_partida: number;
  descripcion: string | null;
  cantidad: number | null;
  unidad_medida: string | null;
  sucursal: string | null;
}

interface EntradaAlmacen {
  id: string;
  fecha_recepcion: string;
  recibido_por: string;
  ubicacion_almacen: string | null;
  numero_remision: string | null;
  numero_guia: string | null;
  condicion_material: string | null;
  observaciones: string | null;
  created_at: string;
}

interface EntradaPartida {
  id: string;
  partida_id: string;
  cantidad_recibida: number;
  observaciones: string | null;
}

const Almacen = () => {
  const navigate = useNavigate();
  const { user, hasRole, isSuperadmin, loading: authLoading } = useAuth();
  const [requisiciones, setRequisiciones] = useState<RequisicionPagada[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<RequisicionPagada | null>(null);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [entradasPrevias, setEntradasPrevias] = useState<EntradaAlmacen[]>([]);
  const [entradasPartidasPrevias, setEntradasPartidasPrevias] = useState<EntradaPartida[]>([]);
  const [showEntradaDialog, setShowEntradaDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [solicitanteNames, setSolicitanteNames] = useState<Record<string, string>>({});
  const [receiverNames, setReceiverNames] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [previewFile, setPreviewFile] = useState<{ file_name: string; file_url: string; file_type?: string } | null>(null);

  // Form state
  const [ubicacionAlmacen, setUbicacionAlmacen] = useState("");
  const [numeroRemision, setNumeroRemision] = useState("");
  const [numeroGuia, setNumeroGuia] = useState("");
  const [condicionMaterial, setCondicionMaterial] = useState("bueno");
  const [observaciones, setObservaciones] = useState("");
  const [cantidadesRecibidas, setCantidadesRecibidas] = useState<Record<string, number>>({});
  const [obsPartidas, setObsPartidas] = useState<Record<string, string>>({});
  const [archivos, setArchivos] = useState<File[]>([]);

  const hasAccess = hasRole('almacen') || isSuperadmin;

  useEffect(() => {
    if (!authLoading && !hasAccess) {
      navigate("/dashboard");
      toast.error("No tienes acceso al módulo de Almacén");
    }
  }, [authLoading, hasAccess]);

  useEffect(() => {
    if (hasAccess) fetchRequisiciones();
  }, [hasAccess]);

  const fetchRequisiciones = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("requisiciones")
      .select("id, folio, asunto, empresa, fecha_pago, monto_total_compra, presupuesto_aproximado, solicitado_por, estado, es_pedido_almacen")
      .in("estado", ["pedido_pagado", "en_almacen"])
      .eq("es_pedido_almacen", true)
      .is("deleted_at", null)
      .order("fecha_pago", { ascending: false });

    if (error) {
      toast.error("Error al cargar requisiciones");
      console.error(error);
    } else {
      setRequisiciones(data || []);
      // Fetch solicitante names
      const userIds = [...new Set((data || []).map(r => r.solicitado_por))];
      const names: Record<string, string> = {};
      await Promise.all(userIds.map(async (uid) => {
        const { data: nameData } = await supabase.rpc('get_profile_name', { _user_id: uid });
        if (nameData) names[uid] = nameData;
      }));
      setSolicitanteNames(names);
    }
    setLoading(false);
  };

  const openReqDetail = async (req: RequisicionPagada) => {
    setSelectedReq(req);
    
    // Fetch partidas
    const { data: partidasData } = await supabase
      .from("requisicion_partidas")
      .select("id, numero_partida, descripcion, cantidad, unidad_medida, sucursal")
      .eq("requisicion_id", req.id)
      .order("numero_partida");
    setPartidas(partidasData || []);

    // Fetch previous entries
    const { data: entradasData } = await supabase
      .from("entradas_almacen" as any)
      .select("*")
      .eq("requisicion_id", req.id)
      .order("fecha_recepcion", { ascending: false });
    setEntradasPrevias((entradasData as any[]) || []);

    // Fetch receiver names for previous entries
    if (entradasData && entradasData.length > 0) {
      const receiverIds = [...new Set((entradasData as any[]).map((e: any) => e.recibido_por))];
      const rNames: Record<string, string> = {};
      await Promise.all(receiverIds.map(async (uid: string) => {
        const { data: nameData } = await supabase.rpc('get_profile_name', { _user_id: uid });
        if (nameData) rNames[uid] = nameData;
      }));
      setReceiverNames(prev => ({ ...prev, ...rNames }));
    }

    // Fetch previous entrada partidas
    if (entradasData && entradasData.length > 0) {
      const entradaIds = (entradasData as any[]).map((e: any) => e.id);
      const { data: epData } = await supabase
        .from("entrada_almacen_partidas" as any)
        .select("*")
        .in("entrada_almacen_id", entradaIds);
      setEntradasPartidasPrevias((epData as any[]) || []);
    } else {
      setEntradasPartidasPrevias([]);
    }
  };

  const getCantidadRecibidaTotal = (partidaId: string): number => {
    return entradasPartidasPrevias
      .filter(ep => ep.partida_id === partidaId)
      .reduce((sum, ep) => sum + Number(ep.cantidad_recibida), 0);
  };

  const openEntradaForm = () => {
    setUbicacionAlmacen("");
    setNumeroRemision("");
    setNumeroGuia("");
    setCondicionMaterial("bueno");
    setObservaciones("");
    setArchivos([]);
    const initial: Record<string, number> = {};
    const initialObs: Record<string, string> = {};
    partidas.forEach(p => {
      initial[p.id] = 0;
      initialObs[p.id] = "";
    });
    setCantidadesRecibidas(initial);
    setObsPartidas(initialObs);
    setShowEntradaDialog(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setArchivos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setArchivos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveEntrada = async () => {
    if (!user || !selectedReq) return;
    
    const hasAnyQuantity = Object.values(cantidadesRecibidas).some(v => v > 0);
    if (!hasAnyQuantity) {
      toast.error("Debes registrar al menos una cantidad recibida");
      return;
    }

    setSaving(true);
    try {
      // 1. Create entrada
      const { data: entrada, error: entradaError } = await supabase
        .from("entradas_almacen" as any)
        .insert({
          requisicion_id: selectedReq.id,
          recibido_por: user.id,
          ubicacion_almacen: ubicacionAlmacen || null,
          numero_remision: numeroRemision || null,
          numero_guia: numeroGuia || null,
          condicion_material: condicionMaterial,
          observaciones: observaciones || null,
        } as any)
        .select()
        .single();

      if (entradaError) throw entradaError;

      const entradaId = (entrada as any).id;

      // 2. Insert partida quantities
      const partidaEntries = Object.entries(cantidadesRecibidas)
        .filter(([_, qty]) => qty > 0)
        .map(([partidaId, qty]) => ({
          entrada_almacen_id: entradaId,
          partida_id: partidaId,
          cantidad_recibida: qty,
          observaciones: obsPartidas[partidaId] || null,
        }));

      if (partidaEntries.length > 0) {
        const { error: partidasError } = await supabase
          .from("entrada_almacen_partidas" as any)
          .insert(partidaEntries as any);
        if (partidasError) throw partidasError;
      }

      // 3. Upload files
      for (const file of archivos) {
        const filePath = `${selectedReq.id}/${entradaId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("almacen_archivos")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("almacen_archivos")
          .getPublicUrl(filePath);

        await supabase
          .from("entrada_almacen_archivos" as any)
          .insert({
            entrada_almacen_id: entradaId,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
          } as any);
      }

      // 4. Check if all partidas are fully received -> update estado to en_almacen
      const allPartidasReceived = partidas.every(p => {
        const totalRecibido = getCantidadRecibidaTotal(p.id) + (cantidadesRecibidas[p.id] || 0);
        return totalRecibido >= (p.cantidad || 0);
      });

      if (allPartidasReceived && selectedReq.estado === "pedido_pagado") {
        await supabase
          .from("requisiciones")
          .update({ 
            estado: "en_almacen" as any,
            fecha_almacen: new Date().toISOString(),
            almacen_recibido_por: user.id,
          } as any)
          .eq("id", selectedReq.id);
      }

      toast.success("Entrada de material registrada exitosamente");
      setShowEntradaDialog(false);
      
      // Refresh
      await openReqDetail(selectedReq);
      await fetchRequisiciones();
    } catch (err: any) {
      console.error(err);
      toast.error("Error al registrar la entrada: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const filteredRequisiciones = requisiciones.filter(r => {
    const term = searchTerm.toLowerCase();
    return r.folio.toLowerCase().includes(term) || 
      (r.asunto || "").toLowerCase().includes(term) ||
      (r.empresa || "").toLowerCase().includes(term) ||
      (solicitanteNames[r.solicitado_por] || "").toLowerCase().includes(term);
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Almacén - Entradas de Material</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Search */}
        <div className="mb-6">
          <Input
            placeholder="Buscar por folio, asunto, empresa o solicitante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Requisiciones list */}
        <div className="grid gap-4">
          {filteredRequisiciones.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No hay requisiciones pagadas pendientes de recepción en almacén.
              </CardContent>
            </Card>
          ) : (
            filteredRequisiciones.map(req => (
              <Card 
                key={req.id} 
                className="border-border hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => openReqDetail(req)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary">{req.folio}</span>
                      <Badge variant={req.estado === "en_almacen" ? "default" : "outline"} className={
                        req.estado === "en_almacen" 
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                          : ""
                      }>
                        {req.estado === "en_almacen" ? "Recibido" : "Pendiente de recepción"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{req.asunto || "Sin asunto"}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{req.empresa}</span>
                      <span>Solicitante: {solicitanteNames[req.solicitado_por] || "..."}</span>
                      {req.fecha_pago && (
                        <span>Pagado: {format(new Date(req.fecha_pago), "d/MMM/yy", { locale: es })}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      ${(req.monto_total_compra || req.presupuesto_aproximado || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* Detail Dialog */}
      {selectedReq && (
        <Dialog open={!!selectedReq} onOpenChange={(open) => !open && setSelectedReq(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {selectedReq.folio} - Entradas de Material
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              {/* Partidas with received quantities */}
              <div className="mb-6">
                <h3 className="font-semibold text-foreground mb-3">Partidas del pedido</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-20">Cant.</TableHead>
                      <TableHead className="w-20">Unidad</TableHead>
                      <TableHead className="w-28">Recibido</TableHead>
                      <TableHead className="w-28">Pendiente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partidas.map(p => {
                      const recibido = getCantidadRecibidaTotal(p.id);
                      const pendiente = Math.max(0, (p.cantidad || 0) - recibido);
                      return (
                        <TableRow key={p.id}>
                          <TableCell>{p.numero_partida}</TableCell>
                          <TableCell className="text-sm">{p.descripcion}</TableCell>
                          <TableCell>{p.cantidad}</TableCell>
                          <TableCell className="text-xs">{p.unidad_medida}</TableCell>
                          <TableCell>
                            <Badge variant={recibido >= (p.cantidad || 0) ? "default" : "outline"} className={
                              recibido >= (p.cantidad || 0) ? "bg-emerald-500/20 text-emerald-400" : ""
                            }>
                              {recibido}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {pendiente > 0 ? (
                              <Badge variant="outline" className="text-amber-400 border-amber-500/30">{pendiente}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Completo</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <Separator className="my-4" />

              {/* Previous entries */}
              {entradasPrevias.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-foreground mb-3">Historial de Entradas ({entradasPrevias.length})</h3>
                  <div className="space-y-3">
                    {entradasPrevias.map((entrada: any) => (
                      <Card key={entrada.id} className="border-border">
                        <CardContent className="p-3 space-y-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {format(new Date(entrada.fecha_recepcion), "d/MMM/yy HH:mm", { locale: es })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Recibido por: {receiverNames[entrada.recibido_por] || "..."}
                              </p>
                            </div>
                            <Badge variant="outline" className={
                              entrada.condicion_material === "bueno" ? "text-emerald-400 border-emerald-500/30" :
                              entrada.condicion_material === "dañado" ? "text-destructive border-destructive/30" :
                              "text-amber-400 border-amber-500/30"
                            }>
                              {entrada.condicion_material}
                            </Badge>
                          </div>
                          {entrada.ubicacion_almacen && (
                            <p className="text-xs text-muted-foreground">📍 {entrada.ubicacion_almacen}</p>
                          )}
                          {entrada.numero_remision && (
                            <p className="text-xs text-muted-foreground">Remisión: {entrada.numero_remision}</p>
                          )}
                          {entrada.numero_guia && (
                            <p className="text-xs text-muted-foreground">Guía: {entrada.numero_guia}</p>
                          )}
                          {entrada.observaciones && (
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{entrada.observaciones}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Register new entry button */}
              {selectedReq.estado === "pedido_pagado" && (
                <Button onClick={openEntradaForm} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Entrada de Material
                </Button>
              )}
              {selectedReq.estado === "en_almacen" && (
                <div className="text-center py-4">
                  <PackageCheck className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-emerald-400 font-medium">Material completamente recibido</p>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* New Entry Dialog */}
      <Dialog open={showEntradaDialog} onOpenChange={setShowEntradaDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Registrar Entrada de Material</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {/* General info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ubicación en Almacén</Label>
                  <Input value={ubicacionAlmacen} onChange={e => setUbicacionAlmacen(e.target.value)} placeholder="Ej: Rack A-3, Estante 2" />
                </div>
                <div className="space-y-2">
                  <Label>No. Remisión</Label>
                  <Input value={numeroRemision} onChange={e => setNumeroRemision(e.target.value)} placeholder="Número de remisión" />
                </div>
                <div className="space-y-2">
                  <Label>No. Guía</Label>
                  <Input value={numeroGuia} onChange={e => setNumeroGuia(e.target.value)} placeholder="Número de guía de envío" />
                </div>
                <div className="space-y-2">
                  <Label>Condición del Material</Label>
                  <Select value={condicionMaterial} onValueChange={setCondicionMaterial}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bueno">Bueno</SelectItem>
                      <SelectItem value="parcialmente_dañado">Parcialmente Dañado</SelectItem>
                      <SelectItem value="dañado">Dañado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Quantities per partida */}
              <div>
                <Label className="mb-3 block">Cantidades Recibidas por Partida</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-20">Solicitado</TableHead>
                      <TableHead className="w-20">Ya Recibido</TableHead>
                      <TableHead className="w-28">Recibido Ahora</TableHead>
                      <TableHead className="w-40">Observaciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partidas.map(p => {
                      const yaRecibido = getCantidadRecibidaTotal(p.id);
                      const pendiente = Math.max(0, (p.cantidad || 0) - yaRecibido);
                      return (
                        <TableRow key={p.id}>
                          <TableCell>{p.numero_partida}</TableCell>
                          <TableCell className="text-sm">{p.descripcion}</TableCell>
                          <TableCell>{p.cantidad}</TableCell>
                          <TableCell>{yaRecibido}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={pendiente}
                              value={cantidadesRecibidas[p.id] || 0}
                              onChange={e => setCantidadesRecibidas(prev => ({
                                ...prev,
                                [p.id]: Math.min(Number(e.target.value), pendiente)
                              }))}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={obsPartidas[p.id] || ""}
                              onChange={e => setObsPartidas(prev => ({ ...prev, [p.id]: e.target.value }))}
                              placeholder="Obs."
                              className="h-8 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Observaciones generales */}
              <div className="space-y-2">
                <Label>Observaciones Generales</Label>
                <Textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Observaciones adicionales sobre la entrega..."
                  rows={3}
                />
              </div>

              {/* File upload */}
              <div className="space-y-2">
                <Label>Evidencia Fotográfica</Label>
                <div className="border border-dashed border-border rounded-lg p-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Upload className="h-4 w-4" />
                    Agregar fotos/archivos
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  {archivos.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {archivos.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-2">
                          <span className="truncate">{file.name}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(idx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEntradaDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveEntrada} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackageCheck className="h-4 w-4 mr-2" />}
              Registrar Entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview */}
      {previewFile && (
        <FilePreviewModal
          open={!!previewFile}
          onOpenChange={() => setPreviewFile(null)}
          file={previewFile}
        />
      )}
    </div>
  );
};

export default Almacen;
