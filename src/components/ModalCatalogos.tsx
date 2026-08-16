/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { firestoreService } from "../lib/firebase";
import { CategoriaCatalogo, UnidadMedidaCatalogo, Producto } from "../types";
import { 
  X, 
  Tag, 
  Scale, 
  Plus, 
  Edit3, 
  Check, 
  Power, 
  AlertCircle, 
  Search, 
  Package, 
  FolderTree,
  CheckCircle2,
  RefreshCw,
  Info,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ModalCatalogosProps {
  isOpen: boolean;
  onClose: () => void;
  productos: Producto[];
}

export default function ModalCatalogos({
  isOpen,
  onClose,
  productos
}: ModalCatalogosProps) {
  const [activeTab, setActiveTab] = useState<"categorias" | "unidades">("categorias");

  // Catalogs data
  const [categorias, setCategorias] = useState<CategoriaCatalogo[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedidaCatalogo[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | "activas" | "desactivadas">("todos");

  // Form states for Category
  const [newCatNombre, setNewCatNombre] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatNombre, setEditingCatNombre] = useState("");

  // Form states for Unit
  const [newUnitNombre, setNewUnitNombre] = useState("");
  const [newUnitAbrev, setNewUnitAbrev] = useState("");
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitNombre, setEditingUnitNombre] = useState("");
  const [editingUnitAbrev, setEditingUnitAbrev] = useState("");

  // Global action feedback
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Delete confirmation modal state
  const [itemToDelete, setItemToDelete] = useState<{
    type: "categoria" | "unidad";
    id: string;
    nombre: string;
    extra?: string;
  } | null>(null);

  // Subscribe to realtime catalogs data
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Initial ensure / seed
    firestoreService.seedAndImportCatalogos();

    const unsubCats = firestoreService.getCategoriasRealtime((cats) => {
      setCategorias(cats);
      setLoading(false);
    });

    const unsubUnits = firestoreService.getUnidadesRealtime((units) => {
      setUnidades(units);
    });

    return () => {
      unsubCats();
      unsubUnits();
    };
  }, [isOpen]);

  // Clear messages on tab change
  const handleTabChange = (tab: "categorias" | "unidades") => {
    setActiveTab(tab);
    setErrorMsg(null);
    setSuccessMsg(null);
    setSearchQuery("");
    setFilterStatus("todos");
    setEditingCatId(null);
    setEditingUnitId(null);
  };

  // Helper to count how many products use a given category
  const getProductCountForCategory = (catNombre: string): number => {
    const clean = catNombre.trim().toLowerCase();
    return productos.filter(p => (p.categoria || "").trim().toLowerCase() === clean).length;
  };

  // Helper to count how many products use a given unit
  const getProductCountForUnit = (unit: UnidadMedidaCatalogo): number => {
    const cleanAbrev = unit.abreviatura.trim().toLowerCase();
    const cleanNom = unit.nombre.trim().toLowerCase();

    return productos.filter(p => {
      const prodUnit = (p.unidad || "").trim().toLowerCase();
      if (prodUnit === cleanAbrev || prodUnit === cleanNom) return true;
      // Also match common unit variants
      if (cleanAbrev === "uds" && ["ud", "unidad", "unidades", "uds"].includes(prodUnit)) return true;
      if (cleanAbrev === "pza" && ["pieza", "piezas", "pza", "pzas"].includes(prodUnit)) return true;
      if (cleanAbrev === "cja" && ["caja", "cajas", "cja", "cjas"].includes(prodUnit)) return true;
      if (cleanAbrev === "paq" && ["paquete", "paquetes", "paq", "paqs"].includes(prodUnit)) return true;
      if (cleanAbrev === "kg" && ["kilogramo", "kilogramos", "kg", "kilo", "kilos"].includes(prodUnit)) return true;
      if (cleanAbrev === "l" && ["litro", "litros", "l", "lt", "lts"].includes(prodUnit)) return true;
      if (cleanAbrev === "m" && ["metro", "metros", "m", "mts"].includes(prodUnit)) return true;
      if (cleanAbrev === "rll" && ["rollo", "rollos", "rll"].includes(prodUnit)) return true;
      return false;
    }).length;
  };

  // Filtered categories
  const filteredCategorias = useMemo(() => {
    return categorias.filter(c => {
      const matchSearch = c.nombre.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchStatus = 
        filterStatus === "todos" ? true :
        filterStatus === "activas" ? c.activa :
        !c.activa;
      return matchSearch && matchStatus;
    });
  }, [categorias, searchQuery, filterStatus]);

  // Filtered units
  const filteredUnidades = useMemo(() => {
    return unidades.filter(u => {
      const term = searchQuery.toLowerCase().trim();
      const matchSearch = u.nombre.toLowerCase().includes(term) || u.abreviatura.toLowerCase().includes(term);
      const matchStatus = 
        filterStatus === "todos" ? true :
        filterStatus === "activas" ? u.activa :
        !u.activa;
      return matchSearch && matchStatus;
    });
  }, [unidades, searchQuery, filterStatus]);

  // Auto-dismiss success message
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // ----------------------------------------------------
  // CATEGORIES ACTIONS
  // ----------------------------------------------------
  const handleAddCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCatNombre.trim();
    if (!clean) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      await firestoreService.addCategoria(clean);
      setNewCatNombre("");
      setSuccessMsg(`Categoría "${clean}" agregada exitosamente al catálogo.`);
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al agregar categoría.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartEditCat = (cat: CategoriaCatalogo) => {
    setEditingCatId(cat.id);
    setEditingCatNombre(cat.nombre);
    setErrorMsg(null);
  };

  const handleSaveEditCat = async (cat: CategoriaCatalogo) => {
    const cleanNew = editingCatNombre.trim();
    if (!cleanNew) {
      setErrorMsg("El nombre no puede estar vacío.");
      return;
    }
    if (cleanNew === cat.nombre) {
      setEditingCatId(null);
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const affectedCount = getProductCountForCategory(cat.nombre);
      await firestoreService.renameCategoriaAndSyncProducts(cat.id, cat.nombre, cleanNew);
      setEditingCatId(null);
      setSuccessMsg(
        affectedCount > 0
          ? `Categoría renombrada a "${cleanNew}" y ${affectedCount} producto(s) actualizado(s) de forma segura.`
          : `Categoría renombrada a "${cleanNew}".`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al renombrar categoría.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleCatStatus = async (cat: CategoriaCatalogo) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    const newStatus = !cat.activa;
    try {
      await firestoreService.toggleCategoriaStatus(cat.id, newStatus);
      setSuccessMsg(
        newStatus 
          ? `Categoría "${cat.nombre}" activada.`
          : `Categoría "${cat.nombre}" desactivada. No aparecerá en productos nuevos pero se conserva en los existentes.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al cambiar estado de la categoría.");
    } finally {
      setActionLoading(false);
    }
  };

  // ----------------------------------------------------
  // UNITS ACTIONS
  // ----------------------------------------------------
  const handleAddUnidad = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNom = newUnitNombre.trim();
    const cleanAbrev = newUnitAbrev.trim().toLowerCase();

    if (!cleanNom || !cleanAbrev) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      await firestoreService.addUnidad(cleanNom, cleanAbrev);
      setNewUnitNombre("");
      setNewUnitAbrev("");
      setSuccessMsg(`Unidad "${cleanNom} (${cleanAbrev})" agregada exitosamente.`);
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al agregar unidad de medida.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartEditUnit = (unit: UnidadMedidaCatalogo) => {
    setEditingUnitId(unit.id);
    setEditingUnitNombre(unit.nombre);
    setEditingUnitAbrev(unit.abreviatura);
    setErrorMsg(null);
  };

  const handleSaveEditUnit = async (unit: UnidadMedidaCatalogo) => {
    const cleanNewNom = editingUnitNombre.trim();
    const cleanNewAbrev = editingUnitAbrev.trim().toLowerCase();

    if (!cleanNewNom) {
      setErrorMsg("El nombre de la unidad no puede estar vacío.");
      return;
    }
    if (!cleanNewAbrev) {
      setErrorMsg("La abreviatura no puede estar vacía.");
      return;
    }

    if (cleanNewNom === unit.nombre && cleanNewAbrev === unit.abreviatura) {
      setEditingUnitId(null);
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const affectedCount = getProductCountForUnit(unit);
      await firestoreService.renameUnidadAndSyncProducts(unit.id, unit.abreviatura, cleanNewAbrev, cleanNewNom);
      setEditingUnitId(null);
      setSuccessMsg(
        affectedCount > 0
          ? `Unidad actualizada a "${cleanNewNom} (${cleanNewAbrev})" y ${affectedCount} producto(s) actualizado(s) de forma segura.`
          : `Unidad actualizada a "${cleanNewNom} (${cleanNewAbrev})".`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al actualizar unidad de medida.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleUnitStatus = async (unit: UnidadMedidaCatalogo) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    const newStatus = !unit.activa;
    try {
      await firestoreService.toggleUnidadStatus(unit.id, newStatus);
      setSuccessMsg(
        newStatus 
          ? `Unidad "${unit.nombre} (${unit.abreviatura})" activada.`
          : `Unidad "${unit.nombre} (${unit.abreviatura})" desactivada. No aparecerá en productos nuevos pero se conserva en los existentes.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al cambiar estado de la unidad de medida.");
    } finally {
      setActionLoading(false);
    }
  };

  // ----------------------------------------------------
  // DELETE ACTIONS
  // ----------------------------------------------------
  const handleConfirmDelete = async () => {
    if (!itemToDelete || actionLoading) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      if (itemToDelete.type === "categoria") {
        const count = getProductCountForCategory(itemToDelete.nombre);
        if (count > 0) {
          throw new Error(`No se puede eliminar la categoría porque tiene ${count} producto(s) asignado(s).`);
        }
        await firestoreService.deleteCategoria(itemToDelete.id);
        setSuccessMsg(`Categoría "${itemToDelete.nombre}" eliminada definitivamente del catálogo.`);
      } else {
        const unit = unidades.find(u => u.id === itemToDelete.id);
        if (unit) {
          const count = getProductCountForUnit(unit);
          if (count > 0) {
            throw new Error(`No se puede eliminar la unidad porque tiene ${count} producto(s) asignado(s).`);
          }
        }
        await firestoreService.deleteUnidad(itemToDelete.id);
        setSuccessMsg(`Unidad de medida "${itemToDelete.nombre}" eliminada definitivamente.`);
      }
      setItemToDelete(null);
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al eliminar el registro.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        id="modal-administrar-catalogos-overlay"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 8 }}
          className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          id="modal-administrar-catalogos-container"
        >
          {/* Top Decorative Line */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

          {/* Close button */}
          <button
            onClick={onClose}
            disabled={actionLoading}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-all disabled:opacity-40 z-20"
            title="Cerrar ventana"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Modal Header */}
          <div className="p-6 pb-4 border-b border-slate-800/90 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-400 border border-emerald-500/20">
                <FolderTree className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100 tracking-tight">Administrar Catálogos</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gestiona las categorías y unidades de medida maestras utilizadas en el catálogo de productos.
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center space-x-2 mt-5 border-b border-slate-800/60 pb-1">
              <button
                type="button"
                onClick={() => handleTabChange("categorias")}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "categorias"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Tag className="h-4 w-4" />
                <span>Categorías</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === "categorias" ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"
                }`}>
                  {categorias.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("unidades")}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "unidades"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Scale className="h-4 w-4" />
                <span>Unidades de Medida</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === "unidades" ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"
                }`}>
                  {unidades.length}
                </span>
              </button>
            </div>
          </div>

          {/* Feedback alerts */}
          <div className="px-6 pt-3 space-y-2 shrink-0">
            {errorMsg && (
              <div className="bg-rose-950/40 border border-rose-800 text-rose-300 px-4 py-2.5 rounded-xl flex items-start space-x-2 text-xs">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="flex-1">{errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-300 px-4 py-2.5 rounded-xl flex items-start space-x-2 text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="flex-1">{successMsg}</span>
                <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Tab 1: CATEGORÍAS */}
          {activeTab === "categorias" && (
            <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
              {/* Add category form */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Plus className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Crear nueva categoría</span>
                </h3>
                <form onSubmit={handleAddCategoria} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    disabled={actionLoading}
                    placeholder="Ej. Inyección de Plástico, Herrajes, Químicos..."
                    value={newCatNombre}
                    onChange={(e) => setNewCatNombre(e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500/70 text-slate-200 text-sm rounded-xl focus:outline-none placeholder:text-slate-600 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!newCatNombre.trim() || actionLoading}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Agregar categoría</span>
                  </button>
                </form>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 max-w-xs">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filtrar categorías..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFilterStatus("todos")}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                      filterStatus === "todos" ? "bg-slate-800 text-slate-200" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Todas ({categorias.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("activas")}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                      filterStatus === "activas" ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Activas ({categorias.filter(c => c.activa).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("desactivadas")}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                      filterStatus === "desactivadas" ? "bg-slate-800 text-slate-300" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Desactivadas ({categorias.filter(c => !c.activa).length})
                  </button>
                </div>
              </div>

              {/* Categories list */}
              <div className="space-y-2">
                {filteredCategorias.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/60 border border-slate-800/60 rounded-xl text-xs text-slate-500">
                    {searchQuery ? "No se encontraron categorías con ese término." : "No hay categorías en este estado."}
                  </div>
                ) : (
                  filteredCategorias.map((cat) => {
                    const usageCount = getProductCountForCategory(cat.nombre);
                    const isEditing = editingCatId === cat.id;

                    return (
                      <div
                        key={cat.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          cat.activa 
                            ? "bg-slate-950/80 border-slate-800/90 hover:border-slate-700" 
                            : "bg-slate-950/40 border-slate-800/40 opacity-70"
                        }`}
                      >
                        {/* Left Info / Edit mode */}
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editingCatNombre}
                                onChange={(e) => setEditingCatNombre(e.target.value)}
                                autoFocus
                                className="px-3 py-1.5 bg-slate-900 border border-emerald-500 text-slate-200 text-sm rounded-lg focus:outline-none w-full max-w-sm"
                                placeholder="Nuevo nombre de la categoría"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditCat(cat)}
                                disabled={actionLoading || !editingCatNombre.trim()}
                                className="p-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-semibold flex items-center space-x-1"
                                title="Guardar cambios"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCatId(null)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                                title="Cancelar"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-200 text-sm">{cat.nombre}</span>
                              
                              {/* Status badge */}
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                cat.activa 
                                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-400" 
                                  : "bg-slate-900 border-slate-800 text-slate-500"
                              }`}>
                                {cat.activa ? "Activa" : "Desactivada"}
                              </span>

                              {/* Usage count badge */}
                              <span className="text-[10px] text-slate-400 bg-slate-900/90 border border-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Package className="h-3 w-3 text-slate-500" />
                                <span>{usageCount} {usageCount === 1 ? "producto" : "productos"}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Right Actions */}
                        {!isEditing && (
                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditCat(cat)}
                              disabled={actionLoading}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 rounded-lg text-xs flex items-center space-x-1.5 transition-all"
                              title="Renombrar categoría"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-slate-400" />
                              <span>Renombrar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleCatStatus(cat)}
                              disabled={actionLoading}
                              className={`px-2.5 py-1.5 border rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                                cat.activa
                                  ? "bg-slate-900 hover:bg-amber-950/30 border-slate-800 hover:border-amber-800/60 text-slate-400 hover:text-amber-300"
                                  : "bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800/80 text-emerald-300"
                              }`}
                              title={cat.activa ? "Desactivar de nuevos productos" : "Activar categoría"}
                            >
                              <Power className="h-3.5 w-3.5" />
                              <span>{cat.activa ? "Desactivar" : "Activar"}</span>
                            </button>

                            {/* Delete button with 0 products check */}
                            {usageCount === 0 ? (
                              <button
                                type="button"
                                onClick={() => setItemToDelete({ type: "categoria", id: cat.id, nombre: cat.nombre })}
                                disabled={actionLoading}
                                className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-600 border border-rose-900/70 hover:border-rose-500 text-rose-300 hover:text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all shadow-sm disabled:opacity-50"
                                title="Eliminar permanentemente del catálogo"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Eliminar</span>
                              </button>
                            ) : (
                              <div className="relative group">
                                <button
                                  type="button"
                                  disabled={true}
                                  className="px-2.5 py-1.5 bg-slate-900/50 border border-slate-800/80 text-slate-600 rounded-lg text-xs font-medium flex items-center space-x-1.5 cursor-not-allowed opacity-60"
                                  title="No se puede eliminar porque está asignado a productos"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-slate-600" />
                                  <span>Eliminar</span>
                                </button>
                                <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-30 pointer-events-none w-48 p-1.5 bg-slate-950 text-slate-300 text-[10px] leading-tight rounded-md border border-slate-700 shadow-xl text-center">
                                  No se puede eliminar porque está asignado a productos
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab 2: UNIDADES DE MEDIDA */}
          {activeTab === "unidades" && (
            <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
              {/* Add unit form */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Plus className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Registrar nueva unidad de medida</span>
                </h3>
                <form onSubmit={handleAddUnidad} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      required
                      disabled={actionLoading}
                      placeholder="Nombre (ej. Gramo, Par, Millares)"
                      value={newUnitNombre}
                      onChange={(e) => setNewUnitNombre(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500/70 text-slate-200 text-sm rounded-xl focus:outline-none placeholder:text-slate-600 transition-all"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      required
                      disabled={actionLoading}
                      placeholder="Abrev. (ej. g, par, mil)"
                      value={newUnitAbrev}
                      onChange={(e) => setNewUnitAbrev(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500/70 text-slate-200 text-sm rounded-xl focus:outline-none placeholder:text-slate-600 font-mono transition-all lowercase"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={!newUnitNombre.trim() || !newUnitAbrev.trim() || actionLoading}
                      className="w-full h-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold px-3 py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Agregar unidad</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 max-w-xs">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filtrar por nombre o abreviatura..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFilterStatus("todos")}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                      filterStatus === "todos" ? "bg-slate-800 text-slate-200" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Todas ({unidades.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("activas")}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                      filterStatus === "activas" ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Activas ({unidades.filter(u => u.activa).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("desactivadas")}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                      filterStatus === "desactivadas" ? "bg-slate-800 text-slate-300" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Desactivadas ({unidades.filter(u => !u.activa).length})
                  </button>
                </div>
              </div>

              {/* Units list */}
              <div className="space-y-2">
                {filteredUnidades.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/60 border border-slate-800/60 rounded-xl text-xs text-slate-500">
                    {searchQuery ? "No se encontraron unidades con ese término." : "No hay unidades en este estado."}
                  </div>
                ) : (
                  filteredUnidades.map((unit) => {
                    const usageCount = getProductCountForUnit(unit);
                    const isEditing = editingUnitId === unit.id;

                    return (
                      <div
                        key={unit.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          unit.activa 
                            ? "bg-slate-950/80 border-slate-800/90 hover:border-slate-700" 
                            : "bg-slate-950/40 border-slate-800/40 opacity-70"
                        }`}
                      >
                        {/* Left Info / Edit mode */}
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                              <div className="sm:col-span-6">
                                <input
                                  type="text"
                                  value={editingUnitNombre}
                                  onChange={(e) => setEditingUnitNombre(e.target.value)}
                                  autoFocus
                                  className="w-full px-3 py-1.5 bg-slate-900 border border-emerald-500 text-slate-200 text-xs rounded-lg focus:outline-none"
                                  placeholder="Nombre de la unidad"
                                />
                              </div>
                              <div className="sm:col-span-3">
                                <input
                                  type="text"
                                  value={editingUnitAbrev}
                                  onChange={(e) => setEditingUnitAbrev(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-slate-900 border border-emerald-500 text-slate-200 text-xs rounded-lg focus:outline-none font-mono lowercase"
                                  placeholder="Abrev."
                                />
                              </div>
                              <div className="sm:col-span-3 flex items-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditUnit(unit)}
                                  disabled={actionLoading || !editingUnitNombre.trim() || !editingUnitAbrev.trim()}
                                  className="p-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-semibold flex items-center space-x-1"
                                  title="Guardar cambios"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingUnitId(null)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                                  title="Cancelar"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-200 text-sm">{unit.nombre}</span>
                              
                              {/* Abbreviation badge */}
                              <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-2 py-0.5 rounded-lg">
                                {unit.abreviatura}
                              </span>

                              {/* Status badge */}
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                unit.activa 
                                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-400" 
                                  : "bg-slate-900 border-slate-800 text-slate-500"
                              }`}>
                                {unit.activa ? "Activa" : "Desactivada"}
                              </span>

                              {/* Usage count badge */}
                              <span className="text-[10px] text-slate-400 bg-slate-900/90 border border-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Package className="h-3 w-3 text-slate-500" />
                                <span>{usageCount} {usageCount === 1 ? "producto" : "productos"}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Right Actions */}
                        {!isEditing && (
                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditUnit(unit)}
                              disabled={actionLoading}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 rounded-lg text-xs flex items-center space-x-1.5 transition-all"
                              title="Editar nombre y abreviatura"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-slate-400" />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleUnitStatus(unit)}
                              disabled={actionLoading}
                              className={`px-2.5 py-1.5 border rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                                unit.activa
                                  ? "bg-slate-900 hover:bg-amber-950/30 border-slate-800 hover:border-amber-800/60 text-slate-400 hover:text-amber-300"
                                  : "bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800/80 text-emerald-300"
                              }`}
                              title={unit.activa ? "Desactivar de nuevos productos" : "Activar unidad"}
                            >
                              <Power className="h-3.5 w-3.5" />
                              <span>{unit.activa ? "Desactivar" : "Activar"}</span>
                            </button>

                            {/* Delete button with 0 products check */}
                            {usageCount === 0 ? (
                              <button
                                type="button"
                                onClick={() => setItemToDelete({ type: "unidad", id: unit.id, nombre: `${unit.nombre} (${unit.abreviatura})` })}
                                disabled={actionLoading}
                                className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-600 border border-rose-900/70 hover:border-rose-500 text-rose-300 hover:text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all shadow-sm disabled:opacity-50"
                                title="Eliminar permanentemente del catálogo"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Eliminar</span>
                              </button>
                            ) : (
                              <div className="relative group">
                                <button
                                  type="button"
                                  disabled={true}
                                  className="px-2.5 py-1.5 bg-slate-900/50 border border-slate-800/80 text-slate-600 rounded-lg text-xs font-medium flex items-center space-x-1.5 cursor-not-allowed opacity-60"
                                  title="No se puede eliminar porque está asignado a productos"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-slate-600" />
                                  <span>Eliminar</span>
                                </button>
                                <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-30 pointer-events-none w-48 p-1.5 bg-slate-950 text-slate-300 text-[10px] leading-tight rounded-md border border-slate-700 shadow-xl text-center">
                                  No se puede eliminar porque está asignado a productos
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Modal Footer (Fixed at bottom) */}
          <div className="p-4 px-6 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
              <Info className="h-3.5 w-3.5 text-slate-400" />
              <span>Opciones en uso solo pueden desactivarse para preservar la integridad del historial.</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
            >
              Cerrar
            </button>
          </div>
        </motion.div>

        {/* Confirmation Modal for Permanent Delete */}
        <AnimatePresence>
          {itemToDelete && (
            <div 
              className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
              id="confirm-delete-catalog-overlay"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="relative w-full max-w-md bg-slate-900 border border-rose-900/60 rounded-2xl p-6 shadow-2xl overflow-hidden"
                id="confirm-delete-catalog-container"
              >
                {/* Accent top line */}
                <div className="absolute top-0 inset-x-0 h-1 bg-rose-600" />

                <div className="flex items-start space-x-3.5">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 shrink-0">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">
                      ¿Eliminar {itemToDelete.type === "categoria" ? "categoría" : "unidad de medida"}?
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Estás por eliminar <span className="font-semibold text-rose-300">"{itemToDelete.nombre}"</span> de forma definitiva.
                    </p>
                  </div>
                </div>

                <div className="my-4 p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs space-y-2 text-slate-300">
                  <div className="flex items-center space-x-2 text-emerald-400 font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>0 productos asignados actualmente</span>
                  </div>
                  <div className="flex items-start space-x-2 text-rose-300 text-[11px] leading-tight">
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>
                      Esta acción es <strong>irreversible</strong> y se eliminará permanentemente de la base de datos.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setItemToDelete(null)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-2 transition-all shadow-lg shadow-rose-950/50 disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Eliminando...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Sí, eliminar definitivamente</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
