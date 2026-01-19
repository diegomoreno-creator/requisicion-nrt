import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FolderSearch } from "lucide-react";

const Tramites = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al menú
        </Button>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderSearch className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-foreground">Ver Trámites</CardTitle>
              <p className="text-muted-foreground text-sm">
                Consulta el estado de todos tus trámites
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <p>Vista de trámites próximamente...</p>
              <p className="text-sm mt-2">Aquí podrás consultar el estado de tus trámites</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Tramites;
