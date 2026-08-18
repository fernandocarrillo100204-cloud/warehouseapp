/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { firestoreService } from "../lib/firebase";
import { Movimiento, Almacen, Producto } from "../types";
import { 
  History, 
  Search, 
  ArrowRightLeft, 
  TrendingUp, 
  TrendingDown, 
  SlidersHorizontal,
  FileSpreadsheet,
  Layers,
  User,
  Calendar,
  X,
  Trash2,
  AlertTriangle
} from "lucide-react";

interface HistorialProps {
  almacenes: Almacen[];
  productos: Producto[];
  preselectedSku?: string;
  onClearPreselectedSku?: () => void;
}

export default function Historial({ 
  almacenes, 
  productos, 
  preselectedSku = "", 
  onClearPreselectedSku 
}: HistorialProps) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [skuFilter, setSkuFilter] = useState(preselectedSku);
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [movToDelete, setMovToDelete] = useState<Movimiento | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync state with prop
  useEffect(() => {
    setSkuFilter(preselectedSku);
  }, [preselectedSku]);

  // Load movements list
  const loadMovimientos = async () => {
    setLoading(true);
    try {
      const data = await firestoreService.getMovimientos();
      setMovimientos(data);
    } catch (error) {
      console.error("Error loading movements history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!movToDelete) return;
    setIsDeleting(true);
    try {
      await firestoreService.deleteMovimiento(movToDelete.id);
      setMovimientos(prev => prev.filter(m => m.id !== movToDelete.id));
      setMovToDelete(null);
    } catch (error) {
      console.error("Error al eliminar movimiento:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    loadMovimientos();
  }, []);

  // Get product name from SKU
  const getProductName = (sku: string): string => {
    const prod = productos.find(p => p.sku.toLowerCase() === sku.toLowerCase());
    return prod ? prod.nombre : "Producto Nuevo/No Catalogado";
  };

  // Get warehouse name
  const getWarehouseName = (id: string): string => {
    const alm = almacenes.find(a => a.id === id);
    return alm ? alm.nombre : "Desconocido";
  };

  // Filters logic
  const filteredMovimientos = movimientos.filter(mov => {
    const query = skuFilter.trim().toLowerCase();
    const matchesSearch = !query || 
      mov.sku.toLowerCase().includes(query) ||
      (mov.folio && mov.folio.toLowerCase().includes(query)) ||
      (mov.referencia && mov.referencia.toLowerCase().includes(query));

    const matchesWarehouse = warehouseFilter === "all" || mov.almacen_id === warehouseFilter || mov.almacen_destino_id === warehouseFilter;
    const matchesTipo = tipoFilter === "all" || mov.tipo === tipoFilter;

    return matchesSearch && matchesWarehouse && matchesTipo;
  });

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-5 lg:px-6 py-5" id="historial-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-5 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#172033] tracking-tight leading-tight">
            Historial de Auditoría
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Registro auditable de transacciones, compras, ventas y transferencias entre almacenes.
          </p>
        </div>
        <div className="shrink-0">
          <button
            onClick={loadMovimientos}
            className="text-xs bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#172033] font-medium px-3 py-1.5 rounded-lg transition-colors inline-flex items-center space-x-1.5 shadow-xs"
            title="Refrescar registro de auditoría"
          >
            <History className="h-3.5 w-3.5 text-[#059669]" />
            <span>Refrescar Registro</span>
          </button>
        </div>
      </div>

      {/* Main filters bar */}
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 sm:p-4 mb-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 mb-3">
          <h3 className="text-xs font-semibold text-[#172033] uppercase tracking-wider flex items-center">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 text-[#64748B]" />
            Filtros de Auditoría
          </h3>
          {(skuFilter || warehouseFilter !== "all" || tipoFilter !== "all") && (
            <button
              onClick={() => {
                setSkuFilter("");
                setWarehouseFilter("all");
                setTipoFilter("all");
                if (onClearPreselectedSku) onClearPreselectedSku();
              }}
              className="text-xs text-rose-600 hover:text-rose-700 transition-colors flex items-center font-medium"
            >
              <X className="h-3 w-3 mr-1" />
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
          {/* SKU Filter */}
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-[#64748B]">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              placeholder="Buscar por Folio, SKU o referencia..."
              value={skuFilter}
              onChange={(e) => setSkuFilter(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] text-[#172033] rounded-lg py-1.5 pl-8 pr-8 text-xs sm:text-sm focus:outline-none focus:border-[#059669] transition-colors placeholder:text-slate-400"
            />
            {skuFilter && (
              <button
                onClick={() => {
                  setSkuFilter("");
                  if (onClearPreselectedSku) onClearPreselectedSku();
                }}
                className="absolute right-2.5 inset-y-0 flex items-center text-[#64748B] hover:text-[#172033]"
                title="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Warehouse Filter */}
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-[#64748B]">
              <History className="h-3.5 w-3.5" />
            </span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] text-[#172033] rounded-lg py-1.5 pl-8 pr-3 text-xs sm:text-sm focus:outline-none focus:border-[#059669] transition-colors"
            >
              <option value="all">Todos los almacenes</option>
              {almacenes.map(alm => (
                <option key={alm.id} value={alm.id}>
                  {alm.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Transaction Type Filter */}
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-[#64748B]">
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </span>
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] text-[#172033] rounded-lg py-1.5 pl-8 pr-3 text-xs sm:text-sm focus:outline-none focus:border-[#059669] transition-colors"
            >
              <option value="all">Todos los tipos de transacción</option>
              <option value="entrada">Entradas (Compras / Ingresos)</option>
              <option value="salida">Salidas (Ventas / Despachos)</option>
              <option value="transferencia">Transferencias Internas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-14 text-center text-[#64748B]">
            <span className="h-6 w-6 border-2 border-[#059669] border-t-transparent rounded-full animate-spin inline-block mb-2" />
            <p className="text-xs">Buscando registros...</p>
          </div>
        ) : filteredMovimientos.length === 0 ? (
          <div className="py-14 text-center text-[#64748B]">
            <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-[#172033]">Sin movimientos para mostrar</p>
            <p className="text-xs mt-0.5">No hay transacciones registradas que coincidan con estos filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="audit-log-table">
              <thead>
                <tr className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-semibold uppercase tracking-wider border-b border-[#E2E8F0]">
                  <th className="py-2.5 px-3">Folio</th>
                  <th className="py-2.5 px-3">Fecha / Hora</th>
                  <th className="py-2.5 px-3">SKU / Producto</th>
                  <th className="py-2.5 px-3">Almacén Origen</th>
                  <th className="py-2.5 px-3">Transacción</th>
                  <th className="py-2.5 px-3 text-center">Cantidad</th>
                  <th className="py-2.5 px-3">Referencia / Glosa</th>
                  <th className="py-2.5 px-3">Responsable</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-[#172033] text-xs sm:text-sm">
                {filteredMovimientos.map((mov) => {
                  const dateStr = mov.fecha instanceof Date 
                    ? mov.fecha.toLocaleString("es-ES", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      })
                    : "Fecha inválida";

                  let badgeColorClass = "";
                  let typeLabel = "";
                  let qtyPrefix = "";
                  let qtyColorClass = "";

                  switch (mov.tipo) {
                    case "entrada":
                      badgeColorClass = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                      typeLabel = "Entrada";
                      qtyPrefix = "+";
                      qtyColorClass = "text-[#059669] font-bold";
                      break;
                    case "salida":
                      badgeColorClass = "bg-rose-50 text-rose-700 border border-rose-200";
                      typeLabel = "Salida";
                      qtyPrefix = "-";
                      qtyColorClass = "text-rose-600 font-bold";
                      break;
                    case "transferencia":
                      badgeColorClass = "bg-sky-50 text-sky-700 border border-sky-200";
                      typeLabel = "Transferencia";
                      qtyPrefix = "⇆";
                      qtyColorClass = "text-sky-600 font-semibold";
                      break;
                  }

                  return (
                    <tr key={mov.id} className="hover:bg-[#F1F5F9] transition-colors">
                      {/* Folio */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#ECFDF5] border border-emerald-200 text-[#059669]">
                          {mov.folio || "—"}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-1.5 text-[#64748B] text-xs">
                          <Calendar className="h-3 w-3 text-[#64748B] shrink-0" />
                          <span className="font-medium whitespace-nowrap">{dateStr}</span>
                        </div>
                      </td>

                      {/* Product details */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#172033] leading-tight">
                          {getProductName(mov.sku)}
                        </div>
                        <div className="font-mono text-[11px] text-[#64748B] mt-0.5">
                          {mov.sku}
                        </div>
                      </td>

                      {/* Origin warehouse */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#172033] text-xs">
                          {getWarehouseName(mov.almacen_id)}
                        </div>
                        {mov.tipo === "transferencia" && mov.almacen_destino_id && (
                          <div className="text-[10px] text-[#059669] font-medium flex items-center mt-0.5">
                            <span>Destino: {getWarehouseName(mov.almacen_destino_id)}</span>
                          </div>
                        )}
                      </td>

                      {/* Movement Type */}
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeColorClass}`}>
                          {typeLabel}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className={`py-2.5 px-3 text-center font-mono ${qtyColorClass}`}>
                        {qtyPrefix} {mov.cantidad}
                      </td>

                      {/* Reference string */}
                      <td className="py-2.5 px-3 text-[#64748B] italic text-xs max-w-xs truncate" title={mov.referencia}>
                        {mov.referencia}
                      </td>

                      {/* Authorized by */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-1.5 text-xs text-[#64748B]">
                          <User className="h-3 w-3 text-[#64748B]" />
                          <span className="truncate max-w-[120px]" title={mov.usuario}>
                            {mov.usuario.split("@")[0]}
                          </span>
                        </div>
                      </td>

                      {/* Action Delete */}
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          id={`btn-delete-mov-${mov.id}`}
                          onClick={() => setMovToDelete(mov)}
                          title="Eliminar movimiento del historial"
                          className="p-1.5 text-[#64748B] hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors border border-transparent hover:border-rose-200 inline-flex items-center gap-1 text-[11px] font-medium"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Eliminar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-3 text-[11px] text-[#64748B] flex justify-between px-1">
        <p>Mostrando {filteredMovimientos.length} de {movimientos.length} transacciones registradas.</p>
        <p>Los movimientos pueden ser eliminados individualmente para correcciones de registro.</p>
      </div>

      {/* Confirmation Modal */}
      {movToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#172033]">¿Eliminar Movimiento?</h3>
                <p className="text-xs text-[#64748B]">Esta acción removerá el registro del historial.</p>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-2 text-xs text-[#172033]">
              {movToDelete.folio && (
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Folio:</span>
                  <span className="font-mono font-bold text-[#059669]">{movToDelete.folio}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#64748B]">Producto:</span>
                <span className="font-semibold text-[#172033]">{getProductName(movToDelete.sku)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">SKU:</span>
                <span className="font-mono text-[#64748B]">{movToDelete.sku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Tipo / Cantidad:</span>
                <span className="capitalize font-semibold text-[#172033]">{movToDelete.tipo} ({movToDelete.cantidad} uds)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Almacén:</span>
                <span>{getWarehouseName(movToDelete.almacen_id)}</span>
              </div>
              {movToDelete.referencia && (
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Referencia:</span>
                  <span className="italic text-[#64748B] truncate max-w-[200px]">{movToDelete.referencia}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMovToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-delete-mov"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors inline-flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Eliminar Registro</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
