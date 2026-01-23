import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, Users } from "lucide-react";
import { toast } from "sonner";

// Parsed users from Excel - with role mapping
const usersToCreate = [
  { email: "alejandracabrera@temp.nrt", fullName: "Alejandra Cabrera", roles: ["solicitador"] },
  { email: "alfredoterrazas@nrtmexico.mx", fullName: "Alfredo Terrazas", roles: ["solicitador"] },
  { email: "almamancha@nrtmexico.mx", fullName: "Alma Mancha", roles: ["solicitador", "autorizador"] },
  { email: "cristianauditoría@temp.nrt", fullName: "Cristian", roles: ["solicitador"] },
  { email: "karinahernandez@nrtmexico.mx", fullName: "Karina Hernández", roles: ["solicitador"] },
  { email: "graciapalacio@nrtmexico.mx", fullName: "Gracia Palacio", roles: ["solicitador", "autorizador"] },
  { email: "marianavazquez@nrtmexico.mx", fullName: "Mariana Vázquez", roles: ["autorizador"] },
  { email: "mirnalangle@nrtmexico.mx", fullName: "Mirna Langle", roles: ["solicitador", "comprador"] },
  { email: "fabiolarodriguez@nrtmexico.mx", fullName: "Fabiola Rodríguez", roles: ["solicitador", "comprador"] },
  { email: "danielaleyva@nrtmexico.mx", fullName: "Daniela Leyva", roles: ["solicitador", "comprador"] },
  { email: "magalysanchez@nrtmexico.mx", fullName: "Magaly Sánchez", roles: ["solicitador"] },
  { email: "lilianaoviedo@nrtmexico.mx", fullName: "Liliana Oviedo", roles: ["solicitador", "autorizador"] },
  { email: "asesorjuridico@temp.nrt", fullName: "Asesor externo Jurídico", roles: ["autorizador"] },
  { email: "gaguilar@nrtmexico.mx", fullName: "Gabriel Aguilar", roles: ["autorizador"] },
  { email: "jesusflores@eimexico.com", fullName: "Jesús Flores", roles: ["solicitador"] },
  { email: "guillermobarboza@eimexico.com", fullName: "Guillermo Barboza", roles: ["solicitador"] },
  { email: "sandragongora@eimexico.com", fullName: "Sandra Góngora", roles: ["solicitador"] },
  { email: "alejandraabad@eimexico.com", fullName: "Alejandra Abad", roles: ["solicitador", "autorizador"] },
  { email: "aracelisanchez@eimexico.com", fullName: "Araceli Sánchez", roles: ["solicitador"] },
  { email: "guillermosoto@eimexico.com", fullName: "Guillermo Soto", roles: ["solicitador", "autorizador"] },
  { email: "carlosmona@eimexico.com", fullName: "Carlos Mona", roles: ["solicitador"] },
  { email: "jesusarmandoflores@eimexico.com", fullName: "Jesús Armando Flores", roles: ["solicitador"] },
  { email: "felipeangeles@eimexico.com", fullName: "Felipe Ángeles", roles: ["solicitador"] },
  { email: "cristiancamacho@eimexico.com", fullName: "Cristian Camacho", roles: ["solicitador"] },
  { email: "degadymoreno@eimexico.com", fullName: "Degady Moreno", roles: ["solicitador"] },
  { email: "hernanchavez@eimexico.com", fullName: "Hernán Chávez", roles: ["solicitador"] },
  { email: "isismorales@eimexico.com", fullName: "Isis Morales", roles: ["solicitador"] },
  { email: "jorgechavez@eimexico.com", fullName: "Jorge Chávez", roles: ["autorizador"] },
  { email: "karlaluna@eimexico.com", fullName: "Karla Luna", roles: ["solicitador"] },
  { email: "luisrojas@eimexico.com", fullName: "Luis Fernando Rojas", roles: ["solicitador"] },
  { email: "nancycarrillo@eimexico.com", fullName: "Nancy Carrillo", roles: ["solicitador"] },
  { email: "rosadeluna@temp.nrt", fullName: "Rosa De Luna", roles: ["solicitador"] },
  { email: "gabrielgonzalez@eimexico.com", fullName: "Gabriel González", roles: ["solicitador"] },
  { email: "juanitajasso@eimexico.com", fullName: "Juanita Enedenia Jasso", roles: ["solicitador"] },
  { email: "ruthmedina@eimexico.com", fullName: "Ruth López", roles: ["solicitador"] },
  { email: "cynthiaalvarado@eimexico.com", fullName: "Cynthia Alvarado", roles: ["solicitador"] },
  { email: "ezequielrangel@eimexico.com", fullName: "Ezequiel Rangel", roles: ["solicitador"] },
  { email: "itzelquiroz@eimexico.com", fullName: "Itzel Quiróz", roles: ["solicitador"] },
  { email: "jabelgarcia@eimexico.com", fullName: "Jabel García", roles: ["solicitador"] },
  { email: "javiercontreras@eimexico.com", fullName: "Javier Contreras", roles: ["solicitador"] },
  { email: "josechavez@eimexico.com", fullName: "Juan Chávez", roles: ["solicitador"] },
  { email: "karlarobles@eimexico.com", fullName: "Karla Robles", roles: ["solicitador"] },
  { email: "natanaelreyes@eimexico.com", fullName: "Natanael Reyes", roles: ["solicitador"] },
  { email: "raulbanda@eimexico.com", fullName: "Raúl Banda", roles: ["autorizador"] },
  { email: "almacenvictoria@eimexico.com", fullName: "Almacen Victoria", roles: ["solicitador"] },
  { email: "almacenmante@eimexico.com", fullName: "Almacen Mante", roles: ["solicitador"] },
  { email: "pedroescalante@eimexico.com", fullName: "José Pedro Escalante", roles: ["solicitador"] },
  { email: "juanvazquez@eimexico.com", fullName: "Juan Vázquez", roles: ["solicitador"] },
  { email: "yuridiarodriguez@eimexico.com", fullName: "Yuridia Rodríguez", roles: ["solicitador"] },
  { email: "zuri@fibranet.mx", fullName: "Zuriely Victoria", roles: ["autorizador"] },
  { email: "alejandrareséndiz@temp.nrt", fullName: "Alejandra Reséndiz", roles: ["solicitador"] },
  { email: "claudiamarina@nrtmexico.mx", fullName: "Claudia Pérez", roles: ["solicitador"] },
  { email: "asistentedireccion@fibranet.mx", fullName: "Nancy Cabello", roles: ["solicitador"] },
  { email: "ximena@fibranet.mx", fullName: "Ximena Mendoza", roles: ["solicitador"] },
  { email: "diegomoreno@nrtmexico.mx", fullName: "Diego Moreno", roles: ["admin"] },
  { email: "fatimareyna@nrtmexico.mx", fullName: "Fátima Reyna", roles: ["solicitador"] },
  { email: "federicocanovas@nrtmexico.mx", fullName: "Federico Canovas", roles: ["autorizador"] },
  { email: "jesusvaldez@temp.nrt", fullName: "Jesús Valdez", roles: ["solicitador"] },
  { email: "jorgerangel@temp.nrt", fullName: "Jorge Rangel", roles: ["solicitador"] },
  { email: "julioalbores@nrtmexico.mx", fullName: "Julio Montes", roles: ["solicitador"] },
  { email: "luisadehoyos@nrtmexico.mx", fullName: "Luisa De Hoyos", roles: ["solicitador"] },
  { email: "luisedgarradio@hotmail.com", fullName: "Luis Edgar González", roles: ["solicitador"] },
  { email: "marceladiaz@nrtmexico.mx", fullName: "Marcela Ballesteros", roles: ["solicitador"] },
  { email: "marioperez@nrtmexico.mx", fullName: "Mario Cruz", roles: ["solicitador"] },
  { email: "patysanchez@nrtmexico.mx", fullName: "Patricia Sánchez", roles: ["solicitador"] },
  { email: "angelaescarcega@nrtmexico.mx", fullName: "Ángela Escárcega", roles: ["solicitador"] },
  { email: "luistijerina@nrtmexico.mx", fullName: "José Luis Rangel", roles: ["solicitador", "autorizador"] },
  { email: "blancamartinez@nrtmexico.mx", fullName: "Blanca Flor Martínez", roles: ["solicitador", "presupuestos"] },
  { email: "danielahernandez@nrtmexico.mx", fullName: "Daniela Alejandra Hernández", roles: ["solicitador", "presupuestos"] },
  { email: "patriciaalfaro@nrtmexico.mx", fullName: "Patricia Alfaro", roles: ["solicitador"] },
  { email: "almaruiz@nrtmexico.mx", fullName: "Alma Ruíz", roles: ["solicitador"] },
  { email: "manuelarmendariz@nrtmexico.mx", fullName: "Manuel Moreno", roles: ["solicitador"] },
  { email: "monicagutierrez@nrtmexico.mx", fullName: "Mónica Gutiérrez", roles: ["solicitador", "autorizador"] },
  { email: "tahliaduarte@nrtmexico.mx", fullName: "Tahlia Duarte", roles: ["solicitador"] },
  { email: "adrianamadera@nrtmexico.mx", fullName: "Adriana Madera", roles: ["solicitador", "tesoreria"] },
  { email: "nohemiurquieta@nrtmexico.mx", fullName: "Nohemí Urquieta", roles: ["solicitador", "tesoreria"] },
  { email: "camilasanchez@nrtmexico.mx", fullName: "Camila Sánchez", roles: ["solicitador", "tesoreria"] },
  { email: "davidaragon@nrtmexico.mx", fullName: "David Aragón", roles: ["solicitador", "autorizador"] },
  { email: "noheliaramos@nrtmexico.mx", fullName: "Nohelia Ramos", roles: ["solicitador"] },
  { email: "migueldelapaz@nrtmexico.mx", fullName: "Miguel De La Paz", roles: ["solicitador"] },
];

interface CreateResult {
  email: string;
  success: boolean;
  error?: string;
}

const BulkCreateUsers = () => {
  const { isSuperadmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CreateResult[]>([]);
  const [processed, setProcessed] = useState(false);

  const handleBulkCreate = async () => {
    setLoading(true);
    setResults([]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("No hay sesión activa");
        return;
      }

      // Process in batches of 10 to avoid timeouts
      const batchSize = 10;
      const allResults: CreateResult[] = [];
      
      for (let i = 0; i < usersToCreate.length; i += batchSize) {
        const batch = usersToCreate.slice(i, i + batchSize).map(u => ({
          email: u.email,
          password: "12345678",
          fullName: u.fullName,
          roles: u.roles
        }));

        toast.info(`Procesando usuarios ${i + 1} - ${Math.min(i + batchSize, usersToCreate.length)}...`);

        const { data, error } = await supabase.functions.invoke("manage-users", {
          body: { action: "bulkCreateUsers", users: batch }
        });

        if (error) {
          console.error("Error in batch:", error);
          batch.forEach(u => allResults.push({ email: u.email, success: false, error: error.message }));
        } else if (data?.results) {
          allResults.push(...data.results);
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setResults(allResults);
      setProcessed(true);

      const successCount = allResults.filter(r => r.success).length;
      const failCount = allResults.filter(r => !r.success).length;
      
      if (failCount === 0) {
        toast.success(`¡${successCount} usuarios creados exitosamente!`);
      } else {
        toast.warning(`Creados ${successCount} usuarios. ${failCount} fallaron.`);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al crear usuarios");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">Acceso denegado. Solo superadmin.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">Crear Usuarios en Lote</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Usuarios a Crear ({usersToCreate.length})</CardTitle>
            <CardDescription>
              Se crearán los siguientes usuarios con contraseña temporal: 12345678
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!processed && (
              <Button onClick={handleBulkCreate} disabled={loading} className="mb-4">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando usuarios...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Iniciar Creación
                  </>
                )}
              </Button>
            )}

            <div className="max-h-[500px] overflow-y-auto space-y-2">
              {processed ? (
                results.map((result, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded border">
                    {result.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                    )}
                    <span className="flex-1">{result.email}</span>
                    {result.error && (
                      <span className="text-sm text-destructive">{result.error}</span>
                    )}
                  </div>
                ))
              ) : (
                usersToCreate.map((user, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded border">
                    <div>
                      <p className="font-medium">{user.fullName}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {user.roles.map(role => (
                        <span key={role} className="text-xs bg-secondary px-2 py-1 rounded">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default BulkCreateUsers;
