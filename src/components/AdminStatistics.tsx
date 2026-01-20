import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Clock, AlertTriangle, CheckCircle, FileText, DollarSign, Users, BarChart3 } from "lucide-react";
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
import { format, differenceInHours, differenceInDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

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
  avgHours: number;
  avgDays: number;
}

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

  useEffect(() => {
    fetchStatistics();
  }, []);

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

      // Calculate monthly volume
      if (reqData && repoData) {
        calculateMonthlyVolume(reqData, repoData);
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
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        return {
          stage,
          avgHours: Math.round(avg),
          avgDays: Math.round(avg / 24 * 10) / 10,
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

  const calculateMonthlyVolume = (reqData: RequisicionStats[], repoData: any[]) => {
    const months: { month: string; requisiciones: number; reposiciones: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const monthLabel = format(date, "MMM yy", { locale: es });

      const reqCount = reqData.filter(r => {
        const created = new Date(r.created_at);
        return created >= start && created <= end;
      }).length;

      const repoCount = repoData.filter(r => {
        const created = new Date(r.created_at);
        return created >= start && created <= end;
      }).length;

      months.push({
        month: monthLabel,
        requisiciones: reqCount,
        reposiciones: repoCount,
      });
    }

    setMonthlyVolume(months);
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
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="w-5 h-5 text-yellow-500" />
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
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{completados}</p>
                <p className="text-xs text-muted-foreground">Completados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <Card className="border-border bg-card col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{bottleneck || "Sin datos"}</p>
                <p className="text-xs text-muted-foreground">Cuello de botella (etapa más lenta)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time by Stage Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tiempo Promedio por Etapa (horas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={timeStats} layout="vertical">
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
                    formatter={(value: number) => [`${value} horas (${Math.round(value/24*10)/10} días)`, 'Promedio']}
                  />
                  <Bar dataKey="avgHours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
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

      {/* Monthly Volume Chart */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Volumen Mensual de Trámites
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
              No hay datos disponibles
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStatistics;
