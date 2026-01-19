import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Requisicion from "./pages/Requisicion";
import Reposicion from "./pages/Reposicion";
import PagoSinOC from "./pages/PagoSinOC";
import Tramites from "./pages/Tramites";
import GestionUsuarios from "./pages/GestionUsuarios";
import NotFound from "./pages/NotFound";

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
          <Route path="/requisicion" element={<Requisicion />} />
          <Route path="/reposicion" element={<Reposicion />} />
          <Route path="/pago-sin-oc" element={<PagoSinOC />} />
          <Route path="/tramites" element={<Tramites />} />
          <Route path="/gestion-usuarios" element={<GestionUsuarios />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
