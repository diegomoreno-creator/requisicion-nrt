import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCatalogos } from "@/hooks/useCatalogos";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2, Calculator } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const mesesOperacion = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const tiposProveedor = [
  "Persona Física",
  "Persona Moral",
  "Extranjero",
  "Gobierno",
  "Asociación Civil",
];

const ContabilidadGastos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sucursales, loading: loadingCatalogos } = useCatalogos();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    sucursal: "",
    mesOperacion: "",
    nota: "",
    tipoProveedor: "",
    rfc: "",
    nombreProveedor: "",
    numeroCheque: "",
    importeExento: "",
    importe16: "",
    ivaAcred16: "",
    importe8: "",
    ivaAcred8: "",
    sueldo: "",
    ispt: "",
    isrRetHono: "",
    isrRetArre: "",
    isrRetResico: "",
    ivaRet: "",
    ivaRetExtra: "",
  });

  // Fetch user name
  useEffect(() => {
    const fetchUserName = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();
      if (data?.full_name) {
        setUserName(data.full_name);
      }
    };
    fetchUserName();
  }, [user?.id]);

  // Calculate total
  const calculateTotal = () => {
    const importeExento = parseFloat(formData.importeExento) || 0;
    const importe16 = parseFloat(formData.importe16) || 0;
    const ivaAcred16 = parseFloat(formData.ivaAcred16) || 0;
    const importe8 = parseFloat(formData.importe8) || 0;
    const ivaAcred8 = parseFloat(formData.ivaAcred8) || 0;
    const sueldo = parseFloat(formData.sueldo) || 0;
    const ispt = parseFloat(formData.ispt) || 0;
    const isrRetHono = parseFloat(formData.isrRetHono) || 0;
    const isrRetArre = parseFloat(formData.isrRetArre) || 0;
    const isrRetResico = parseFloat(formData.isrRetResico) || 0;
    const ivaRet = parseFloat(formData.ivaRet) || 0;
    const ivaRetExtra = parseFloat(formData.ivaRetExtra) || 0;

    // Total = sum of positive amounts - retentions
    const totalPositivo = importeExento + importe16 + ivaAcred16 + importe8 + ivaAcred8 + sueldo;
    const totalRetenciones = ispt + isrRetHono + isrRetArre + isrRetResico + ivaRet + ivaRetExtra;
    
    return totalPositivo - totalRetenciones;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para registrar gastos",
        variant: "destructive",
      });
      return;
    }

    if (!formData.sucursal || !formData.mesOperacion) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa Sucursal y Mes de Operación",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("contabilidad_gastos").insert({
        usuario_id: user.id,
        sucursal: formData.sucursal,
        mes_operacion: formData.mesOperacion,
        nota: formData.nota || null,
        tipo_proveedor: formData.tipoProveedor || null,
        rfc: formData.rfc || null,
        nombre_proveedor: formData.nombreProveedor || null,
        numero_cheque: formData.numeroCheque || null,
        importe_exento: parseFloat(formData.importeExento) || 0,
        importe_16: parseFloat(formData.importe16) || 0,
        iva_acred_16: parseFloat(formData.ivaAcred16) || 0,
        importe_8: parseFloat(formData.importe8) || 0,
        iva_acred_8: parseFloat(formData.ivaAcred8) || 0,
        sueldo: parseFloat(formData.sueldo) || 0,
        ispt: parseFloat(formData.ispt) || 0,
        isr_ret_hono: parseFloat(formData.isrRetHono) || 0,
        isr_ret_arre: parseFloat(formData.isrRetArre) || 0,
        isr_ret_resico: parseFloat(formData.isrRetResico) || 0,
        iva_ret: parseFloat(formData.ivaRet) || 0,
        iva_ret_extra: parseFloat(formData.ivaRetExtra) || 0,
        total: calculateTotal(),
      });

      if (error) throw error;

      toast({
        title: "Gasto registrado",
        description: "El registro se guardó correctamente",
      });

      // Reset form
      setFormData({
        sucursal: formData.sucursal, // Keep sucursal
        mesOperacion: formData.mesOperacion, // Keep mes
        nota: "",
        tipoProveedor: "",
        rfc: "",
        nombreProveedor: "",
        numeroCheque: "",
        importeExento: "",
        importe16: "",
        ivaAcred16: "",
        importe8: "",
        ivaAcred8: "",
        sueldo: "",
        ispt: "",
        isrRetHono: "",
        isrRetArre: "",
        isrRetResico: "",
        ivaRet: "",
        ivaRetExtra: "",
      });
    } catch (error: any) {
      console.error("Error saving gasto:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el registro",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = calculateTotal();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground">
              Registro de Gastos - Contabilidad
            </h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Form */}
      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Context Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Información General
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Sucursal *</Label>
                <Select
                  value={formData.sucursal}
                  onValueChange={(value) => handleInputChange("sucursal", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.nombre}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Usuario</Label>
                <Input value={userName || user?.email || ""} disabled className="bg-muted" />
              </div>

              <div className="space-y-2">
                <Label>Mes de Operación *</Label>
                <Select
                  value={formData.mesOperacion}
                  onValueChange={(value) => handleInputChange("mesOperacion", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {mesesOperacion.map((mes) => (
                      <SelectItem key={mes} value={mes}>
                        {mes}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nota</Label>
                <Input
                  value={formData.nota}
                  onChange={(e) => handleInputChange("nota", e.target.value)}
                  placeholder="Nota opcional"
                />
              </div>
            </CardContent>
          </Card>

          {/* Provider Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Datos del Proveedor</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Proveedor</Label>
                <Select
                  value={formData.tipoProveedor}
                  onValueChange={(value) => handleInputChange("tipoProveedor", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposProveedor.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>RFC</Label>
                <Input
                  value={formData.rfc}
                  onChange={(e) => handleInputChange("rfc", e.target.value.toUpperCase())}
                  placeholder="RFC del proveedor"
                  maxLength={13}
                />
              </div>

              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={formData.nombreProveedor}
                  onChange={(e) => handleInputChange("nombreProveedor", e.target.value)}
                  placeholder="Nombre del proveedor"
                />
              </div>

              <div className="space-y-2">
                <Label>Número de Cheque</Label>
                <Input
                  value={formData.numeroCheque}
                  onChange={(e) => handleInputChange("numeroCheque", e.target.value)}
                  placeholder="Número de cheque"
                />
              </div>
            </CardContent>
          </Card>

          {/* Financial Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Importes e IVA</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Importe Exento</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.importeExento}
                  onChange={(e) => handleInputChange("importeExento", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Importe 16%</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.importe16}
                  onChange={(e) => handleInputChange("importe16", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>IVA Acred. 16%</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.ivaAcred16}
                  onChange={(e) => handleInputChange("ivaAcred16", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Importe 8%</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.importe8}
                  onChange={(e) => handleInputChange("importe8", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>IVA Acred. 8%</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.ivaAcred8}
                  onChange={(e) => handleInputChange("ivaAcred8", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </CardContent>
          </Card>

          {/* Salaries and Retentions Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sueldos y Retenciones</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Sueldo *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.sueldo}
                  onChange={(e) => handleInputChange("sueldo", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>ISPT *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.ispt}
                  onChange={(e) => handleInputChange("ispt", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>ISR Ret. Hono</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.isrRetHono}
                  onChange={(e) => handleInputChange("isrRetHono", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>ISR Ret. Arre</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.isrRetArre}
                  onChange={(e) => handleInputChange("isrRetArre", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>ISR Ret. RESICO</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.isrRetResico}
                  onChange={(e) => handleInputChange("isrRetResico", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>IVA Ret.</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.ivaRet}
                  onChange={(e) => handleInputChange("ivaRet", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>IVA Ret. Extra *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.ivaRetExtra}
                  onChange={(e) => handleInputChange("ivaRetExtra", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </CardContent>
          </Card>

          {/* Total and Submit */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                  <p className="text-sm text-muted-foreground">Total Calculado</p>
                  <p className="text-3xl font-bold text-primary">
                    ${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting || loadingCatalogos}
                  className="w-full md:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar Registro
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
};

export default ContabilidadGastos;
