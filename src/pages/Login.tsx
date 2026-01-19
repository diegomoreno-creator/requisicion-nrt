import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Rocket } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  const checkUserRole = async (userId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.rpc('get_user_role', { _user_id: userId });
      if (error) {
        console.error('Error checking role:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Error:', err);
      return null;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const role = await checkUserRole(session.user.id);
          
          if (role === 'inactivo') {
            await supabase.auth.signOut();
            toast.error("Tu cuenta está inactiva. Contacta al administrador para activarla.");
            return;
          }
          
          navigate("/dashboard");
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const role = await checkUserRole(session.user.id);
        
        if (role === 'inactivo') {
          await supabase.auth.signOut();
          return;
        }
        
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        
        toast.success("Cuenta creada. Tu cuenta está inactiva hasta que un administrador la active.");
        setIsSignUp(false);
        setEmail("");
        setPassword("");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // Check role after login
        if (data.user) {
          const role = await checkUserRole(data.user.id);
          
          if (role === 'inactivo') {
            await supabase.auth.signOut();
            toast.error("Tu cuenta está inactiva. Contacta al administrador para activarla.");
            return;
          }
          
          toast.success("Bienvenido de vuelta");
        }
      }
    } catch (error: any) {
      if (error.message === "User already registered") {
        toast.error("Este correo ya está registrado");
      } else if (error.message === "Invalid login credentials") {
        toast.error("Credenciales inválidas");
      } else {
        toast.error(error.message || "Ocurrió un error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mb-6">
              <Rocket className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isSignUp ? "Crear Cuenta" : "Bienvenido de Vuelta"}
            </h1>
            <p className="text-muted-foreground text-sm text-center">
              {isSignUp
                ? "Ingresa tus datos para registrarte (tu cuenta quedará inactiva hasta aprobación)"
                : "Ingresa tus credenciales para acceder a tu panel"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground text-sm font-medium">
                Correo Electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="nombre@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground text-sm font-medium">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={isLoading}
            >
              {isLoading
                ? "Cargando..."
                : isSignUp
                ? "Registrarse"
                : "Iniciar Sesión"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isSignUp
                ? "¿Ya tienes cuenta? Inicia sesión"
                : "¿No tienes cuenta? Regístrate"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
