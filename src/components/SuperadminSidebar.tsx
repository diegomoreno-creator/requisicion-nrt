import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Bell, Users, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const adminItems = [
  { title: "Estadísticas", url: "/estadisticas", icon: BarChart3 },
  { title: "Notificaciones", url: "/notificaciones", icon: Bell },
  { title: "Gestión de Usuarios", url: "/gestion-usuarios", icon: Users },
  { title: "Gestión de Catálogos", url: "/gestion-catalogos", icon: Settings },
];

export function SuperadminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar
      className={`${collapsed ? "w-14" : "w-60"} border-r border-border bg-card transition-all duration-200`}
      collapsible="icon"
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        {!collapsed && (
          <span className="text-sm font-semibold text-muted-foreground">
            Administración
          </span>
        )}
        <SidebarTrigger className="ml-auto" />
      </div>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-xs text-muted-foreground">
              Panel de Control
            </SidebarGroupLabel>
          )}

          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    className={`w-full justify-start cursor-pointer transition-colors ${
                      isActive(item.url)
                        ? "bg-primary/10 text-primary border-l-2 border-primary"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <item.icon className={`h-4 w-4 ${collapsed ? "" : "mr-3"}`} />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
