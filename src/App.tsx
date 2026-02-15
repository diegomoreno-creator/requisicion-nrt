import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Perfil from "./pages/Perfil";
import Ayuda from "./pages/Ayuda";
import Requisicion from "./pages/Requisicion";
import Reposicion from "./pages/Reposicion";
import PagoSinOC from "./pages/PagoSinOC";
import Tramites from "./pages/Tramites";
import GestionUsuarios from "./pages/GestionUsuarios";
import GestionCatalogos from "./pages/GestionCatalogos";
import BulkCreateUsers from "./pages/BulkCreateUsers";
import Notificaciones from "./pages/Notificaciones";
import Estadisticas from "./pages/Estadisticas";
import ContabilidadGastos from "./pages/ContabilidadGastos";
import Install from "./pages/Install";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/perfil" 
              element={
                <ProtectedRoute>
                  <Perfil />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ayuda" 
              element={
                <ProtectedRoute>
                  <Ayuda />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/requisicion" 
              element={
                <ProtectedRoute requiresFormAccess>
                  <Requisicion />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/requisicion/:id" 
              element={
                <ProtectedRoute>
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
              path="/reposicion/:id" 
              element={
                <ProtectedRoute>
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
            <Route 
              path="/tramites" 
              element={
                <ProtectedRoute>
                  <Tramites />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/gestion-usuarios" 
              element={
                <ProtectedRoute requiresPermission="gestionar_usuarios">
                  <GestionUsuarios />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/gestion-catalogos" 
              element={
                <ProtectedRoute requiresPermission="gestionar_catalogos">
                  <GestionCatalogos />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/bulk-create-users" 
              element={
                <ProtectedRoute requiresPermission="gestionar_usuarios">
                  <BulkCreateUsers />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/notificaciones" 
              element={
                <ProtectedRoute requiresPermission="gestionar_notificaciones">
                  <Notificaciones />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/estadisticas" 
              element={
                <ProtectedRoute>
                  <Estadisticas />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/contabilidad-gastos" 
              element={
                <ProtectedRoute requiresRole="contabilidad_gastos">
                  <ContabilidadGastos />
                </ProtectedRoute>
              } 
            />
            <Route path="/install" element={<Install />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
