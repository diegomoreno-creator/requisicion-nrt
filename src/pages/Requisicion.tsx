import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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

interface Partida {
  id: string;
  numero_partida: number;
  descripcion: string;
  modelo_parte: string;
  unidad_medida: string;
  cantidad: number;
  fecha_necesidad: Date | null;
}

interface UserOption {
  user_id: string;
  email: string;
  full_name: string | null;
}

const tiposRequisicion = [
  "Compra de materiales",
  "Servicios",
  "Equipos",
  "Suministros de oficina",
  "Otro",
];

const unidadesNegocio = [
  "Corporativo",
  "Comercial",
  "Industrial",
  "Residencial",
];

const empresas = [
  "NRT México",
  "NRT Servicios",
  "NRT Comercial",
];

const sucursales = [
  "CDMX",
  "Monterrey",
  "Guadalajara",
  "Querétaro",
];

const Requisicion = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, canAccessApp } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autorizadores, setAutorizadores] = useState<UserOption[]>([]);

  // Form state
  const [folio] = useState(`REQ-${Date.now()}`);
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
  const [justificacion, setJustificacion] = useState("");

  // Partidas state
  const [partidas, setPartidas] = useState<Partida[]>([
    {
      id: crypto.randomUUID(),
      numero_partida: 1,
      descripcion: "",
      modelo_parte: "",
      unidad_medida: "",
      cantidad: 1,
      fecha_necesidad: new Date(),
    },
  ]);

  useEffect(() => {
    if (!authLoading && !canAccessApp) {
      navigate("/");
    }
  }, [authLoading, canAccessApp, navigate]);

  useEffect(() => {
    fetchAutorizadores();
  }, []);

  const fetchAutorizadores = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name");

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
      partidas.map((p) => (p.id === id ? { ...p, [field]: value } : p))
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
      // Insert requisicion
      const { data: requisicion, error: reqError } = await supabase
        .from("requisiciones")
        .insert({
          folio,
          tipo_requisicion: tipoRequisicion,
          unidad_negocio: unidadNegocio,
          empresa,
          fecha_autorizacion: fechaAutorizacion?.toISOString().split("T")[0],
          sucursal,
          autorizador_id: autorizadorId || null,
          departamento_solicitante: departamentoSolicitante,
          solicitado_por: user.id,
          presupuesto_aproximado: presupuestoAproximado ? parseFloat(presupuestoAproximado) : null,
          se_dividira_gasto: seDividiraGasto,
          un_division_gasto: seDividiraGasto ? unDivisionGasto : null,
          porcentaje_cada_un: seDividiraGasto ? porcentajeCadaUn : null,
          datos_proveedor: datosProveedor,
          datos_banco: datosBanco,
          nombre_proyecto: nombreProyecto,
          justificacion,
          estado: "borrador",
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // Insert partidas
      const partidasToInsert = partidas.map((p) => ({
        requisicion_id: requisicion.id,
        numero_partida: p.numero_partida,
        descripcion: p.descripcion,
        modelo_parte: p.modelo_parte,
        unidad_medida: p.unidad_medida,
        cantidad: p.cantidad,
        fecha_necesidad: p.fecha_necesidad?.toISOString().split("T")[0],
      }));

      const { error: partidasError } = await supabase
        .from("requisicion_partidas")
        .insert(partidasToInsert);

      if (partidasError) throw partidasError;

      toast.success("Requisición guardada exitosamente");
      navigate("/tramites");
    } catch (error: any) {
      console.error("Error saving requisicion:", error);
      toast.error(error.message || "Error al guardar la requisición");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
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
            onClick={() => navigate("/dashboard")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-2xl font-bold text-primary">
            Formato de Requisición
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="border-border bg-card mb-6">
            <CardContent className="p-6 space-y-6">
              {/* Tipo de requisición */}
              <div className="space-y-2">
                <Label className="text-foreground">Tipo de requisición</Label>
                <Select value={tipoRequisicion} onValueChange={setTipoRequisicion}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Seleccione un tipo de requisición" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border z-50">
                    {tiposRequisicion.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Row: Unidad, Folio, Empresa, Fecha */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Unidad de negocio</Label>
                  <Select value={unidadNegocio} onValueChange={setUnidadNegocio}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Seleccione una unidad" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border z-50">
                      {unidadesNegocio.map((unidad) => (
                        <SelectItem key={unidad} value={unidad}>
                          {unidad}
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
                  <Label className="text-foreground">Empresa</Label>
                  <Select value={empresa} onValueChange={setEmpresa}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Seleccione una empresa" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border z-50">
                      {empresas.map((emp) => (
                        <SelectItem key={emp} value={emp}>
                          {emp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

              {/* Row: Sucursal, Autorizador, Departamento, Solicitado por */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Sucursal</Label>
                  <Select value={sucursal} onValueChange={setSucursal}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Seleccione una sucursal" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border z-50">
                      {sucursales.map((suc) => (
                        <SelectItem key={suc} value={suc}>
                          {suc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                <div className="space-y-2">
                  <Label className="text-foreground">Departamento Solicitante</Label>
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
                        <TableHead className="text-muted-foreground">Descripción</TableHead>
                        <TableHead className="text-muted-foreground">Modelo/# Parte</TableHead>
                        <TableHead className="text-muted-foreground w-24">UM</TableHead>
                        <TableHead className="text-muted-foreground w-24">Cantidad</TableHead>
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
                    onChange={(e) => setPresupuestoAproximado(e.target.value)}
                    className="bg-input border-border"
                    placeholder="0.00"
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
                <Label className="text-foreground">Justificación</Label>
                <Textarea
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  className="bg-input border-border min-h-24"
                />
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-6"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Requisición"
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
