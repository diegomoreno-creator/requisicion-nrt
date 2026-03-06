import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Building2, Briefcase, ShoppingCart, Tag, TrendingUp, Clock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo } from "react";

// Generate a large palette of distinct colors using golden angle distribution
const generateDistinctColors = (count: number): string[] => {
  const colors: string[] = [];
  const goldenAngle = 137.508;
  for (let i = 0; i < count; i++) {
    const hue = (i * goldenAngle) % 360;
    const sat = 65 + (i % 3) * 10; // 65-85%
    const light = 50 + (i % 4) * 5; // 50-65%
    colors.push(`hsl(${Math.round(hue)}, ${sat}%, ${light}%)`);
  }
  return colors;
};

const CHART_COLORS = generateDistinctColors(30);

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--chart-tooltip-bg))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

const TOOLTIP_TEXT_STYLE = {
  color: "hsl(var(--chart-tooltip-fg))",
  fontWeight: 500,
};

interface ExtendedRequisicion {
  id: string;
  folio: string;
  asunto: string | null;
  estado: string;
  created_at: string;
  updated_at: string;
  empresa: string | null;
  departamento_solicitante: string | null;
  datos_proveedor: string | null;
  tipo_requisicion: string | null;
  presupuesto_aproximado: number | null;
  monto_total_compra: number | null;
  tipo_pedido?: string | null;
  credito_pagado?: boolean | null;
  fecha_pago_credito?: string | null;
  fecha_autorizacion_real?: string | null;
  fecha_licitacion?: string | null;
  fecha_pedido_colocado?: string | null;
  fecha_pedido_autorizado?: string | null;
  fecha_pago?: string | null;
}

interface AdvancedStatisticsPanelsProps {
  requisiciones: ExtendedRequisicion[];
  empresasMap: Record<string, string>;
  tiposMap: Record<string, string>;
  departamentosMap: Record<string, string>;
  visiblePanels: Set<string>;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);

// ─── Gasto mensual por empresa ───
export const GastoMensualEmpresaPanel = ({
  requisiciones,
  empresasMap,
}: {
  requisiciones: ExtendedRequisicion[];
  empresasMap: Record<string, string>;
}) => {
  const [showAll, setShowAll] = useState(false);
  const TOP_N = 5;

  const data = useMemo(() => {
    // Aggregate total per empresa first to find top N
    const totalByEmpresa: Record<string, number> = {};
    const byMonth: Record<string, Record<string, number>> = {};
    const monthOrder: { key: string; date: Date }[] = [];

    requisiciones.forEach((r) => {
      if (!r.empresa) return;
      const monto = r.monto_total_compra || r.presupuesto_aproximado || 0;
      if (monto <= 0) return;
      const empresaName = empresasMap[r.empresa] || r.empresa;
      totalByEmpresa[empresaName] = (totalByEmpresa[empresaName] || 0) + monto;

      const d = new Date(r.created_at);
      const monthKey = format(d, "yyyy-MM");
      const monthLabel = format(d, "MMM ''yy", { locale: es });
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {};
        monthOrder.push({ key: monthKey, date: d });
      }
      byMonth[monthKey][empresaName] = (byMonth[monthKey][empresaName] || 0) + monto;
    });

    // Sort empresas by total descending
    const sorted = Object.entries(totalByEmpresa).sort((a, b) => b[1] - a[1]);
    const topEmpresas = showAll ? sorted.map(([n]) => n) : sorted.slice(0, TOP_N).map(([n]) => n);
    const hasOtros = !showAll && sorted.length > TOP_N;

    // Deduplicate and sort months
    const uniqueMonths = Array.from(new Map(monthOrder.map(m => [m.key, m])).values())
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const chartData = uniqueMonths.map(({ key }) => {
      const entry: Record<string, any> = { month: format(new Date(key + "-01"), "MMM ''yy", { locale: es }) };
      topEmpresas.forEach((emp) => { entry[emp] = byMonth[key]?.[emp] || 0; });
      if (hasOtros) {
        const otrosTotal = Object.entries(byMonth[key] || {})
          .filter(([name]) => !topEmpresas.includes(name))
          .reduce((sum, [, v]) => sum + v, 0);
        entry["Otros"] = otrosTotal;
      }
      return entry;
    });

    const displayEmpresas = hasOtros ? [...topEmpresas, "Otros"] : topEmpresas;

    return { chartData, empresas: displayEmpresas, allEmpresas: sorted, totalCount: sorted.length };
  }, [requisiciones, empresasMap, showAll]);

  if (data.chartData.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Gasto Mensual por Empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Sin datos de gasto disponibles</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Gasto Mensual por Empresa
          </CardTitle>
          {data.totalCount > TOP_N && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-primary hover:underline"
            >
              {showAll ? `Mostrar Top ${TOP_N}` : `Ver todas (${data.totalCount})`}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_TEXT_STYLE}
              labelStyle={TOOLTIP_TEXT_STYLE}
              formatter={(value: number) => [formatCurrency(value), ""]}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            {data.empresas.map((emp, i) => (
              <Bar
                key={emp}
                dataKey={emp}
                fill={emp === "Otros" ? "hsl(var(--muted-foreground))" : CHART_COLORS[i % CHART_COLORS.length]}
                stackId="a"
                radius={i === data.empresas.length - 1 ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        {/* Mini ranking table */}
        <div className="mt-4 max-h-[140px] overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {data.allEmpresas.slice(0, showAll ? undefined : 8).map(([name, total], i) => (
              <div key={name} className="flex items-center justify-between text-xs py-0.5 border-b border-border/30">
                <span className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="text-foreground truncate">{name}</span>
                </span>
                <span className="text-muted-foreground font-medium ml-2 whitespace-nowrap">{formatCurrency(total)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Gasto por departamento ───
export const GastoDepartamentoPanel = ({
  requisiciones,
  departamentosMap,
}: {
  requisiciones: ExtendedRequisicion[];
  departamentosMap: Record<string, string>;
}) => {
  const data = useMemo(() => {
    const byDept: Record<string, number> = {};
    requisiciones.forEach((r) => {
      if (!r.departamento_solicitante) return;
      const monto = r.monto_total_compra || r.presupuesto_aproximado || 0;
      if (monto <= 0) return;
      const name = departamentosMap[r.departamento_solicitante] || r.departamento_solicitante;
      byDept[name] = (byDept[name] || 0) + monto;
    });
    return Object.entries(byDept)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [requisiciones, departamentosMap]);

  if (data.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Briefcase className="w-4 h-4" /> Gasto por Departamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Briefcase className="w-4 h-4" /> Gasto por Departamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={130} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_TEXT_STYLE}
              labelStyle={TOOLTIP_TEXT_STYLE}
              formatter={(value: number) => [formatCurrency(value), "Gasto"]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// ─── Gasto por proveedor ───
export const GastoProveedorPanel = ({ requisiciones }: { requisiciones: ExtendedRequisicion[] }) => {
  const data = useMemo(() => {
    const byProv: Record<string, number> = {};
    requisiciones.forEach((r) => {
      if (!r.datos_proveedor) return;
      const monto = r.monto_total_compra || r.presupuesto_aproximado || 0;
      if (monto <= 0) return;
      // Clean up provider name
      const name = r.datos_proveedor.split("\n")[0].trim().substring(0, 40);
      if (!name) return;
      byProv[name] = (byProv[name] || 0) + monto;
    });
    return Object.entries(byProv)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [requisiciones]);

  if (data.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Gasto por Proveedor (Top 10)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" /> Gasto por Proveedor (Top 10)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 30 + 40)}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={9} width={140} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_TEXT_STYLE}
              labelStyle={TOOLTIP_TEXT_STYLE}
              formatter={(value: number) => [formatCurrency(value), "Acumulado"]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// ─── Requisiciones totales, aprobadas y rechazadas ───
export const ResumenAprobacionPanel = ({ requisiciones }: { requisiciones: ExtendedRequisicion[] }) => {
  const stats = useMemo(() => {
    const total = requisiciones.length;
    const aprobadas = requisiciones.filter((r) =>
      ["aprobado", "en_licitacion", "pedido_colocado", "pedido_autorizado", "pedido_pagado", "completado"].includes(r.estado)
    ).length;
    const rechazadas = requisiciones.filter((r) => r.estado === "rechazado").length;
    const canceladas = requisiciones.filter((r) => r.estado === "cancelado").length;
    const enProceso = total - aprobadas - rechazadas - canceladas;
    return { total, aprobadas, rechazadas, canceladas, enProceso };
  }, [requisiciones]);

  const pieData = [
    { name: "Aprobadas", value: stats.aprobadas },
    { name: "Rechazadas", value: stats.rechazadas },
    { name: "Canceladas", value: stats.canceladas },
    { name: "En proceso", value: stats.enProceso },
  ].filter((d) => d.value > 0);

  const colors = ["hsl(142, 71%, 45%)", "hsl(0, 84%, 60%)", "hsl(220, 9%, 46%)", "hsl(45, 93%, 47%)"];

  return (
    <Card className="border-border bg-card h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Requisiciones: Aprobadas vs Rechazadas
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-chart-3">{stats.aprobadas}</p>
            <p className="text-xs text-muted-foreground">Aprobadas</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-destructive">{stats.rechazadas}</p>
            <p className="text-xs text-muted-foreground">Rechazadas</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-muted-foreground">{stats.canceladas}</p>
            <p className="text-xs text-muted-foreground">Canceladas</p>
          </div>
        </div>
        {pieData.length > 0 && (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                {pieData.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT_STYLE} labelStyle={TOOLTIP_TEXT_STYLE} />
              <Legend formatter={(value) => <span className="text-xs text-foreground">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Clasificación por tipo de gasto ───
export const TipoGastoPanel = ({
  requisiciones,
  tiposMap,
}: {
  requisiciones: ExtendedRequisicion[];
  tiposMap: Record<string, string>;
}) => {
  const data = useMemo(() => {
    const byTipo: Record<string, { count: number; monto: number }> = {};
    requisiciones.forEach((r) => {
      if (!r.tipo_requisicion) return;
      const name = tiposMap[r.tipo_requisicion] || r.tipo_requisicion;
      if (!byTipo[name]) byTipo[name] = { count: 0, monto: 0 };
      byTipo[name].count += 1;
      byTipo[name].monto += r.monto_total_compra || r.presupuesto_aproximado || 0;
    });
    return Object.entries(byTipo)
      .map(([name, v]) => ({ name, count: v.count, monto: v.monto }))
      .sort((a, b) => b.count - a.count);
  }, [requisiciones, tiposMap]);

  if (data.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Tag className="w-4 h-4" /> Clasificación por Tipo de Gasto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Tag className="w-4 h-4" /> Clasificación por Tipo de Gasto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((item, i) => {
            const maxCount = data[0].count;
            const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium truncate max-w-[60%]">{item.name}</span>
                  <span className="text-muted-foreground">{item.count} req · {formatCurrency(item.monto)}</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Requisiciones fuera de tiempo (SLA) ───
export const SLAPanel = ({ requisiciones }: { requisiciones: ExtendedRequisicion[] }) => {
  const [slaDays, setSlaDays] = useState(5);

  const overdue = useMemo(() => {
    const now = new Date();
    const activeStates = ["pendiente", "pendiente_revision", "aprobado", "en_licitacion", "pedido_colocado", "pedido_autorizado"];
    return requisiciones.filter((r) => {
      if (!activeStates.includes(r.estado)) return false;
      const days = differenceInDays(now, new Date(r.updated_at));
      return days > slaDays;
    });
  }, [requisiciones, slaDays]);

  return (
    <Card className="border-border bg-card h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" /> Requisiciones Fuera de SLA
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">SLA (días):</Label>
          <Input
            type="number"
            min={1}
            max={90}
            value={slaDays}
            onChange={(e) => setSlaDays(Number(e.target.value) || 5)}
            className="w-20 h-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-4 mb-3">
          <div className="text-center">
            <p className="text-3xl font-bold text-destructive">{overdue.length}</p>
            <p className="text-xs text-muted-foreground">Fuera de SLA</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-foreground">
              {requisiciones.filter((r) =>
                ["pendiente", "pendiente_revision", "aprobado", "en_licitacion", "pedido_colocado", "pedido_autorizado"].includes(r.estado)
              ).length}
            </p>
            <p className="text-xs text-muted-foreground">Activas totales</p>
          </div>
        </div>
        {overdue.length > 0 && (
          <div className="max-h-[320px] overflow-y-auto space-y-1">
            {overdue.map((r) => {
              const days = differenceInDays(new Date(), new Date(r.updated_at));
              return (
                <div key={r.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-destructive/5 border border-destructive/10 gap-2">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-foreground font-semibold">{r.folio}</span>
                    <span className="text-muted-foreground truncate">{r.asunto || "Sin asunto"}</span>
                  </div>
                  <span className="text-destructive font-bold whitespace-nowrap">{days}d</span>
                </div>
              );
            })}
          </div>
        )}
        {overdue.length === 0 && (
          <p className="text-sm text-chart-3 font-medium">✓ Todas las requisiciones dentro de SLA</p>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Requisiciones estancadas (sin movimiento) ───
export const StalePanel = ({ requisiciones }: { requisiciones: ExtendedRequisicion[] }) => {
  const [staleDays, setStaleDays] = useState(7);

  const stale = useMemo(() => {
    const now = new Date();
    const activeStates = ["pendiente", "pendiente_revision", "aprobado", "en_licitacion", "pedido_colocado", "pedido_autorizado"];
    return requisiciones
      .filter((r) => {
        if (!activeStates.includes(r.estado)) return false;
        return differenceInDays(now, new Date(r.updated_at)) >= staleDays;
      })
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
  }, [requisiciones, staleDays]);

  const estadoLabel: Record<string, string> = {
    pendiente: "Pendiente",
    pendiente_revision: "En Revisión",
    aprobado: "Aprobado",
    en_licitacion: "En Licitación",
    pedido_colocado: "Pedido Colocado",
    pedido_autorizado: "Pedido Autorizado",
  };

  return (
    <Card className="border-border bg-card h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-chart-4" /> Requisiciones Sin Movimiento
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Días sin movimiento:</Label>
          <Input
            type="number"
            min={1}
            max={90}
            value={staleDays}
            onChange={(e) => setStaleDays(Number(e.target.value) || 7)}
            className="w-20 h-7 text-xs"
          />
        </div>
        <p className="text-2xl font-bold text-chart-4 mb-3">{stale.length} requisiciones</p>
        {stale.length > 0 && (
          <div className="max-h-[320px] overflow-y-auto space-y-1">
            {stale.map((r) => {
              const days = differenceInDays(new Date(), new Date(r.updated_at));
              return (
                <div key={r.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/50 border border-border gap-2">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-foreground font-semibold">{r.folio}</span>
                    <span className="text-muted-foreground truncate">{r.asunto || "Sin asunto"} · {estadoLabel[r.estado] || r.estado}</span>
                  </div>
                  <span className="text-chart-4 font-semibold whitespace-nowrap">{days}d</span>
                </div>
              );
            })}
          </div>
        )}
        {stale.length === 0 && (
          <p className="text-sm text-chart-3 font-medium">✓ Sin requisiciones estancadas</p>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Tendencia mensual de gasto ───
export const TendenciaGastoPanel = ({
  requisiciones,
  empresasMap,
}: {
  requisiciones: ExtendedRequisicion[];
  empresasMap: Record<string, string>;
}) => {
  const data = useMemo(() => {
    const monthlyData: Record<string, number> = {};

    requisiciones.forEach((r) => {
      const monto = r.monto_total_compra || r.presupuesto_aproximado || 0;
      if (monto <= 0) return;
      const monthKey = format(new Date(r.created_at), "yyyy-MM");
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + monto;
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, value]) => ({
        month: format(new Date(key + "-01"), "MMM ''yy", { locale: es }),
        gasto: value,
      }));
  }, [requisiciones]);

  if (data.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Tendencia Mensual de Gasto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Tendencia Mensual de Gasto (Comparativo Histórico)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_TEXT_STYLE}
              labelStyle={TOOLTIP_TEXT_STYLE}
              formatter={(value: number) => [formatCurrency(value), "Gasto"]}
            />
            <Line type="monotone" dataKey="gasto" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} name="Gasto Total" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// ─── Métricas por Tipo de Pedido (Ordinario vs Crédito) ───
export const TipoPedidoPanel = ({ requisiciones }: { requisiciones: ExtendedRequisicion[] }) => {
  const stats = useMemo(() => {
    // Only consider requisitions that have reached pedido_colocado or beyond
    const withOrder = requisiciones.filter((r) =>
      ["pedido_colocado", "pedido_autorizado", "pedido_pagado", "completado"].includes(r.estado)
      || r.fecha_pedido_colocado
    );

    const ordinarios = withOrder.filter((r) => !r.tipo_pedido || r.tipo_pedido === "ordinario");
    const creditos = withOrder.filter((r) => r.tipo_pedido === "credito");

    const calcAvgDays = (items: ExtendedRequisicion[], fromKey: keyof ExtendedRequisicion, toKey: keyof ExtendedRequisicion) => {
      const times = items
        .filter((r) => r[fromKey] && r[toKey])
        .map((r) => {
          const from = new Date(r[fromKey] as string);
          const to = new Date(r[toKey] as string);
          return differenceInDays(to, from);
        })
        .filter((d) => d >= 0);
      if (times.length === 0) return null;
      return Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10;
    };

    const calcTotalTime = (items: ExtendedRequisicion[]) => {
      const times = items
        .filter((r) => r.fecha_pago && r.created_at)
        .map((r) => differenceInDays(new Date(r.fecha_pago!), new Date(r.created_at)))
        .filter((d) => d >= 0);
      if (times.length === 0) return null;
      return Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10;
    };

    const creditoPendientes = creditos.filter((r) => r.estado === "pedido_pagado" && !r.credito_pagado).length;
    const creditoPagados = creditos.filter((r) => r.credito_pagado).length;

    return {
      ordinarios: {
        total: ordinarios.length,
        avgTotal: calcTotalTime(ordinarios),
        avgCreacion_Autorizacion: calcAvgDays(ordinarios, "created_at", "fecha_autorizacion_real"),
        avgAutorizacion_Pedido: calcAvgDays(ordinarios, "fecha_autorizacion_real", "fecha_pedido_colocado"),
        avgPedido_Pago: calcAvgDays(ordinarios, "fecha_pedido_colocado", "fecha_pago"),
      },
      creditos: {
        total: creditos.length,
        pendientesPago: creditoPendientes,
        pagados: creditoPagados,
        avgTotal: calcTotalTime(creditos),
        avgCreacion_Autorizacion: calcAvgDays(creditos, "created_at", "fecha_autorizacion_real"),
        avgAutorizacion_Pedido: calcAvgDays(creditos, "fecha_autorizacion_real", "fecha_pedido_colocado"),
        avgPedido_Pago: calcAvgDays(creditos, "fecha_pedido_colocado", "fecha_pago"),
        avgPago_CreditoPagado: (() => {
          const times = creditos
            .filter((r) => r.fecha_pago && r.fecha_pago_credito)
            .map((r) => differenceInDays(new Date(r.fecha_pago_credito!), new Date(r.fecha_pago!)))
            .filter((d) => d >= 0);
          if (times.length === 0) return null;
          return Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10;
        })(),
      },
    };
  }, [requisiciones]);

  const pieData = [
    { name: "Ordinarios", value: stats.ordinarios.total },
    { name: "Crédito", value: stats.creditos.total },
  ].filter((d) => d.value > 0);

  const pieColors = ["hsl(217, 91%, 60%)", "hsl(25, 95%, 53%)"];

  const MetricRow = ({ label, value }: { label: string; value: number | null }) => (
    <div className="flex items-center justify-between text-xs py-1 border-b border-border/30">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value !== null ? `${value} días` : "—"}</span>
    </div>
  );

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Tag className="w-4 h-4" /> Métricas por Tipo de Pedido
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pieData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Sin pedidos colocados en el período
          </div>
        ) : (
          <div className="space-y-6">
            {/* Distribution chart */}
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="40%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={pieColors[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT_STYLE} labelStyle={TOOLTIP_TEXT_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: pieColors[0] }} />
                  <span className="text-sm text-foreground font-medium">Ordinarios: {stats.ordinarios.total}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: pieColors[1] }} />
                  <span className="text-sm text-foreground font-medium">Crédito: {stats.creditos.total}</span>
                </div>
                {stats.creditos.pendientesPago > 0 && (
                  <div className="text-xs text-destructive font-medium mt-1">
                    ⚠ {stats.creditos.pendientesPago} pendiente(s) de pago a crédito
                  </div>
                )}
                {stats.creditos.pagados > 0 && (
                  <div className="text-xs text-chart-3 font-medium">
                    ✓ {stats.creditos.pagados} crédito(s) pagado(s)
                  </div>
                )}
              </div>
            </div>

            {/* Side-by-side metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ordinarios */}
              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pieColors[0] }} />
                  Pedidos Ordinarios
                </p>
                <MetricRow label="Tiempo promedio total" value={stats.ordinarios.avgTotal} />
                <MetricRow label="Creación → Autorización" value={stats.ordinarios.avgCreacion_Autorizacion} />
                <MetricRow label="Autorización → Pedido" value={stats.ordinarios.avgAutorizacion_Pedido} />
                <MetricRow label="Pedido → Pago" value={stats.ordinarios.avgPedido_Pago} />
              </div>

              {/* Crédito */}
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
                <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pieColors[1] }} />
                  Pedidos a Crédito (30 días)
                </p>
                <MetricRow label="Tiempo promedio total" value={stats.creditos.avgTotal} />
                <MetricRow label="Creación → Autorización" value={stats.creditos.avgCreacion_Autorizacion} />
                <MetricRow label="Autorización → Pedido" value={stats.creditos.avgAutorizacion_Pedido} />
                <MetricRow label="Pedido → Pago inicial" value={stats.creditos.avgPedido_Pago} />
                <MetricRow label="Pago → Pago crédito" value={stats.creditos.avgPago_CreditoPagado} />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
