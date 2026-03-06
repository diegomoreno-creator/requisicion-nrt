import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, FileSignature } from "lucide-react";
import SignatureCanvas from "./SignatureCanvas";

interface CartaResponsivaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisicionId: string;
  folioOrdenCompra: string;
  fechaOrdenCompra: string | null;
  userId: string;
  userName: string;
  onSuccess: () => void;
}

interface ItemEntrega {
  id: string;
  cantidad: number;
  descripcion: string;
  numero_serie: string;
}

const CartaResponsivaForm = ({
  open,
  onOpenChange,
  requisicionId,
  folioOrdenCompra,
  fechaOrdenCompra,
  userId,
  userName,
  onSuccess,
}: CartaResponsivaFormProps) => {
  const [saving, setSaving] = useState(false);
  const [periodoSupervision, setPeriodoSupervision] = useState("");
  const [ubicacion, setUbicacion] = useState("Monclova, Coahuila de Zaragoza, México");
  const [recibidoPorNombre, setRecibidoPorNombre] = useState("");
  const [notas, setNotas] = useState("");
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null);
  const [items, setItems] = useState<ItemEntrega[]>([
    { id: crypto.randomUUID(), cantidad: 1, descripcion: "", numero_serie: "" },
  ]);

  const addItem = () => {
    setItems(prev => [...prev, { id: crypto.randomUUID(), cantidad: 1, descripcion: "", numero_serie: "" }]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof ItemEntrega, value: string | number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSave = async () => {
    // Validate
    if (!recibidoPorNombre.trim()) {
      toast.error("El nombre de quien recibe es obligatorio");
      return;
    }
    if (!firmaDataUrl) {
      toast.error("La firma digital de quien recibe es obligatoria");
      return;
    }
    const invalidItems = items.filter(i => !i.descripcion.trim() || !i.numero_serie.trim());
    if (invalidItems.length > 0) {
      toast.error("Todos los artículos deben tener descripción y número de serie");
      return;
    }

    setSaving(true);
    try {
      // Upload signature image
      const signatureBlob = await (await fetch(firmaDataUrl)).blob();
      const signaturePath = `firmas/${requisicionId}/${Date.now()}_firma.png`;
      const { error: uploadError } = await supabase.storage
        .from("almacen_archivos")
        .upload(signaturePath, signatureBlob, { contentType: "image/png" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("almacen_archivos")
        .getPublicUrl(signaturePath);

      // Insert entrega record
      const { data: entrega, error: entregaError } = await supabase
        .from("entregas_resguardo" as any)
        .insert({
          requisicion_id: requisicionId,
          folio_orden_compra: folioOrdenCompra,
          fecha_orden_compra: fechaOrdenCompra,
          periodo_supervision: periodoSupervision || null,
          ubicacion,
          entregado_por: userId,
          recibido_por_nombre: recibidoPorNombre,
          firma_recibido_url: urlData.publicUrl,
          notas: notas || null,
        } as any)
        .select()
        .single();

      if (entregaError) throw entregaError;

      // Insert items
      const itemInserts = items.map(i => ({
        entrega_resguardo_id: (entrega as any).id,
        cantidad: i.cantidad,
        descripcion: i.descripcion,
        numero_serie: i.numero_serie,
      }));

      const { error: itemsError } = await supabase
        .from("entrega_resguardo_items" as any)
        .insert(itemInserts as any);

      if (itemsError) throw itemsError;

      toast.success("Carta Responsiva registrada exitosamente");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error("Error al registrar: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Carta Responsiva de Resguardo
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <p className="text-sm">
                <span className="text-muted-foreground">Orden de compra:</span>{" "}
                <span className="font-mono font-bold text-primary">{folioOrdenCompra}</span>
                {fechaOrdenCompra && (
                  <span className="text-muted-foreground ml-3">
                    Fecha: {new Date(fechaOrdenCompra).toLocaleDateString("es-MX")}
                  </span>
                )}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Entrega:</span>{" "}
                <span className="font-medium">{userName}</span>
                <span className="text-xs text-muted-foreground ml-2">(Encargada Almacén)</span>
              </p>
            </div>

            {/* Period and location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Periodo de supervisión</Label>
                <Input
                  value={periodoSupervision}
                  onChange={e => setPeriodoSupervision(e.target.value)}
                  placeholder="Ej: enero - julio 2026"
                />
              </div>
              <div className="space-y-2">
                <Label>Ubicación</Label>
                <Input value={ubicacion} onChange={e => setUbicacion(e.target.value)} />
              </div>
            </div>

            {/* Items table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Bienes Entregados</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar artículo
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Cantidad</TableHead>
                    <TableHead>Descripción del Bien <span className="text-destructive">*</span></TableHead>
                    <TableHead className="w-40">No. Serie <span className="text-destructive">*</span></TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={item.cantidad}
                          onChange={e => updateItem(item.id, "cantidad", Number(e.target.value))}
                          className="h-9 w-16"
                        />
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={item.descripcion}
                          onChange={e => updateItem(item.id, "descripcion", e.target.value)}
                          placeholder="Nombre y descripción del artículo..."
                          rows={2}
                          className="min-h-[60px] text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.numero_serie}
                          onChange={e => updateItem(item.id, "numero_serie", e.target.value)}
                          placeholder="No. serie"
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Receiver section */}
            <div className="border border-border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-foreground">Recibe</h3>
              <div className="space-y-2">
                <Label>
                  Nombre completo de quien recibe <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={recibidoPorNombre}
                  onChange={e => setRecibidoPorNombre(e.target.value)}
                  placeholder="Nombre completo"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Firma digital <span className="text-destructive">*</span>
                </Label>
                <SignatureCanvas onSignatureChange={setFirmaDataUrl} />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas adicionales</Label>
              <Textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Ej: BLACKMAGIC ATEM – CONSOLA PARA USO EN PODCAST – JORGE RANGEL (REC1990)"
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSignature className="h-4 w-4 mr-2" />}
            Registrar Entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CartaResponsivaForm;
