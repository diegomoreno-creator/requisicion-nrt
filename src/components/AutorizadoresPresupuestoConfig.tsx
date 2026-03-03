import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MULTI_AUTH_BUDGET_THRESHOLD } from "@/hooks/useMultiAuth";

interface AutorizadorOption {
  user_id: string;
  email: string;
  full_name: string | null;
}

interface ForcedAutorizador {
  id: string;
  user_id: string;
  orden: number;
  nombre?: string;
}

const AutorizadoresPresupuestoConfig = () => {
  const [autorizadores, setAutorizadores] = useState<AutorizadorOption[]>([]);
  const [forced, setForced] = useState<ForcedAutorizador[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all users with autorizador role
      const { data: autorizadorList } = await supabase.rpc("get_autorizadores");

      // Fetch current forced authorizers
      const { data: forcedList } = await supabase
        .from("autorizadores_presupuesto")
        .select("*")
        .order("orden", { ascending: true });

      if (autorizadorList) setAutorizadores(autorizadorList);
      
      if (forcedList) {
        // Resolve names
        const withNames = await Promise.all(
          forcedList.map(async (f: any) => {
            const { data: name } = await supabase.rpc("get_profile_name", { _user_id: f.user_id });
            return { ...f, nombre: name || "Usuario" };
          })
        );
        setForced(withNames);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = async () => {
    if (selectedToAdd.length === 0) return;
    setSaving(true);
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      const maxOrden = forced.length > 0 ? Math.max(...forced.map(f => f.orden)) : 0;

      const inserts = selectedToAdd.map((userId, i) => ({
        user_id: userId,
        orden: maxOrden + i + 1,
        created_by: currentUser?.id || userId,
      }));

      const { error } = await supabase.from("autorizadores_presupuesto").insert(inserts);
      if (error) throw error;

      toast.success("Autorizador(es) agregado(s)");
      setSelectedToAdd([]);
      await fetchData();
    } catch (err: any) {
      toast.error("Error al agregar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("autorizadores_presupuesto").delete().eq("id", id);
      if (error) throw error;
      toast.success("Autorizador removido");
      await fetchData();
    } catch (err: any) {
      toast.error("Error al remover: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const availableToAdd = autorizadores.filter(
    a => !forced.some(f => f.user_id === a.user_id)
  );

  if (loading) {
    return (
      <Card className="border-border bg-card mt-6">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card mt-6">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2 text-base">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Autorizadores de Presupuesto Alto (&gt; ${MULTI_AUTH_BUDGET_THRESHOLD.toLocaleString()} MXN)
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Estos usuarios serán asignados automáticamente como autorizadores adicionales cuando el presupuesto de una requisición supere el umbral configurado.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current forced authorizers */}
        {forced.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Autorizadores asignados:</p>
            {forced.map((f, i) => (
              <div key={f.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">Orden {i + 1}</Badge>
                  <span className="text-sm text-foreground font-medium">{f.nombre}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(f.id)}
                  disabled={saving}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No hay autorizadores configurados. Las requisiciones de alto presupuesto usarán el flujo estándar de un solo autorizador.
          </p>
        )}

        {/* Add new */}
        {availableToAdd.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm font-medium text-foreground">Agregar autorizadores:</p>
            <div className="bg-input border border-border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
              {availableToAdd.map(aut => (
                <label key={aut.user_id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded p-1">
                  <Checkbox
                    checked={selectedToAdd.includes(aut.user_id)}
                    onCheckedChange={(checked) => {
                      setSelectedToAdd(prev =>
                        checked
                          ? [...prev, aut.user_id]
                          : prev.filter(id => id !== aut.user_id)
                      );
                    }}
                  />
                  <span className="text-sm text-foreground">{aut.full_name || aut.email}</span>
                </label>
              ))}
            </div>
            <Button
              onClick={handleAdd}
              disabled={selectedToAdd.length === 0 || saving}
              size="sm"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Agregar seleccionados
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AutorizadoresPresupuestoConfig;
