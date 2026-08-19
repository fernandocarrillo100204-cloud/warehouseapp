/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
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
  Ban,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  ShieldCheck,
  ChevronDown
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
  const [estadoFilter, setEstadoFilter] = useState("all"); // "all" | "activo" | "anulado"
  
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDocCursor, setLastDocCursor] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  
  const [movToAnular, setMovToAnular] = useState<Movimiento | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [isAnulando, setIsAnulando] = useState(false);
  const [anularError, setAnularError] = useState<string | null>(null);
  const [anularSuccess, setAnularSuccess] = useState<string | null>(null);

  // Sync state with prop
  useEffect(() => {
    setSkuFilter(preselectedSku);
  }, [preselectedSku]);

  // Load first page of movements (50 items)
  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setAnularError(null);
    try {
      const res = await firestoreService.getMovimientosPaginated({
        pageSize: 50,
        skuFilter: skuFilter.trim() || undefined,
        warehouseFilter,
        tipoFilter,
        estadoFilter
      });
      setMovimientos(res.items);
      setLastDocCursor(res.lastDoc);
      setHasMore(res.hasMore);
    } catch (error) {
      console.error("Error al cargar historial de auditoría:", error);
    } finally {
      setLoading(false);
    }
  }, [skuFilter, warehouseFilter, tipoFilter, estadoFilter]);

  // Load next page of 50 items
  const loadNextPage = async () => {
    if (!hasMore || loadingMore || !lastDocCursor) return;
    setLoadingMore(true);
    try {
      const res = await firestoreService.getMovimientosPaginated({
        pageSize: 50,
        lastDoc: lastDocCursor,
        skuFilter: skuFilter.trim() || undefined,
        warehouseFilter,
        tipoFilter,
        estadoFilter
      });
      setMovimientos(prev => [...prev, ...res.items]);
      setLastDocCursor(res.lastDoc);
      setHasMore(res.hasMore);
    } catch (error) {
      console.error("Error al cargar más registros:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  // Execute Anulación
  const handleConfirmAnulacion = async () => {
    if (!movToAnular || !movToAnular.id) return;
    setIsAnulando(true);
    setAnularError(null);
    try {
      const reason = motivoAnulacion.trim() || "Anulación solicitada por el usuario";
      await firestoreService.anularMovimiento(movToAnular.id, reason);
      
      // Update local state without losing pagination position
      setMovimientos(prev => prev.map(m => {
        if (m.id === movToAnular.id) {
          return {
            ...m,
            estado: "anulado",
            anulado_at: new Date(),
            motivo_anulacion: reason
          };
        }
        return m;
      }));

      setAnularSuccess(`Movimiento ${movToAnular.folio || movToAnular.id} anulado correctamente. El stock ha sido revertido.`);
      setTimeout(() => setAnularSuccess(null), 5000);
      setMovToAnular(null);
      setMotivoAnulacion("");
    } catch (error: any) {
      console.error("Error al anular movimiento:", error);
      setAnularError(error.message || "No se pudo anular el movimiento. Verifica el stock disponible para reversión.");
    } finally {
      setIsAnulando(false);
    }
  };

  // Helper product name
  const getProductName = (sku: string): string => {
    const prod = productos.find(p => p.sku.toLowerCase() === sku.toLowerCase());
    return prod ? prod.nombre : "Producto Nuevo/No Catalogado";
  };

  // Helper warehouse name
  const getWarehouseName = (id: string): string => {
    const alm = almacenes.find(a => a.id === id);
    return alm ? alm.nombre : "Desconocido";
  };

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-5 lg:px-6 py-5" id="historial-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-5 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#172033] dark:text-[#F8FAFC] tracking-tight leading-tight">
            Historial de Auditoría
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Registro transaccional paginado. Anula movimientos con reversión atómica de stock y trazabilidad completa.
          </p>
        </div>
        <div className="shrink-0 flex items-center space-x-2">
          <button
            onClick={loadFirstPage}
            className="text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] hover:bg-[#F1F5F9] dark:hover:bg-[#182235] text-[#172033] dark:text-[#F8FAFC] font-medium px-3 py-1.5 rounded-lg transition-colors inline-flex items-center space-x-1.5 shadow-xs"
            title="Refrescar registro de auditoría"
          >
            <History className="h-3.5 w-3.5 text-[#059669] dark:text-emerald-400" />
            <span>Refrescar Registro</span>
          </button>
        </div>
      </div>

      {/* Success banner */}
      {anularSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{anularSuccess}</span>
          </div>
          <button onClick={() => setAnularSuccess(null)} className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-200">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main filters bar */}
      <div className="bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-xl p-3.5 sm:p-4 mb-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#263449] pb-2 mb-3">
          <h3 className="text-xs font-semibold text-[#172033] dark:text-[#F8FAFC] uppercase tracking-wider flex items-center">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 text-[#64748B] dark:text-[#94A3B8]" />
            Filtros de Auditoría
          </h3>
          {(skuFilter || warehouseFilter !== "all" || tipoFilter !== "all" || estadoFilter !== "all") && (
            <button
              onClick={() => {
                setSkuFilter("");
                setWarehouseFilter("all");
                setTipoFilter("all");
                setEstadoFilter("all");
                if (onClearPreselectedSku) onClearPreselectedSku();
              }}
              className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors flex items-center font-medium"
            >
              <X className="h-3 w-3 mr-1" />
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* SKU / Folio Filter */}
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-[#64748B] dark:text-[#94A3B8]">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              placeholder="Buscar por Folio, SKU o glosa..."
              value={skuFilter}
              onChange={(e) => setSkuFilter(e.target.value)}
              className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 pl-8 pr-8 text-xs sm:text-sm focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            {skuFilter && (
              <button
                onClick={() => {
                  setSkuFilter("");
                  if (onClearPreselectedSku) onClearPreselectedSku();
                }}
                className="absolute right-2.5 inset-y-0 flex items-center text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F8FAFC]"
                title="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Warehouse Filter */}
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-[#64748B] dark:text-[#94A3B8]">
              <History className="h-3.5 w-3.5" />
            </span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 pl-8 pr-3 text-xs sm:text-sm focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500 transition-colors"
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
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-[#64748B] dark:text-[#94A3B8]">
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </span>
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 pl-8 pr-3 text-xs sm:text-sm focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500 transition-colors"
            >
              <option value="all">Todos los tipos</option>
              <option value="entrada">Entradas (Ingresos / Compras)</option>
              <option value="salida">Salidas (Ventas / Despachos)</option>
              <option value="transferencia">Transferencias Internas</option>
            </select>
          </div>

          {/* Status Filter (Activos / Anulados) */}
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-[#64748B] dark:text-[#94A3B8]">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 pl-8 pr-3 text-xs sm:text-sm focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500 transition-colors"
            >
              <option value="all">Todos los estados</option>
              <option value="activo">Solo Activos (Válidos)</option>
              <option value="anulado">Solo Anulados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-14 text-center text-[#64748B] dark:text-[#94A3B8]">
            <Loader2 className="h-6 w-6 text-[#059669] dark:text-emerald-400 animate-spin mx-auto mb-2" />
            <p className="text-xs">Cargando transacciones de auditoría...</p>
          </div>
        ) : movimientos.length === 0 ? (
          <div className="py-14 text-center text-[#64748B] dark:text-[#94A3B8]">
            <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-[#172033] dark:text-[#F8FAFC]">Sin movimientos para mostrar</p>
            <p className="text-xs mt-0.5">No hay transacciones registradas que coincidan con estos filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="audit-log-table">
              <thead>
                <tr className="bg-[#F8FAFC] dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] text-[11px] font-semibold uppercase tracking-wider border-b border-[#E2E8F0] dark:border-[#263449]">
                  <th className="py-2.5 px-3">Folio</th>
                  <th className="py-2.5 px-3">Estado</th>
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
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#263449] text-[#172033] dark:text-[#F8FAFC] text-xs sm:text-sm">
                {movimientos.map((mov) => {
                  const isAnulado = mov.estado === "anulado";
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
                      badgeColorClass = isAnulado 
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700" 
                        : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800";
                      typeLabel = "Entrada";
                      qtyPrefix = "+";
                      qtyColorClass = isAnulado ? "text-slate-400 line-through" : "text-[#059669] dark:text-emerald-400 font-bold";
                      break;
                    case "salida":
                      badgeColorClass = isAnulado 
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700" 
                        : "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800";
                      typeLabel = "Salida";
                      qtyPrefix = "-";
                      qtyColorClass = isAnulado ? "text-slate-400 line-through" : "text-rose-600 dark:text-rose-400 font-bold";
                      break;
                    case "transferencia":
                      badgeColorClass = isAnulado 
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700" 
                        : "bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800";
                      typeLabel = "Transferencia";
                      qtyPrefix = "⇆";
                      qtyColorClass = isAnulado ? "text-slate-400 line-through" : "text-sky-600 dark:text-sky-400 font-semibold";
                      break;
                  }

                  return (
                    <tr 
                      key={mov.id} 
                      className={`transition-colors ${
                        isAnulado 
                          ? "bg-rose-50/20 dark:bg-rose-950/10 opacity-75 hover:opacity-100" 
                          : "hover:bg-[#F1F5F9] dark:hover:bg-[#182235]/60"
                      }`}
                    >
                      {/* Folio */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                          isAnulado
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 line-through"
                            : "bg-[#ECFDF5] dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-[#059669] dark:text-emerald-400"
                        }`}>
                          {mov.folio || "—"}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isAnulado ? (
                          <span 
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 gap-1"
                            title={mov.motivo_anulacion ? `Motivo: ${mov.motivo_anulacion}` : "Movimiento Anulado"}
                          >
                            <Ban className="h-3 w-3" />
                            <span>Anulado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Activo</span>
                          </span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-1.5 text-[#64748B] dark:text-[#94A3B8] text-xs">
                          <Calendar className="h-3 w-3 text-[#64748B] dark:text-[#94A3B8] shrink-0" />
                          <span className="font-medium whitespace-nowrap">{dateStr}</span>
                        </div>
                        {isAnulado && mov.anulado_at && (
                          <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 font-medium">
                            Anulado: {mov.anulado_at instanceof Date ? mov.anulado_at.toLocaleDateString("es-ES") : ""}
                          </div>
                        )}
                      </td>

                      {/* Product details */}
                      <td className="py-2.5 px-3">
                        <div className={`font-semibold text-[#172033] dark:text-[#F8FAFC] leading-tight ${isAnulado ? "line-through text-slate-400" : ""}`}>
                          {getProductName(mov.sku)}
                        </div>
                        <div className="font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                          {mov.sku}
                        </div>
                      </td>

                      {/* Origin warehouse */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#172033] dark:text-[#F8FAFC] text-xs">
                          {getWarehouseName(mov.almacen_id)}
                        </div>
                        {mov.tipo === "transferencia" && mov.almacen_destino_id && (
                          <div className="text-[10px] text-[#059669] dark:text-emerald-400 font-medium flex items-center mt-0.5">
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
                      <td className="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8] italic text-xs max-w-xs truncate" title={mov.referencia}>
                        {mov.referencia}
                        {isAnulado && mov.motivo_anulacion && (
                          <span className="block not-italic text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 truncate font-normal">
                            Motivo: {mov.motivo_anulacion}
                          </span>
                        )}
                      </td>

                      {/* Authorized by */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                          <User className="h-3 w-3 text-[#64748B] dark:text-[#94A3B8]" />
                          <span className="truncate max-w-[120px]" title={mov.usuario}>
                            {mov.usuario.split("@")[0]}
                          </span>
                        </div>
                      </td>

                      {/* Action Anular */}
                      <td className="py-2.5 px-3 text-right">
                        {isAnulado ? (
                          <span 
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-600 py-1 px-2 cursor-not-allowed select-none"
                            title="Este movimiento ya fue anulado y su stock revertido"
                          >
                            <Ban className="h-3.5 w-3.5 opacity-50" />
                            <span>Anulado</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            id={`btn-anular-mov-${mov.id}`}
                            onClick={() => {
                              setMovToAnular(mov);
                              setMotivoAnulacion("");
                              setAnularError(null);
                            }}
                            title="Anular movimiento y revertir stock atómicamente"
                            className="p-1.5 text-[#64748B] dark:text-[#94A3B8] hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-md transition-colors border border-transparent hover:border-amber-200 dark:hover:border-amber-800/80 inline-flex items-center gap-1 text-[11px] font-medium"
                          >
                            <Ban className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            <span className="hidden sm:inline">Anular</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-3.5 border-t border-[#E2E8F0] dark:border-[#263449] bg-[#F8FAFC] dark:bg-[#0F172A] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
          <div>
            Mostrando <span className="font-semibold text-[#172033] dark:text-[#F8FAFC]">{movimientos.length}</span> registros de auditoría.
          </div>
          {hasMore && (
            <button
              onClick={loadNextPage}
              disabled={loadingMore}
              className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] hover:bg-[#F1F5F9] dark:hover:bg-[#182235] text-[#172033] dark:text-[#F8FAFC] font-semibold px-4 py-1.5 rounded-lg transition-colors inline-flex items-center space-x-2 shadow-xs disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#059669] dark:text-emerald-400" />
                  <span>Cargando siguientes 50...</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5 text-[#64748B] dark:text-[#94A3B8]" />
                  <span>Cargar más registros (50 siguientes)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 text-[11px] text-[#64748B] dark:text-[#94A3B8] flex justify-between px-1">
        <p>Los movimientos anulados no cuentan en stock, ventas ni estadísticas comerciales.</p>
        <p>Trazabilidad garantizada con registro inmutable de auditoría.</p>
      </div>

      {/* Modal de Anulación */}
      {movToAnular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-600 dark:text-amber-400">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#172033] dark:text-[#F8FAFC]">¿Anular Movimiento?</h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Esta acción revertirá atómicamente el stock afectado.</p>
              </div>
            </div>

            {anularError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
                {anularError}
              </div>
            )}

            <div className="bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] rounded-xl p-3.5 space-y-2 text-xs text-[#172033] dark:text-[#F8FAFC]">
              {movToAnular.folio && (
                <div className="flex justify-between">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Folio:</span>
                  <span className="font-mono font-bold text-[#059669] dark:text-emerald-400">{movToAnular.folio}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#64748B] dark:text-[#94A3B8]">Producto:</span>
                <span className="font-semibold text-[#172033] dark:text-[#F8FAFC]">{getProductName(movToAnular.sku)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] dark:text-[#94A3B8]">SKU:</span>
                <span className="font-mono text-[#64748B] dark:text-[#94A3B8]">{movToAnular.sku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] dark:text-[#94A3B8]">Tipo / Cantidad:</span>
                <span className="capitalize font-semibold text-[#172033] dark:text-[#F8FAFC]">{movToAnular.tipo} ({movToAnular.cantidad} uds)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] dark:text-[#94A3B8]">Almacén Origen:</span>
                <span>{getWarehouseName(movToAnular.almacen_id)}</span>
              </div>
              {movToAnular.tipo === "transferencia" && movToAnular.almacen_destino_id && (
                <div className="flex justify-between">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Almacén Destino:</span>
                  <span>{getWarehouseName(movToAnular.almacen_destino_id)}</span>
                </div>
              )}
              
              <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#263449] text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                <p className="font-semibold text-[#172033] dark:text-[#F8FAFC] mb-0.5">Efecto de la reversión:</p>
                {movToAnular.tipo === "entrada" && (
                  <p>Se restarán <strong className="text-rose-600">{movToAnular.cantidad} uds</strong> del inventario de {getWarehouseName(movToAnular.almacen_id)}.</p>
                )}
                {movToAnular.tipo === "salida" && (
                  <p>Se reincorporarán <strong className="text-emerald-600">+{movToAnular.cantidad} uds</strong> al inventario de {getWarehouseName(movToAnular.almacen_id)}.</p>
                )}
                {movToAnular.tipo === "transferencia" && movToAnular.almacen_destino_id && (
                  <p>Se devolverán <strong className="text-emerald-600">+{movToAnular.cantidad} uds</strong> a {getWarehouseName(movToAnular.almacen_id)} y se restarán de {getWarehouseName(movToAnular.almacen_destino_id)}.</p>
                )}
              </div>
            </div>

            {/* Motivo Input */}
            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-[#F8FAFC] mb-1">
                Motivo de la anulación (opcional):
              </label>
              <input
                type="text"
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                placeholder="Ej. Error de captura, cancelación de pedido..."
                className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500 transition-colors placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMovToAnular(null);
                  setAnularError(null);
                }}
                disabled={isAnulando}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#182235] border border-[#E2E8F0] dark:border-[#263449] rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-anular-mov"
                onClick={handleConfirmAnulacion}
                disabled={isAnulando}
                className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors inline-flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
              >
                {isAnulando ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Anulando...</span>
                  </>
                ) : (
                  <>
                    <Ban className="h-3.5 w-3.5" />
                    <span>Confirmar Anulación</span>
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
