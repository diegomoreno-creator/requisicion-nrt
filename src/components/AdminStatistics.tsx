import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Clock, AlertTriangle, CheckCircle, FileText, DollarSign, Users, BarChart3, Zap, Timer, ArrowDown, ArrowUp } from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from "recharts";
import { format, differenceInHours, differenceInDays, subMonths, subWeeks, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RequisicionStats {
  id: string;
  estado: string;
  created_at: string;
  fecha_autorizacion_real: string | null;
  fecha_licitacion: string | null;
  fecha_pedido_colocado: string | null;
  fecha_pedido_autorizado: string | null;
  fecha_pago: string | null;
  tipo_requisicion: string | null;
  empresa: string | null;
}

interface TimeStats {
  stage: string;
  avgMinutes: number;
  avgHours: number;
  avgDays: number;
  minHours: number;
  maxHours: number;
  count: number;
}

type TimeUnit = "minutes" | "hours" | "days";
type VolumePeriod = "week" | "month" | "3months" | "6months" | "year" | "custom";

const periodLabels: Record<VolumePeriod, string> = {
  week: "Última semana",
  month: "Último mes",
  "3months": "3 meses",
  "6months": "6 meses",
  year: "1 año",
  custom: "Personalizado",
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

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

const AdminStatistics = () => {
  const [loading, setLoading] = useState(true);
  const [requisiciones, setRequisiciones] = useState<RequisicionStats[]>([]);
  const [reposiciones, setReposiciones] = useState<any[]>([]);
  const [timeStats, setTimeStats] = useState<TimeStats[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<{ name: string; value: number }[]>([]);
  const [monthlyVolume, setMonthlyVolume] = useState<{ month: string; requisiciones: number; reposiciones: number }[]>([]);
  const [avgTotalTime, setAvgTotalTime] = useState<number>(0);
  const [bottleneck, setBottleneck] = useState<string>("");
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("hours");
  const [volumePeriod, setVolumePeriod] = useState<VolumePeriod>("6months");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  useEffect(() => {
    fetchStatistics();
  }, []);

  // Recalculate volume when period or custom range changes
  useEffect(() => {
    if (requisiciones.length > 0 || reposiciones.length > 0) {
      calculateVolumeByPeriod(requisiciones, reposiciones, volumePeriod, customDateRange);
    }
  }, [volumePeriod, customDateRange, requisiciones, reposiciones]);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      // Fetch requisiciones with timestamps
      const { data: reqData } = await supabase
        .from("requisiciones")
        .select("id, estado, created_at, fecha_autorizacion_real, fecha_licitacion, fecha_pedido_colocado, fecha_pedido_autorizado, fecha_pago, tipo_requisicion, empresa")
        .is("deleted_at", null);

      // Fetch reposiciones
      const { data: repoData } = await supabase
        .from("reposiciones")
        .select("id, estado, created_at, fecha_autorizacion, fecha_pago");

      if (reqData) {
        setRequisiciones(reqData);
        calculateTimeStats(reqData);
        calculateStatusDistribution(reqData);
      }
      if (repoData) {
        setReposiciones(repoData);
      }

      // Calculate volume - will be handled by useEffect
      if (reqData && repoData) {
        calculateVolumeByPeriod(reqData, repoData, volumePeriod, customDateRange);
      }
    } catch (error) {
      console.error("Error fetching statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeStats = (data: RequisicionStats[]) => {
    // Filter completed requisitions for time analysis
    const completed = data.filter(r => r.fecha_pago);

    if (completed.length === 0) {
      setTimeStats([]);
      return;
    }

    // Calculate average time per stage
    const stagesTimes: Record<string, number[]> = {
      "Pendiente → Autorizado": [],
      "Autorizado → Licitación": [],
      "Licitación → Pedido": [],
      "Pedido → Autorizado": [],
      "Autorizado → Pagado": [],
    };

    completed.forEach(r => {
      if (r.fecha_autorizacion_real && r.created_at) {
        const hours = differenceInHours(new Date(r.fecha_autorizacion_real), new Date(r.created_at));
        if (hours > 0) stagesTimes["Pendiente → Autorizado"].push(hours);
      }
      if (r.fecha_licitacion && r.fecha_autorizacion_real) {
        const hours = differenceInHours(new Date(r.fecha_licitacion), new Date(r.fecha_autorizacion_real));
        if (hours > 0) stagesTimes["Autorizado → Licitación"].push(hours);
      }
      if (r.fecha_pedido_colocado && r.fecha_licitacion) {
        const hours = differenceInHours(new Date(r.fecha_pedido_colocado), new Date(r.fecha_licitacion));
        if (hours > 0) stagesTimes["Licitación → Pedido"].push(hours);
      }
      if (r.fecha_pedido_autorizado && r.fecha_pedido_colocado) {
        const hours = differenceInHours(new Date(r.fecha_pedido_autorizado), new Date(r.fecha_pedido_colocado));
        if (hours > 0) stagesTimes["Pedido → Autorizado"].push(hours);
      }
      if (r.fecha_pago && r.fecha_pedido_autorizado) {
        const hours = differenceInHours(new Date(r.fecha_pago), new Date(r.fecha_pedido_autorizado));
        if (hours > 0) stagesTimes["Autorizado → Pagado"].push(hours);
      }
    });

    const stats: TimeStats[] = Object.entries(stagesTimes)
      .filter(([_, times]) => times.length > 0)
      .map(([stage, times]) => {
        const avgHours = times.reduce((a, b) => a + b, 0) / times.length;
        const minHours = Math.min(...times);
        const maxHours = Math.max(...times);
        return {
          stage,
          avgMinutes: Math.round(avgHours * 60),
          avgHours: Math.round(avgHours),
          avgDays: Math.round(avgHours / 24 * 10) / 10,
          minHours: Math.round(minHours),
          maxHours: Math.round(maxHours),
          count: times.length,
        };
      });

    setTimeStats(stats);

    // Find bottleneck
    if (stats.length > 0) {
      const maxStage = stats.reduce((prev, current) => 
        prev.avgHours > current.avgHours ? prev : current
      );
      setBottleneck(maxStage.stage);
    }

    // Calculate average total time
    const totalTimes = completed.map(r => {
      if (r.fecha_pago && r.created_at) {
        return differenceInDays(new Date(r.fecha_pago), new Date(r.created_at));
      }
      return 0;
    }).filter(t => t > 0);

    if (totalTimes.length > 0) {
      setAvgTotalTime(Math.round(totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length));
    }
  };

  const calculateStatusDistribution = (data: RequisicionStats[]) => {
    const distribution: Record<string, number> = {};
    data.forEach(r => {
      const status = r.estado || "pendiente";
      distribution[status] = (distribution[status] || 0) + 1;
    });

    const result = Object.entries(distribution).map(([estado, count]) => ({
      name: estadoLabels[estado] || estado,
      value: count,
    }));

    setStatusDistribution(result);
  };

  const calculateVolumeByPeriod = (
    reqData: RequisicionStats[], 
    repoData: any[], 
    period: VolumePeriod,
    dateRange: { from: Date | undefined; to: Date | undefined }
  ) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = endOfDay(now);
    let intervals: Date[];
    let labelFormat: string;
    let groupBy: "day" | "week" | "month";

    switch (period) {
      case "week":
        startDate = startOfDay(subWeeks(now, 1));
        intervals = eachDayOfInterval({ start: startDate, end: endDate });
        labelFormat = "EEE d";
        groupBy = "day";
        break;
      case "month":
        startDate = startOfDay(subMonths(now, 1));
        intervals = eachDayOfInterval({ start: startDate, end: endDate });
        labelFormat = "d MMM";
        groupBy = "day";
        break;
      case "3months":
        startDate = startOfMonth(subMonths(now, 2));
        intervals = eachWeekOfInterval({ start: startDate, end: endDate }, { locale: es });
        labelFormat = "d MMM";
        groupBy = "week";
        break;
      case "6months":
        startDate = startOfMonth(subMonths(now, 5));
        intervals = eachMonthOfInterval({ start: startDate, end: endDate });
        labelFormat = "MMM ''yy";
        groupBy = "month";
        break;
      case "year":
        startDate = startOfMonth(subMonths(now, 11));
        intervals = eachMonthOfInterval({ start: startDate, end: endDate });
        labelFormat = "MMM ''yy";
        groupBy = "month";
        break;
      case "custom":
        if (!dateRange.from || !dateRange.to) {
          setMonthlyVolume([]);
          return;
        }
        startDate = startOfDay(dateRange.from);
        endDate = endOfDay(dateRange.to);
        const daysDiff = differenceInDays(endDate, startDate);
        
        if (daysDiff <= 14) {
          intervals = eachDayOfInterval({ start: startDate, end: endDate });
          labelFormat = "d MMM";
          groupBy = "day";
        } else if (daysDiff <= 90) {
          intervals = eachWeekOfInterval({ start: startDate, end: endDate }, { locale: es });
          labelFormat = "d MMM";
          groupBy = "week";
        } else {
          intervals = eachMonthOfInterval({ start: startDate, end: endDate });
          labelFormat = "MMM ''yy";
          groupBy = "month";
        }
        break;
      default:
        return;
    }

    const volumeData = intervals.map((intervalStart, index) => {
      let intervalEnd: Date;
      
      if (groupBy === "day") {
        intervalEnd = endOfDay(intervalStart);
      } else if (groupBy === "week") {
        intervalEnd = index < intervals.length - 1 
          ? subDays(intervals[index + 1], 1)
          : endDate;
        intervalEnd = endOfDay(intervalEnd);
      } else {
        intervalEnd = endOfMonth(intervalStart);
        if (intervalEnd > endDate) intervalEnd = endDate;
      }

      const reqCount = reqData.filter(r => {
        const created = new Date(r.created_at);
        return created >= intervalStart && created <= intervalEnd;
      }).length;

      const repoCount = repoData.filter(r => {
        const created = new Date(r.created_at);
        return created >= intervalStart && created <= intervalEnd;
      }).length;

      return {
        month: format(intervalStart, labelFormat, { locale: es }),
        requisiciones: reqCount,
        reposiciones: repoCount,
      };
    });

    setMonthlyVolume(volumeData);
  };

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const totalRequisiciones = requisiciones.length;
  const totalReposiciones = reposiciones.length;
  const pendientes = requisiciones.filter(r => r.estado === "pendiente").length;
  const completados = requisiciones.filter(r => r.estado === "pedido_pagado").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold text-foreground">Panel de Estadísticas</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalRequisiciones}</p>
                <p className="text-xs text-muted-foreground">Requisiciones</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-2/10">
                <DollarSign className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalReposiciones}</p>
                <p className="text-xs text-muted-foreground">Reposiciones</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-4/10">
                <Clock className="w-5 h-5 text-chart-4" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendientes}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-3/10">
                <CheckCircle className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{completados}</p>
                <p className="text-xs text-muted-foreground">Completados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{avgTotalTime} días</p>
                <p className="text-xs text-muted-foreground">Tiempo promedio total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground truncate">{bottleneck || "Sin datos"}</p>
                <p className="text-xs text-muted-foreground">Cuello de botella</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-3/10">
                <Zap className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                {timeStats.length > 0 ? (
                  <>
                    <p className="text-sm font-bold text-foreground truncate">
                      {timeStats.reduce((prev, curr) => prev.avgHours < curr.avgHours ? prev : curr).stage}
                    </p>
                    <p className="text-xs text-muted-foreground">Etapa más rápida</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-foreground">Sin datos</p>
                    <p className="text-xs text-muted-foreground">Etapa más rápida</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-4/10">
                <Timer className="w-5 h-5 text-chart-4" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {timeStats.length > 0 ? timeStats.reduce((a, b) => a + b.count, 0) : 0}
                </p>
                <p className="text-xs text-muted-foreground">Transiciones medidas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Time Stats per Stage */}
      {timeStats.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Métricas Detalladas por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {timeStats.map((stat, index) => (
                <div 
                  key={stat.stage} 
                  className={cn(
                    "p-3 rounded-lg border border-border bg-muted/30",
                    stat.stage === bottleneck && "border-destructive/50 bg-destructive/5"
                  )}
                >
                  <p className="text-xs font-medium text-foreground mb-2 truncate" title={stat.stage}>
                    {stat.stage}
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Promedio:</span>
                      <span className="font-semibold text-foreground">
                        {stat.avgHours < 24 
                          ? `${stat.avgHours}h` 
                          : `${stat.avgDays}d`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <ArrowDown className="w-3 h-3 text-chart-3" /> Mín:
                      </span>
                      <span className="text-chart-3 font-medium">
                        {stat.minHours < 24 
                          ? `${stat.minHours}h` 
                          : `${Math.round(stat.minHours / 24 * 10) / 10}d`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <ArrowUp className="w-3 h-3 text-destructive" /> Máx:
                      </span>
                      <span className="text-destructive font-medium">
                        {stat.maxHours < 24 
                          ? `${stat.maxHours}h` 
                          : `${Math.round(stat.maxHours / 24 * 10) / 10}d`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                      <span className="text-muted-foreground">Muestra:</span>
                      <span className="text-muted-foreground">{stat.count} trámites</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time by Stage Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tiempo Promedio por Etapa
              </CardTitle>
              <Select value={timeUnit} onValueChange={(value: TimeUnit) => setTimeUnit(value)}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Días</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {timeStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart 
                  data={timeStats.map(stat => ({
                    ...stat,
                    value: timeUnit === "minutes" ? stat.avgMinutes : timeUnit === "hours" ? stat.avgHours : stat.avgDays
                  }))} 
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis 
                    type="category" 
                    dataKey="stage" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10}
                    width={120}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => {
                      const unitLabel = timeUnit === "minutes" ? "minutos" : timeUnit === "hours" ? "horas" : "días";
                      return [`${value} ${unitLabel}`, 'Promedio'];
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No hay suficientes datos completados
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distribución por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No hay datos disponibles
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Volume Chart */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Volumen de Trámites
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={volumePeriod} onValueChange={(value: VolumePeriod) => setVolumePeriod(value)}>
                <SelectTrigger className="w-36 h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mes</SelectItem>
                  <SelectItem value="3months">3 meses</SelectItem>
                  <SelectItem value="6months">6 meses</SelectItem>
                  <SelectItem value="year">1 año</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              
              {volumePeriod === "custom" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-8 text-xs justify-start text-left font-normal",
                        !customDateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {customDateRange.from ? (
                        customDateRange.to ? (
                          <>
                            {format(customDateRange.from, "d MMM", { locale: es })} -{" "}
                            {format(customDateRange.to, "d MMM yy", { locale: es })}
                          </>
                        ) : (
                          format(customDateRange.from, "d MMM yy", { locale: es })
                        )
                      ) : (
                        "Seleccionar fechas"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-border" align="end">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={customDateRange.from}
                      selected={{ from: customDateRange.from, to: customDateRange.to }}
                      onSelect={(range) => setCustomDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {monthlyVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="requisiciones" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                  name="Requisiciones"
                />
                <Line 
                  type="monotone" 
                  dataKey="reposiciones" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-2))' }}
                  name="Reposiciones"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              {volumePeriod === "custom" && (!customDateRange.from || !customDateRange.to) 
                ? "Selecciona un rango de fechas"
                : "No hay datos disponibles"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStatistics;
