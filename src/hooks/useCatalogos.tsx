import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TipoRequisicion {
  id: string;
  nombre: string;
  color_class: string;
  color_hsl: string;
  activo: boolean;
}

export interface CatalogoSimple {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface UnidadNegocio {
  id: string;
  nombre: string;
  empresa_id: string | null;
  activo: boolean;
}

export const useCatalogos = () => {
  const [tiposRequisicion, setTiposRequisicion] = useState<TipoRequisicion[]>([]);
  const [unidadesNegocio, setUnidadesNegocio] = useState<UnidadNegocio[]>([]);
  const [empresas, setEmpresas] = useState<CatalogoSimple[]>([]);
  const [sucursales, setSucursales] = useState<CatalogoSimple[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCatalogos();
  }, []);

  // Refetch when window regains focus to get latest data
  useEffect(() => {
    const handleFocus = () => {
      fetchCatalogos();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const fetchCatalogos = async () => {
    try {
      const [tiposRes, unidadesRes, empresasRes, sucursalesRes] = await Promise.all([
        supabase
          .from("catalogo_tipos_requisicion")
          .select("id, nombre, color_class, color_hsl, activo")
          .eq("activo", true)
          .order("orden"),
        supabase
          .from("catalogo_unidades_negocio")
          .select("id, nombre, empresa_id, activo")
          .eq("activo", true)
          .order("orden"),
        supabase
          .from("catalogo_empresas")
          .select("id, nombre, activo")
          .eq("activo", true)
          .order("orden"),
        supabase
          .from("catalogo_sucursales")
          .select("id, nombre, activo")
          .eq("activo", true)
          .order("orden"),
      ]);

      if (tiposRes.data) setTiposRequisicion(tiposRes.data);
      if (unidadesRes.data) setUnidadesNegocio(unidadesRes.data);
      if (empresasRes.data) setEmpresas(empresasRes.data);
      if (sucursalesRes.data) setSucursales(sucursalesRes.data);
    } catch (error) {
      console.error("Error fetching catalogos:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTipoColor = (tipoId: string): string => {
    const tipo = tiposRequisicion.find(t => t.id === tipoId);
    return tipo?.color_hsl || "0 0% 50%";
  };

  const getTipoColorClass = (tipoId: string): string => {
    const tipo = tiposRequisicion.find(t => t.id === tipoId);
    return tipo?.color_class || "bg-muted";
  };

  const getTipoNombre = (tipoId: string): string => {
    const tipo = tiposRequisicion.find(t => t.id === tipoId);
    return tipo?.nombre || "";
  };

  // Get unidades de negocio filtered by empresa
  const getUnidadesByEmpresa = (empresaId: string): UnidadNegocio[] => {
    return unidadesNegocio.filter(u => u.empresa_id === empresaId);
  };

  return {
    tiposRequisicion,
    unidadesNegocio,
    empresas,
    sucursales,
    loading,
    getTipoColor,
    getTipoColorClass,
    getTipoNombre,
    getUnidadesByEmpresa,
    refetch: fetchCatalogos,
  };
};