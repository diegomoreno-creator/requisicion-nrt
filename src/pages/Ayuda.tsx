import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FilePlus, RefreshCw, FileText, FolderSearch, Users, Settings, CheckCircle, Clock, XCircle, ShoppingCart, Gavel, CreditCard, BarChart3, Download, Send, Lightbulb, X, Check, CheckCheck, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Sugerencia {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  contenido: string;
  estado: 'pendiente' | 'aceptada' | 'rechazada' | 'terminada';
  justificacion_rechazo: string | null;
  created_at: string;
}

interface HelpSection {
  title: string;
  icon: React.ElementType;
  description: string;
  features: string[];
}

interface RoleHelp {
  role: string;
  label: string;
  color: string;
  description: string;
  sections: HelpSection[];
}

const roleHelpData: RoleHelp[] = [
  {
    role: "solicitador",
    label: "Solicitador",
    color: "bg-blue-500",
    description: "Usuario que crea y da seguimiento a sus solicitudes de compra y reposiciones de gastos.",
    sections: [
      {
        title: "Requisición",
        icon: FilePlus,
        description: "Crea solicitudes de compra de bienes o servicios.",
        features: [
          "Especifica empresa, sucursal y unidad de negocio",
          "Agrega múltiples partidas con descripción, cantidad y fecha de necesidad",
          "Indica presupuesto aproximado y justificación",
          "Selecciona el autorizador que aprobará tu requisición",
          "Guarda como borrador o envía directamente a autorización"
        ]
      },
      {
        title: "Reposición",
        icon: RefreshCw,
        description: "Solicita el reembolso de gastos realizados con recursos propios.",
        features: [
          "Registra gastos de caja chica o viáticos",
          "Ingresa datos bancarios para depósito",
          "Detalla cada gasto con fecha, proveedor e importe",
          "Adjunta justificación de los gastos"
        ]
      },
      {
        title: "Pago Sin Orden de Compra",
        icon: FileText,
        description: "Solicita pagos directos que no requieren una orden de compra formal.",
        features: [
          "Útil para servicios recurrentes o pagos menores",
          "Especifica datos del proveedor y banco",
          "Detalla las partidas a pagar"
        ]
      },
      {
        title: "Ver Trámites",
        icon: FolderSearch,
        description: "Consulta el estado de todas tus solicitudes.",
        features: [
          "Visualiza requisiciones, reposiciones y pagos",
          "Filtra por estado, tipo o fecha",
          "Descarga PDF de cualquier trámite",
          "Ve el historial de cambios y comentarios"
        ]
      }
    ]
  },
  {
    role: "autorizador",
    label: "Autorizador",
    color: "bg-green-500",
    description: "Usuario con facultad para aprobar o rechazar solicitudes de compra asignadas.",
    sections: [
      {
        title: "Autorizar Requisiciones",
        icon: CheckCircle,
        description: "Revisa y aprueba las solicitudes que te han sido asignadas.",
        features: [
          "Recibe notificaciones de nuevas requisiciones pendientes",
          "Revisa justificación, partidas y montos",
          "Aprueba para continuar con el proceso de compra",
          "Rechaza con justificación si no procede",
          "Las requisiciones aprobadas pasan a licitación"
        ]
      },
      {
        title: "Ver Trámites",
        icon: FolderSearch,
        description: "Visualiza todas las requisiciones relacionadas contigo.",
        features: [
          "Ve trámites donde eres autorizador",
          "Consulta el historial de tus autorizaciones",
          "Filtra por estado pendiente/aprobado/rechazado"
        ]
      }
    ]
  },
  {
    role: "comprador",
    label: "Comprador",
    color: "bg-purple-500",
    description: "Encargado del proceso de licitación, selección de proveedores y colocación de pedidos.",
    sections: [
      {
        title: "Licitación",
        icon: Gavel,
        description: "Gestiona el proceso de cotización con proveedores.",
        features: [
          "Recibe requisiciones aprobadas para licitar",
          "Solicita cotizaciones a proveedores",
          "Registra datos del proveedor seleccionado",
          "Documenta el monto total de compra",
          "Agrega apuntes y notas del proceso"
        ]
      },
      {
        title: "Colocación de Pedido",
        icon: ShoppingCart,
        description: "Registra cuando el pedido ha sido formalmente colocado.",
        features: [
          "Marca el pedido como colocado con proveedor",
          "Registra fecha de colocación",
          "El trámite avanza a autorización del pedido"
        ]
      },
      {
        title: "Ver Trámites",
        icon: FolderSearch,
        description: "Gestiona todos los trámites en proceso de compra.",
        features: [
          "Ve requisiciones en licitación",
          "Filtra por estado del proceso de compra",
          "Accede al historial completo"
        ]
      }
    ]
  },
  {
    role: "presupuestos",
    label: "Presupuestos",
    color: "bg-amber-500",
    description: "Valida y autoriza los pedidos colocados contra el presupuesto disponible.",
    sections: [
      {
        title: "Autorización de Pedidos",
        icon: CheckCircle,
        description: "Autoriza pedidos verificando disponibilidad presupuestal.",
        features: [
          "Revisa pedidos colocados por compradores",
          "Valida contra presupuesto disponible",
          "Autoriza para proceder al pago",
          "Rechaza si no hay presupuesto con justificación",
          "Agrega apuntes de presupuesto"
        ]
      },
      {
        title: "Ver Trámites",
        icon: FolderSearch,
        description: "Consulta trámites pendientes de autorización presupuestal.",
        features: [
          "Filtra por pedidos colocados",
          "Ve historial de autorizaciones",
          "Consulta estadísticas de presupuesto"
        ]
      }
    ]
  },
  {
    role: "tesoreria",
    label: "Tesorería",
    color: "bg-teal-500",
    description: "Ejecuta los pagos de requisiciones autorizadas y reposiciones.",
    sections: [
      {
        title: "Procesamiento de Pagos",
        icon: CreditCard,
        description: "Ejecuta los pagos de trámites autorizados.",
        features: [
          "Recibe pedidos autorizados por presupuestos",
          "Procesa reposiciones aprobadas",
          "Registra la fecha y datos del pago",
          "Marca trámites como pagados",
          "Agrega apuntes de tesorería"
        ]
      },
      {
        title: "Ver Trámites",
        icon: FolderSearch,
        description: "Gestiona la cola de pagos pendientes.",
        features: [
          "Filtra por trámites pendientes de pago",
          "Ve historial de pagos realizados",
          "Consulta datos bancarios de beneficiarios"
        ]
      }
    ]
  },
  {
    role: "admin",
    label: "Administrador",
    color: "bg-orange-500",
    description: "Supervisa todos los trámites y tiene acceso a estadísticas del sistema.",
    sections: [
      {
        title: "Panel de Estadísticas",
        icon: BarChart3,
        description: "Visualiza métricas y KPIs del sistema.",
        features: [
          "Total de requisiciones y reposiciones",
          "Tiempo promedio por etapa del proceso",
          "Identificación de cuellos de botella",
          "Distribución de trámites por estado",
          "Volumen mensual de operaciones"
        ]
      },
      {
        title: "Ver Todos los Trámites",
        icon: FolderSearch,
        description: "Acceso completo a todos los trámites del sistema.",
        features: [
          "Visualiza trámites de todos los usuarios",
          "Filtra por cualquier criterio",
          "Exporta información a PDF",
          "Monitorea tiempos de respuesta"
        ]
      }
    ]
  },
  {
    role: "superadmin",
    label: "Super Administrador",
    color: "bg-red-500",
    description: "Control total del sistema incluyendo gestión de usuarios y catálogos.",
    sections: [
      {
        title: "Gestión de Usuarios",
        icon: Users,
        description: "Administra usuarios y sus roles en el sistema.",
        features: [
          "Crea nuevos usuarios con email y contraseña",
          "Asigna roles a cada usuario",
          "Edita información de perfil",
          "Restablece contraseñas",
          "Desactiva usuarios que ya no requieren acceso"
        ]
      },
      {
        title: "Gestión de Catálogos",
        icon: Settings,
        description: "Configura los catálogos del sistema.",
        features: [
          "Administra tipos de requisición con colores",
          "Gestiona catálogo de empresas",
          "Configura sucursales",
          "Define unidades de negocio por empresa",
          "Activa/desactiva elementos de catálogos"
        ]
      },
      {
        title: "Panel de Estadísticas",
        icon: BarChart3,
        description: "Acceso completo a métricas y análisis.",
        features: [
          "Todas las funciones del administrador",
          "Análisis de rendimiento por etapa",
          "Selector de unidad de tiempo (min/hrs/días)",
          "Identificación de áreas de mejora"
        ]
      },
      {
        title: "Ver Todos los Trámites",
        icon: FolderSearch,
        description: "Acceso total a información del sistema.",
        features: [
          "Visualización de todos los trámites",
          "Capacidad de editar cualquier trámite",
          "Historial completo de cambios",
          "Exportación de datos"
        ]
      }
    ]
  }
];

const workflowSteps = [
  { status: "borrador", label: "Borrador", icon: Clock, description: "Requisición guardada sin enviar" },
  { status: "pendiente", label: "Pendiente", icon: Clock, description: "Esperando autorización" },
  { status: "aprobado", label: "Aprobado", icon: CheckCircle, description: "Autorizado, pasa a compras" },
  { status: "rechazado", label: "Rechazado", icon: XCircle, description: "No aprobado por autorizador" },
  { status: "en_licitacion", label: "En Licitación", icon: Gavel, description: "Comprador cotizando" },
  { status: "pedido_colocado", label: "Pedido Colocado", icon: ShoppingCart, description: "Orden enviada a proveedor" },
  { status: "pedido_autorizado", label: "Pedido Autorizado", icon: CheckCircle, description: "Aprobado por presupuestos" },
  { status: "pedido_pagado", label: "Pagado", icon: CreditCard, description: "Pago ejecutado" },
  { status: "completado", label: "Completado", icon: CheckCircle, description: "Proceso finalizado" },
  { status: "cancelado", label: "Cancelado", icon: XCircle, description: "Trámite cancelado" },
];

const Ayuda = () => {
  const navigate = useNavigate();
  const { role, roles, user, isSuperadmin } = useAuth();
  const [sugerenciaTexto, setSugerenciaTexto] = useState("");
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [loadingSugerencias, setLoadingSugerencias] = useState(true);
  const [enviandoSugerencia, setEnviandoSugerencia] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedSugerencia, setSelectedSugerencia] = useState<Sugerencia | null>(null);
  const [justificacionRechazo, setJustificacionRechazo] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Get relevant roles for the current user, showing their role first
  const userRoles = roles.filter(r => r !== 'inactivo');
  const sortedHelpData = [...roleHelpData].sort((a, b) => {
    const aIndex = userRoles.indexOf(a.role as any);
    const bIndex = userRoles.indexOf(b.role as any);
    if (aIndex !== -1 && bIndex === -1) return -1;
    if (aIndex === -1 && bIndex !== -1) return 1;
    return 0;
  });

  // Fetch sugerencias
  const fetchSugerencias = async () => {
    setLoadingSugerencias(true);
    const { data, error } = await supabase
      .from('sugerencias' as any)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching sugerencias:', error);
    } else {
      setSugerencias((data as any[]) || []);
    }
    setLoadingSugerencias(false);
  };

  useEffect(() => {
    fetchSugerencias();
  }, []);

  const handleEnviarSugerencia = async () => {
    if (!sugerenciaTexto.trim() || !user) return;

    setEnviandoSugerencia(true);
    
    // Get user profile info
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .single();

    const { error } = await supabase
      .from('sugerencias' as any)
      .insert({
        user_id: user.id,
        user_name: profile?.full_name || 'Usuario',
        user_email: profile?.email || user.email || '',
        contenido: sugerenciaTexto.trim()
      });

    if (error) {
      toast.error("Error al enviar la sugerencia");
      console.error(error);
    } else {
      toast.success("Sugerencia enviada correctamente");
      setSugerenciaTexto("");
      fetchSugerencias();
    }
    setEnviandoSugerencia(false);
  };

  const handleUpdateEstado = async (id: string, estado: 'aceptada' | 'terminada') => {
    setProcessingId(id);
    const { error } = await supabase
      .from('sugerencias' as any)
      .update({ estado })
      .eq('id', id);

    if (error) {
      toast.error("Error al actualizar la sugerencia");
    } else {
      toast.success(`Sugerencia ${estado === 'aceptada' ? 'aceptada' : 'marcada como terminada'}`);
      fetchSugerencias();
    }
    setProcessingId(null);
  };

  const handleRechazar = async () => {
    if (!selectedSugerencia || !justificacionRechazo.trim()) return;

    setProcessingId(selectedSugerencia.id);
    const { error } = await supabase
      .from('sugerencias' as any)
      .update({ 
        estado: 'rechazada',
        justificacion_rechazo: justificacionRechazo.trim()
      })
      .eq('id', selectedSugerencia.id);

    if (error) {
      toast.error("Error al rechazar la sugerencia");
    } else {
      toast.success("Sugerencia rechazada");
      fetchSugerencias();
    }
    setRejectDialogOpen(false);
    setSelectedSugerencia(null);
    setJustificacionRechazo("");
    setProcessingId(null);
  };

  const getEstadoBadge = (estado: string, justificacion?: string | null) => {
    switch (estado) {
      case 'pendiente':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pendiente</Badge>;
      case 'aceptada':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Aceptada</Badge>;
      case 'rechazada':
        return (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Rechazada</Badge>
            {justificacion && (
              <p className="text-xs text-muted-foreground italic">"{justificacion}"</p>
            )}
          </div>
        );
      case 'terminada':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Terminada</Badge>;
      default:
        return null;
    }
  };

  const generateTextContent = () => {
    let content = "=".repeat(60) + "\n";
    content += "GUÍA DE USO DEL SISTEMA - NRT MÉXICO\n";
    content += "=".repeat(60) + "\n\n";

    // Workflow
    content += "FLUJO DE UNA REQUISICIÓN\n";
    content += "-".repeat(40) + "\n";
    workflowSteps.forEach((step, idx) => {
      content += `${idx + 1}. ${step.label}: ${step.description}\n`;
    });
    content += "\n";

    // Roles
    content += "=".repeat(60) + "\n";
    content += "FUNCIONES POR ROL\n";
    content += "=".repeat(60) + "\n\n";

    roleHelpData.forEach((roleData) => {
      content += "-".repeat(40) + "\n";
      content += `ROL: ${roleData.label.toUpperCase()}\n`;
      content += "-".repeat(40) + "\n";
      content += `${roleData.description}\n\n`;

      roleData.sections.forEach((section) => {
        content += `  ► ${section.title}\n`;
        content += `    ${section.description}\n`;
        section.features.forEach((feature) => {
          content += `    • ${feature}\n`;
        });
        content += "\n";
      });
      content += "\n";
    });

    // Tips
    content += "=".repeat(60) + "\n";
    content += "CONSEJOS RÁPIDOS\n";
    content += "=".repeat(60) + "\n";
    content += "• Activa las notificaciones en tu perfil para recibir alertas de cambios de estado.\n";
    content += "• Usa los filtros en 'Ver Trámites' para encontrar rápidamente lo que buscas.\n";
    content += "• Guarda borradores si no tienes toda la información lista.\n";
    content += "• Descarga el PDF de cualquier trámite para tener un respaldo.\n";
    content += "• Cambia entre tema claro y oscuro con el botón en la esquina superior.\n";
    content += "\n";
    content += "=".repeat(60) + "\n";
    content += "¿Necesitas más ayuda? Contacta al administrador del sistema.\n";

    return content;
  };

  const handleDownload = () => {
    const content = generateTextContent();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "guia-sistema-nrt.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Guía descargada correctamente");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 font-barlow">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <span className="font-black text-xl">
                <span className="text-primary">NRT</span> <span className="text-foreground text-[0.75em]">MÉXICO</span>
              </span>
              <span className="text-foreground font-black text-lg">Centro de Ayuda</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-10 pb-24">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Guía de Uso del Sistema
            </h1>
            <p className="text-muted-foreground">
              Encuentra información detallada sobre las funciones disponibles según tu rol.
            </p>
          </div>
          <Button variant="outline" onClick={handleDownload} className="gap-2">
            <Download className="w-4 h-4" />
            Descargar
          </Button>
        </div>

        {/* Workflow Overview */}
        <Card className="mb-8 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Flujo de una Requisición</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {workflowSteps.map((step, index) => (
                <div key={step.status} className="flex items-center">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-sm">
                    <step.icon className="w-3.5 h-3.5" />
                    <span>{step.label}</span>
                  </div>
                  {index < workflowSteps.length - 1 && (
                    <span className="mx-1 text-muted-foreground">→</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Role-based Help Sections */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Funciones por Rol</h2>
          
          <Accordion type="multiple" className="space-y-4">
            {sortedHelpData.map((roleData) => {
              const isUserRole = userRoles.includes(roleData.role as any);
              
              return (
                <AccordionItem 
                  key={roleData.role} 
                  value={roleData.role}
                  className="border border-border rounded-lg overflow-hidden bg-card"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${roleData.color}`} />
                      <span className="font-semibold">{roleData.label}</span>
                      {isUserRole && (
                        <Badge variant="outline" className="text-xs border-primary text-primary">
                          Tu rol
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <p className="text-muted-foreground mb-4">{roleData.description}</p>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      {roleData.sections.map((section) => (
                        <Card key={section.title} className="border-border bg-secondary/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <section.icon className="w-4 h-4 text-primary" />
                              {section.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <p className="text-sm text-muted-foreground mb-3">
                              {section.description}
                            </p>
                            <ul className="space-y-1">
                              {section.features.map((feature, idx) => (
                                <li key={idx} className="text-sm flex items-start gap-2">
                                  <span className="text-primary mt-1">•</span>
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>

        {/* Quick Tips */}
        <Card className="mt-8 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Consejos Rápidos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">💡</span>
                <span>Activa las notificaciones en tu perfil para recibir alertas de cambios de estado.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">💡</span>
                <span>Usa los filtros en "Ver Trámites" para encontrar rápidamente lo que buscas.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">💡</span>
                <span>Guarda borradores si no tienes toda la información lista.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">💡</span>
                <span>Descarga el PDF de cualquier trámite para tener un respaldo.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">💡</span>
                <span>Cambia entre tema claro y oscuro con el botón en la esquina superior.</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Sugerencias Section */}
        <Card className="mt-8 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              Sugerencias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Form to submit suggestion - NOT for superadmin */}
            {!isSuperadmin && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  ¿Tienes ideas para mejorar el sistema? Envía tu sugerencia y el equipo la revisará.
                </p>
                <Textarea
                  placeholder="Escribe tu sugerencia aquí..."
                  value={sugerenciaTexto}
                  onChange={(e) => setSugerenciaTexto(e.target.value)}
                  className="min-h-[100px]"
                />
                <Button 
                  onClick={handleEnviarSugerencia} 
                  disabled={!sugerenciaTexto.trim() || enviandoSugerencia}
                  className="gap-2"
                >
                  {enviandoSugerencia ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Enviar Sugerencia
                </Button>
              </div>
            )}

            {/* Superadmin: Task list of all suggestions */}
            {isSuperadmin && (
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Gestiona las sugerencias enviadas por los usuarios del sistema.
                </p>
                <h3 className="font-semibold mb-4 text-foreground">Administrar Sugerencias</h3>
                {loadingSugerencias ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : sugerencias.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay sugerencias aún.</p>
                ) : (
                  <div className="space-y-3">
                    {sugerencias.map((sug) => (
                      <div key={sug.id} className="p-4 rounded-lg border border-border bg-secondary/30">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{sug.user_name}</span>
                              <span className="text-xs text-muted-foreground">({sug.user_email})</span>
                              {getEstadoBadge(sug.estado, sug.justificacion_rechazo)}
                            </div>
                            <p className="text-sm text-foreground">{sug.contenido}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(sug.created_at).toLocaleDateString('es-MX', { 
                                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                          {sug.estado === 'pendiente' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                onClick={() => {
                                  setSelectedSugerencia(sug);
                                  setRejectDialogOpen(true);
                                }}
                                disabled={processingId === sug.id}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                                onClick={() => handleUpdateEstado(sug.id, 'aceptada')}
                                disabled={processingId === sug.id}
                              >
                                {processingId === sug.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </Button>
                            </div>
                          )}
                          {sug.estado === 'aceptada' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                              onClick={() => handleUpdateEstado(sug.id, 'terminada')}
                              disabled={processingId === sug.id}
                            >
                              {processingId === sug.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Regular users: Show their own suggestions */}
            {!isSuperadmin && sugerencias.length > 0 && (
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold mb-4 text-foreground">Mis Sugerencias</h3>
                <div className="space-y-3">
                  {sugerencias.map((sug) => (
                    <div key={sug.id} className="p-4 rounded-lg border border-border bg-secondary/30">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <p className="text-sm text-foreground">{sug.contenido}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(sug.created_at).toLocaleDateString('es-MX', { 
                              year: 'numeric', month: 'short', day: 'numeric'
                            })}
                          </p>
                        </div>
                        {getEstadoBadge(sug.estado, sug.justificacion_rechazo)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Sugerencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Por favor indica el motivo por el cual no se implementará esta sugerencia:
            </p>
            <Textarea
              placeholder="Escribe la justificación..."
              value={justificacionRechazo}
              onChange={(e) => setJustificacionRechazo(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRechazar}
              disabled={!justificacionRechazo.trim() || processingId !== null}
            >
              {processingId ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-border py-4 bg-background font-barlow">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-muted-foreground text-sm">
            ¿Necesitas más ayuda? Contacta al administrador del sistema.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Ayuda;
