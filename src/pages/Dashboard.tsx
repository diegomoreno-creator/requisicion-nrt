import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Rocket, 
  FilePlus, 
  RefreshCw, 
  FileText, 
  FolderSearch,
  Moon
} from "lucide-react";

interface User {
  email: string;
  name: string;
}

const menuItems = [
  {
    title: "Requisición",
    description: "Gestiona tus requisiciones.",
    icon: FilePlus,
    path: "/requisicion",
  },
  {
    title: "Reposición",
    description: "Solicita la reposición de tus gastos.",
    icon: RefreshCw,
    path: "/reposicion",
  },
  {
    title: "Pago Sin Orden De Compra",
    description: "Realiza pagos que no requieren orden de compra.",
    icon: FileText,
    path: "/pago-sin-oc",
  },
  {
    title: "Ver Trámites",
    description: "Consulta el estado de todos tus trámites.",
    icon: FolderSearch,
    path: "/tramites",
  },
];

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate("/");
      return;
    }
    setUser(JSON.parse(storedUser));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Rocket className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-foreground font-medium">Panel de Control</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-primary font-bold tracking-wide">NRT</span>
            <span className="text-foreground font-medium">MÉXICO</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-primary border-none hover:bg-primary/90"
            >
              <Moon className="w-4 h-4 text-primary-foreground" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-border bg-secondary hover:bg-secondary/80"
              onClick={handleLogout}
            >
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-secondary text-foreground text-sm">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-foreground mb-8">
          Bienvenido, <span className="text-primary">{user.name}</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menuItems.map((item) => (
            <Card
              key={item.title}
              className="border-border bg-card hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => navigate(item.path)}
            >
              <CardContent className="p-6 flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {item.description}
                  </p>
                </div>
                <div className="text-primary">
                  <item.icon className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-border py-4 bg-background">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-muted-foreground text-sm">
            Desarrollado por{" "}
            <span className="text-foreground font-medium">Hub de Innovación</span> de{" "}
            <span className="text-primary font-bold">NRT</span>{" "}
            <span className="text-foreground font-medium">México</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
