import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsRecoverySession(true);
        }
      }
    );

    // Also check if we already have a session (recovery link already processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsRecoverySession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      toast.success("Contraseña actualizada exitosamente");

      // Sign out and redirect to login after a short delay
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/");
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar la contraseña");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isRecoverySession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardContent className="pt-8 pb-8 px-8 text-center">
            <div className="text-3xl font-black mb-6 font-barlow">
              <span className="text-primary">NRT</span> <span className="text-foreground text-[0.75em]">MÉXICO</span>
            </div>
            <p className="text-muted-foreground mb-4">Verificando enlace de recuperación...</p>
            <p className="text-muted-foreground text-sm">
              Si el enlace no funciona,{" "}
              <button
                onClick={() => navigate("/")}
                className="text-primary hover:underline"
              >
                vuelve al inicio
              </button>{" "}
              y solicita uno nuevo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardContent className="pt-8 pb-8 px-8 text-center">
            <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">¡Contraseña Actualizada!</h1>
            <p className="text-muted-foreground text-sm">
              Redirigiendo al inicio de sesión...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="flex flex-col items-center mb-8 font-barlow">
            <div className="text-3xl font-black mb-6">
              <span className="text-primary">NRT</span> <span className="text-foreground text-[0.75em]">MÉXICO</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Nueva Contraseña
            </h1>
            <p className="text-muted-foreground text-sm text-center">
              Ingresa tu nueva contraseña para completar la recuperación
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground text-sm font-medium">
                Nueva Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground text-sm font-medium">
                Confirmar Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={isLoading}
            >
              {isLoading ? "Actualizando..." : "Actualizar Contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
