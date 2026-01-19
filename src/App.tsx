import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Perfil from "./pages/Perfil";
import Requisicion from "./pages/Requisicion";
import Reposicion from "./pages/Reposicion";
import PagoSinOC from "./pages/PagoSinOC";
import Tramites from "./pages/Tramites";
import GestionUsuarios from "./pages/GestionUsuarios";
import GestionCatalogos from "./pages/GestionCatalogos";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route 
            path="/requisicion" 
            element={
              <ProtectedRoute requiresFormAccess>
                <Requisicion />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/reposicion" 
            element={
              <ProtectedRoute requiresFormAccess>
                <Reposicion />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/pago-sin-oc" 
            element={
              <ProtectedRoute requiresFormAccess>
                <PagoSinOC />
              </ProtectedRoute>
            } 
          />
          <Route path="/tramites" element={<Tramites />} />
          <Route 
            path="/gestion-usuarios" 
            element={
              <ProtectedRoute requiresSuperadmin>
                <GestionUsuarios />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/gestion-catalogos" 
            element={
              <ProtectedRoute requiresSuperadmin>
                <GestionCatalogos />
              </ProtectedRoute>
            } 
          />
          <Route path="/install" element={<Install />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
