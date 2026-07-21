/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { firestoreService } from "../lib/firebase";
import { Almacen, StockItem, Producto } from "../types";
import { 
  Warehouse, 
  Plus, 
  Edit2, 
  Trash2, 
  MapPin, 
  AlertTriangle, 
  Search, 
  X, 
  Check, 
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface GestionAlmacenesProps {
  productos: Producto[];
}

export default function GestionAlmacenes({ productos }: GestionAlmacenesProps) {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Selected or active items
  const [selectedAlmacen, setSelectedAlmacen] = useState<Almacen | null>(null);
  
  // Form fields
  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Real-time subscriptions
  useEffect(() => {
    setLoading(true);
    
    // Subscribe to warehouses
    const unsubscribeAlmacenes = firestoreService.getAlmacenesRealtime((data) => {
      setAlmacenes(data);
      setLoading(false);
    });

    // Subscribe to stock for validation
    const unsubscribeStock = firestoreService.getStockRealtime((data) => {
      setStockList(data);
    });

    return () => {
      unsubscribeAlmacenes();
      unsubscribeStock();
    };
  }, []);

  // Filtered warehouses
  const filteredAlmacenes = almacenes.filter(alm => {
    const query = searchQuery.toLowerCase();
    return (
      alm.nombre.toLowerCase().includes(query) ||
      alm.ubicacion.toLowerCase().includes(query)
    );
  });

  // Check if a warehouse has stock registered
  const getWarehouseStockStatus = (almacenId: string) => {
    const warehouseStock = stockList.filter(item => item.almacen_id === almacenId);
    const totalUnits = warehouseStock.reduce((acc, curr) => acc + curr.cantidad, 0);
    const uniqueItemsCount = warehouseStock.filter(item => item.cantidad > 0).length;
    
    return {
      hasStock: totalUnits > 0,
      totalUnits,
      uniqueItemsCount
    };
  };

  // Open Form modal (for Add or Edit)
  const openFormModal = (almacen: Almacen | null = null) => {
    setFormError(null);
    if (almacen) {
      setSelectedAlmacen(almacen);
      setNombre(almacen.nombre);
      setUbicacion(almacen.ubicacion);
    } else {
      setSelectedAlmacen(null);
      setNombre("");
      setUbicacion("");
    }
    setIsFormOpen(true);
  };

  // Open Delete confirmation modal
  const openDeleteModal = (almacen: Almacen) => {
    setSelectedAlmacen(almacen);
    setIsDeleteOpen(true);
  };

  // Handle Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !ubicacion.trim()) {
      setFormError("Todos los campos son obligatorios.");
      return;
    }

    setSubmitLoading(true);
    setFormError(null);

    try {
      if (selectedAlmacen) {
        // Edit mode
        await firestoreService.updateAlmacen(selectedAlmacen.id, {
          nombre: nombre.trim(),
          ubicacion: ubicacion.trim()
        });
      } else {
        // Add mode
        await firestoreService.addAlmacen({
          nombre: nombre.trim(),
          ubicacion: ubicacion.trim()
        });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      console.error("Error saving warehouse:", err);
      setFormError(err.message || "Ocurrió un error al guardar el almacén.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle Delete execution
  const handleDeleteSubmit = async () => {
    if (!selectedAlmacen) return;
    
    const { hasStock } = getWarehouseStockStatus(selectedAlmacen.id);
    if (hasStock) {
      alert("No se puede eliminar un almacén con stock registrado.");
      return;
    }

    setSubmitLoading(true);
    try {
      await firestoreService.deleteAlmacen(selectedAlmacen.id);
      setIsDeleteOpen(false);
    } catch (err: any) {
      console.error("Error deleting warehouse:", err);
      alert(err.message || "Error al eliminar el almacén.");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="gestion-almacenes-view">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Gestión de Almacenes</h1>
          <p className="text-sm text-slate-400 mt-1">
            Administra las sedes físicas, ubicaciones y puntos de distribución de la empresa.
          </p>
        </div>
        <div>
          <button
            onClick={() => openFormModal(null)}
            className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center space-x-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar almacén</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre o ubicación..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-slate-700 text-slate-200 text-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-700 transition-all placeholder:text-slate-600"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")} 
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Warehouse Listing */}
      {loading ? (
        <div className="py-24 text-center text-slate-400">
          <span className="h-8 w-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block mb-3" />
          <p className="text-sm font-medium">Cargando catálogo de almacenes...</p>
        </div>
      ) : filteredAlmacenes.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-850 rounded-2xl p-12 text-center">
          <div className="bg-slate-950 inline-flex p-4 rounded-full text-slate-600 mb-4">
            <Warehouse className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-1">No se encontraron almacenes</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {searchQuery ? "Prueba a cambiar los términos de búsqueda o agrega un nuevo almacén." : "Comienza agregando tu primer almacén físico para registrar stock."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Identificador</th>
                  <th className="py-4 px-6">Nombre de Almacén</th>
                  <th className="py-4 px-6">Ubicación</th>
                  <th className="py-4 px-6">Estado de Stock</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAlmacenes.map((alm) => {
                  const { hasStock, totalUnits, uniqueItemsCount } = getWarehouseStockStatus(alm.id);
                  return (
                    <tr key={alm.id} className="hover:bg-slate-850/35 transition-colors group">
                      <td className="py-4 px-6 font-mono text-xs text-slate-500 font-medium">
                        {alm.id}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="bg-slate-950 p-2 rounded-lg text-emerald-400 border border-slate-800">
                            <Warehouse className="h-4 w-4" />
                          </div>
                          <span className="font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors">
                            {alm.nombre}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-1.5 text-slate-300 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span>{alm.ubicacion}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {hasStock ? (
                          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/50 text-emerald-400 border border-emerald-900/40">
                            <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />
                            <span>{totalUnits} uds ({uniqueItemsCount} items)</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-950 text-slate-500 border border-slate-800/60">
                            <span className="h-1.5 w-1.5 bg-slate-700 rounded-full" />
                            <span>Sin Stock</span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openFormModal(alm)}
                            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-slate-700"
                            title="Editar Almacén"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(alm)}
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-slate-700"
                            title="Eliminar Almacén"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Grid/Card View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredAlmacenes.map((alm) => {
              const { hasStock, totalUnits, uniqueItemsCount } = getWarehouseStockStatus(alm.id);
              return (
                <div key={alm.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-950 p-2.5 rounded-xl text-emerald-400 border border-slate-850">
                        <Warehouse className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-200 text-base">{alm.nombre}</h4>
                        <span className="font-mono text-[10px] text-slate-500">{alm.id}</span>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => openFormModal(alm)}
                        className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(alm)}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 text-slate-300 text-sm">
                    <MapPin className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>{alm.ubicacion}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-500">Estado de inventario:</span>
                    {hasStock ? (
                      <span className="px-2.5 py-1 rounded-full font-semibold bg-emerald-950/50 text-emerald-400 border border-emerald-900/40">
                        {totalUnits} unidades de stock
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full font-semibold bg-slate-950 text-slate-500 border border-slate-800/60">
                        Vacio (0 uds)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ADD/EDIT MODAL DIALOG */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl overflow-hidden"
            >
              {/* Decorative border bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />

              {/* Close Button */}
              <button
                onClick={() => setIsFormOpen(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-6 flex items-center space-x-3">
                <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-400 border border-emerald-500/10">
                  <Warehouse className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">
                    {selectedAlmacen ? "Editar Almacén" : "Nuevo Almacén Físico"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ingresa los datos correspondientes para la sucursal de inventario.
                  </p>
                </div>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                {formError && (
                  <div className="bg-rose-950/40 border border-rose-800 text-rose-300 px-4 py-3 rounded-xl flex items-start space-x-2 text-xs">
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Nombre del Almacén <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Almacén Poniente"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-slate-700 text-slate-200 text-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-700 transition-all placeholder:text-slate-650"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Ubicación Física <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Barcelona, España"
                    value={ubicacion}
                    onChange={(e) => setUbicacion(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-slate-700 text-slate-200 text-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-700 transition-all placeholder:text-slate-650"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-250 font-semibold rounded-xl text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {submitLoading ? (
                      <span className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : null}
                    <span>{selectedAlmacen ? "Guardar cambios" : "Crear almacén"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {isDeleteOpen && selectedAlmacen && (() => {
          const { hasStock, totalUnits, uniqueItemsCount } = getWarehouseStockStatus(selectedAlmacen.id);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDeleteOpen(false)}
                className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
              />

              {/* Modal Body */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl overflow-hidden"
              >
                {/* Close Button */}
                <button
                  onClick={() => setIsDeleteOpen(false)}
                  className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="flex flex-col items-center text-center p-2">
                  <div className={`p-3.5 rounded-full mb-4 border ${hasStock ? "bg-amber-950/50 border-amber-800 text-amber-400" : "bg-rose-950/50 border-rose-800 text-rose-400"}`}>
                    <AlertTriangle className="h-8 w-8" />
                  </div>

                  <h3 className="text-lg font-bold text-slate-100">
                    {hasStock ? "No se puede eliminar el almacén" : "¿Eliminar almacén físico?"}
                  </h3>
                  
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                    {hasStock 
                      ? "Este almacén contiene stock registrado en el sistema. Para evitar la pérdida accidental de datos, primero debes transferir o retirar la mercadería existente de esta sede."
                      : `¿Estás seguro de que deseas eliminar el almacén "${selectedAlmacen.nombre}"? Esta acción no se puede deshacer.`}
                  </p>

                  {/* Stock Details Box if blocked */}
                  {hasStock && (
                    <div className="w-full mt-4 bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-left font-mono text-xs text-slate-400 space-y-1">
                      <p className="text-amber-400 font-semibold mb-1">Inventario activo detectado:</p>
                      <div className="flex justify-between">
                        <span>Items de catálogo:</span>
                        <span className="text-slate-200">{uniqueItemsCount} distintos</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unidades totales:</span>
                        <span className="text-slate-200">{totalUnits} unidades</span>
                      </div>
                    </div>
                  )}

                  <div className="w-full mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsDeleteOpen(false)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-250 font-semibold rounded-xl text-xs transition-colors"
                    >
                      {hasStock ? "Entendido" : "Cancelar"}
                    </button>
                    {!hasStock && (
                      <button
                        type="button"
                        onClick={handleDeleteSubmit}
                        disabled={submitLoading}
                        className="w-full sm:w-auto px-5 py-2.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
                      >
                        {submitLoading ? (
                          <span className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        ) : null}
                        <span>Eliminar Almacén</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
