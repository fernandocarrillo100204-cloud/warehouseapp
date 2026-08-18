/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { firestoreService } from "../lib/firebase";
import { Almacen, Producto, StockItem } from "../types";
import { 
  Search, 
  Warehouse, 
  AlertTriangle, 
  CheckCircle, 
  Layers, 
  TrendingDown, 
  Filter, 
  ArrowRightLeft,
  Plus,
  ShieldCheck,
  RefreshCw,
  Tag,
  Building2,
  AlertCircle,
  HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DashboardProps {
  almacenes: Almacen[];
  productos: Producto[];
  onNavigateToMovements: (sku?: string) => void;
  onNavigateToHistory: (sku?: string) => void;
}

export default function Dashboard({ 
  almacenes, 
  productos, 
  onNavigateToMovements, 
  onNavigateToHistory 
}: DashboardProps) {
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedAlmacen, setSelectedAlmacen] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("all"); // 'all' | 'low' | 'out' | 'ok'
  const [loading, setLoading] = useState(true);
  const [syncingAudit, setSyncingAudit] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [showConfirmSync, setShowConfirmSync] = useState(false);

  // Load real-time stock
  useEffect(() => {
    setLoading(true);
    const unsubscribe = firestoreService.getStockRealtime((data) => {
      setStockList(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSyncAuditoria = async () => {
    setShowConfirmSync(false);
    setSyncingAudit(true);
    setSyncMessage(null);
    try {
      await firestoreService.recalculateAndSyncStock();
      setSyncMessage("¡Stock global y por almacén 100% cuadrado con las auditorías!");
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (err) {
      console.error("Error al cuadrar con auditorías:", err);
    } finally {
      setSyncingAudit(false);
    }
  };

  // Helper to get stock of a SKU in a specific warehouse (case-insensitive & warehouse-normalized)
  const getStockQty = (sku: string, almacenId: string): number => {
    if (!sku || !almacenId) return 0;
    const cleanSku = sku.trim().toUpperCase();
    const targetAlmId = firestoreService.normalizeWarehouseId(almacenId, almacenes);
    const record = stockList.find(
      s => s.sku?.trim().toUpperCase() === cleanSku && 
           firestoreService.normalizeWarehouseId(s.almacen_id, almacenes) === targetAlmId
    );
    return record ? Math.max(0, record.cantidad) : 0;
  };

  // Helper to get total stock across all registered warehouses (guaranteed to match column sum)
  const getGlobalStockQty = (sku: string): number => {
    if (!sku) return 0;
    const cleanSku = sku.trim().toUpperCase();
    if (almacenes && almacenes.length > 0) {
      return almacenes.reduce((acc, alm) => acc + getStockQty(cleanSku, alm.id), 0);
    }
    return stockList
      .filter(s => s.sku?.trim().toUpperCase() === cleanSku)
      .reduce((acc, curr) => acc + Math.max(0, curr.cantidad), 0);
  };

  // Combine catalog products with any SKUs present in stockList so that no inventory is ever omitted
  const effectiveProductos = useMemo(() => {
    const map = new Map<string, Producto>();

    // 1. Add all registered catalog products
    productos.forEach(p => {
      if (p.sku) {
        map.set(p.sku.trim().toUpperCase(), {
          ...p,
          sku: p.sku.trim().toUpperCase()
        });
      }
    });

    // 2. Auto-include any SKU in stockList that wasn't in catalog
    stockList.forEach(s => {
      if (s.sku) {
        const cleanSku = s.sku.trim().toUpperCase();
        if (!map.has(cleanSku)) {
          map.set(cleanSku, {
            sku: cleanSku,
            nombre: `Artículo ${cleanSku}`,
            categoria: "General",
            stock_minimo: 5,
            unidad: "uds"
          });
        }
      }
    });

    return Array.from(map.values());
  }, [productos, stockList]);

  // Get distinct categories from effective products
  const categorias = useMemo(() => {
    return Array.from(new Set(effectiveProductos.map(p => p.categoria).filter(Boolean))).sort();
  }, [effectiveProductos]);

  const selectedAlmacenObj = almacenes.find(a => a.id === selectedAlmacen);

  // Helper to get effective minimum stock threshold for a product in a given warehouse/scope
  const getProductMinStock = (p: Producto, almId: string): number => {
    if (almId !== "all") {
      const normId = firestoreService.normalizeWarehouseId(almId, almacenes);
      if (p.stock_minimo_almacenes && p.stock_minimo_almacenes[normId] !== undefined) {
        return Number(p.stock_minimo_almacenes[normId]) || 0;
      }
      if (p.stock_minimo_almacenes && p.stock_minimo_almacenes[almId] !== undefined) {
        return Number(p.stock_minimo_almacenes[almId]) || 0;
      }
      return Number(p.stock_minimo) || 0;
    }
    // For global scope: return legacy minimum or max of warehouse limits
    if (p.stock_minimo_almacenes && Object.keys(p.stock_minimo_almacenes).length > 0) {
      const vals = Object.values(p.stock_minimo_almacenes).map(v => Number(v) || 0);
      return Math.max(0, ...vals);
    }
    return Number(p.stock_minimo) || 0;
  };

  // Helper to determine inventory status taking into account warehouse minimums
  const getProductStatusInfo = (p: Producto, targetAlmacenId: string) => {
    if (targetAlmacenId !== "all") {
      const min = getProductMinStock(p, targetAlmacenId);
      const qty = getStockQty(p.sku, targetAlmacenId);
      if (qty === 0) {
        return {
          status: "out" as const,
          label: "Agotado",
          badgeClass: "bg-rose-50 text-rose-700 border-rose-200"
        };
      }
      if (min > 0 && qty <= min) {
        return {
          status: "low" as const,
          label: "Stock Crítico",
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200"
        };
      }
      return {
        status: "ok" as const,
        label: "Conforme",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200"
      };
    }

    // When viewing "all" warehouses:
    let outWarehousesCount = 0;
    let criticalWarehousesCount = 0;

    almacenes.forEach(alm => {
      const min = getProductMinStock(p, alm.id);
      const qty = getStockQty(p.sku, alm.id);
      if (min > 0) {
        if (qty === 0) {
          outWarehousesCount++;
        } else if (qty <= min) {
          criticalWarehousesCount++;
        }
      }
    });

    // If no per-warehouse alerts are configured, fall back to global minimum check
    const hasPerWarehouseAlerts = almacenes.some(alm => getProductMinStock(p, alm.id) > 0);
    if (!hasPerWarehouseAlerts) {
      const globalMin = Number(p.stock_minimo) || 0;
      const globalQty = getGlobalStockQty(p.sku);
      if (globalQty === 0) {
        return {
          status: "out" as const,
          label: "Sin stock",
          badgeClass: "bg-rose-50 text-rose-700 border-rose-200"
        };
      }
      if (globalMin > 0 && globalQty <= globalMin) {
        return {
          status: "low" as const,
          label: "Stock Crítico",
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200"
        };
      }
      return {
        status: "ok" as const,
        label: "Conforme",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200"
      };
    }

    // Rule 1: If out of stock in any warehouse with active alert -> "Sin stock en N almacenes"
    if (outWarehousesCount > 0) {
      const label = outWarehousesCount === 1 ? "Sin stock en 1 almacén" : `Sin stock en ${outWarehousesCount} almacenes`;
      return {
        status: "out" as const,
        label,
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200"
      };
    }

    // Rule 2: If not out of stock, but below minimum in any warehouse -> "Crítico en N almacenes"
    if (criticalWarehousesCount > 0) {
      const label = criticalWarehousesCount === 1 ? "Crítico en 1 almacén" : `Crítico en ${criticalWarehousesCount} almacenes`;
      return {
        status: "low" as const,
        label,
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200"
      };
    }

    // Rule 3: Only show "Conforme" when no warehouse has an alert
    return {
      status: "ok" as const,
      label: "Conforme",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200"
    };
  };

  // Calculate unique SKU counts prioritizing "Agotado" over "Crítico", avoiding duplication
  const { totalSkusInScope, outOfStockCount, lowStockCount } = useMemo(() => {
    let total = 0;
    let outCount = 0;
    let lowCount = 0;

    effectiveProductos.forEach(p => {
      const statusInfo = getProductStatusInfo(p, selectedAlmacen);
      const stockQty = selectedAlmacen === "all" ? getGlobalStockQty(p.sku) : getStockQty(p.sku, selectedAlmacen);

      if (selectedAlmacen === "all" || stockQty > 0 || statusInfo.status === "out" || statusInfo.status === "low") {
        total++;
      }

      // Prioritize Agotado over Crítico for unique SKU counting
      if (statusInfo.status === "out") {
        outCount++;
      } else if (statusInfo.status === "low") {
        lowCount++;
      }
    });

    return {
      totalSkusInScope: selectedAlmacen === "all" ? effectiveProductos.length : total,
      outOfStockCount: outCount,
      lowStockCount: lowCount
    };
  }, [effectiveProductos, selectedAlmacen, stockList, almacenes]);

  // Filtered product listing
  const filteredProductos = effectiveProductos.filter(p => {
    // 1. Search filter
    const matchesSearch = 
      p.sku.toLowerCase().includes(search.toLowerCase()) || 
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.categoria.toLowerCase().includes(search.toLowerCase());

    // 2. Category filter
    const matchesCategory = categoryFilter === "all" || p.categoria === categoryFilter;

    // 3. Stock status & warehouse filter
    const statusInfo = getProductStatusInfo(p, selectedAlmacen);
    const stockQty = selectedAlmacen === "all" 
      ? getGlobalStockQty(p.sku) 
      : getStockQty(p.sku, selectedAlmacen);
    
    // When a specific warehouse is selected with 'all' status, only show products present in that warehouse or with alert
    if (selectedAlmacen !== "all" && stockStatusFilter === "all") {
      if (stockQty <= 0 && statusInfo.status === "ok") {
        return false;
      }
    }

    let matchesStatus = true;
    if (stockStatusFilter === "low") {
      matchesStatus = statusInfo.status === "low";
    } else if (stockStatusFilter === "out") {
      matchesStatus = statusInfo.status === "out";
    } else if (stockStatusFilter === "ok") {
      matchesStatus = statusInfo.status === "ok";
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-5 lg:px-6 py-5" id="dashboard-container">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-5 gap-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold text-[#172033] tracking-tight leading-tight">
              Dashboard de Inventario
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#059669] border border-emerald-200">
              <ShieldCheck className="h-3 w-3" />
              <span>Cuadrado con Auditorías</span>
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Supervisión del stock en tiempo real según el historial de auditoría y movimientos registrados.
          </p>
        </div>
        <div className="flex items-center space-x-2.5 shrink-0">
          {/* Secondary subtle button for audit sync */}
          <button
            type="button"
            onClick={() => setShowConfirmSync(true)}
            disabled={syncingAudit}
            title="Recalcular y cuadrar el stock a partir de los movimientos de auditoría"
            className="inline-flex items-center space-x-1.5 bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] border border-[#E2E8F0] px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#64748B] ${syncingAudit ? "animate-spin" : ""}`} />
            <span>{syncingAudit ? "Cuadrando..." : "Cuadrar con Auditorías"}</span>
          </button>
          
          {/* Primary green button */}
          <button
            onClick={() => onNavigateToMovements()}
            className="inline-flex items-center space-x-1.5 bg-[#059669] hover:bg-[#047857] text-white font-semibold px-3.5 py-1.5 rounded-lg text-xs transition-all shadow-xs"
            title="Registrar nuevo movimiento de inventario"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Registrar movimiento</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Audit Sync */}
      <AnimatePresence>
        {showConfirmSync && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmSync(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white border border-[#E2E8F0] rounded-xl max-w-md w-full p-5 shadow-lg space-y-4 z-10"
            >
              <div className="flex items-center space-x-3 text-[#172033]">
                <div className="p-2 bg-[#ECFDF5] border border-emerald-200 rounded-lg text-[#059669]">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#172033]">Cuadrar con Auditorías</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">Recálculo automático de balances</p>
                </div>
              </div>

              <p className="text-xs text-[#64748B] leading-relaxed">
                Esta acción procesará el historial de todas las transacciones físicas registradas para garantizar que las existencias de cada almacén coincidan al 100% con la trazabilidad. ¿Deseas continuar?
              </p>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setShowConfirmSync(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] rounded-lg transition-colors border border-[#E2E8F0]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSyncAuditoria}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg transition-colors shadow-xs"
                >
                  Sí, cuadrar stock
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sync Success Alert Notice */}
      {syncMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between animate-fade-in shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-3.5 w-3.5 text-[#059669] shrink-0" />
            <span>{syncMessage}</span>
          </div>
          <button
            onClick={() => setSyncMessage(null)}
            className="text-[#64748B] hover:text-[#172033] text-xs px-2 py-0.5 rounded-md hover:bg-emerald-100"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Real-time KPI Cards (Non-clickable, clean overview) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 mb-5">
        {/* Total SKUs */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Total SKUs</span>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-1.5 rounded-lg text-[#64748B]">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-xl sm:text-2xl font-bold text-[#172033]">{totalSkusInScope}</h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {selectedAlmacen === "all" ? "Productos únicos en catálogo" : "SKUs con stock en sucursal"}
            </p>
          </div>
        </div>

        {/* Bajo Stock Alert */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Stock Crítico</span>
            <div className="bg-amber-50 border border-amber-200 p-1.5 rounded-lg text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-xl sm:text-2xl font-bold text-amber-600">
              {loading ? (
                <span className="h-4 w-10 bg-slate-100 animate-pulse inline-block rounded" />
              ) : (
                lowStockCount
              )}
            </h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">SKUs únicos por debajo de stock mínimo</p>
          </div>
        </div>

        {/* Sin Stock */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Agotado / Sin Stock</span>
            <div className="bg-rose-50 border border-rose-200 p-1.5 rounded-lg text-rose-600">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-xl sm:text-2xl font-bold text-rose-600">
              {loading ? (
                <span className="h-4 w-10 bg-slate-100 animate-pulse inline-block rounded" />
              ) : (
                outOfStockCount
              )}
            </h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">SKUs únicos con almacenes en cero</p>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 sm:p-4 mb-4 shadow-xs">
        <h3 className="text-xs font-semibold text-[#172033] uppercase tracking-wider mb-2.5 flex items-center">
          <Filter className="h-3.5 w-3.5 mr-1.5 text-[#64748B]" />
          Filtros
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Search SKU/Name */}
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-[#64748B]">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              placeholder="Buscar SKU, nombre o categoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] text-[#172033] rounded-lg py-1.5 pl-8 pr-3 text-xs sm:text-sm focus:outline-none focus:border-[#059669] transition-colors placeholder:text-slate-400"
            />
          </div>

          {/* Warehouse Selector with Lucide Icon Prefix */}
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-[#64748B]">
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <select
              value={selectedAlmacen}
              onChange={(e) => setSelectedAlmacen(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] text-[#172033] rounded-lg py-1.5 pl-8 pr-3 text-xs sm:text-sm focus:outline-none focus:border-[#059669] transition-colors"
            >
              <option value="all">Todos los almacenes (Red Global)</option>
              {almacenes.map(alm => (
                <option key={alm.id} value={alm.id}>
                  {alm.nombre} ({alm.ubicacion})
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter with Lucide Icon Prefix */}
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-[#64748B]">
              <Tag className="h-3.5 w-3.5" />
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] text-[#172033] rounded-lg py-1.5 pl-8 pr-3 text-xs sm:text-sm focus:outline-none focus:border-[#059669] transition-colors"
            >
              <option value="all">Todas las categorías</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Alert Status Filter with Lucide Icon Prefix */}
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-[#64748B]">
              <AlertCircle className="h-3.5 w-3.5" />
            </span>
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] text-[#172033] rounded-lg py-1.5 pl-8 pr-3 text-xs sm:text-sm focus:outline-none focus:border-[#059669] transition-colors"
            >
              <option value="all">Todos los estados de stock</option>
              <option value="ok">Stock conforme / suficiente</option>
              <option value="low">Stock crítico (bajo mínimo)</option>
              <option value="out">Agotado (sin stock)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-14 text-center text-[#64748B]">
            <span className="h-6 w-6 border-2 border-[#059669] border-t-transparent rounded-full animate-spin inline-block mb-2" />
            <p className="text-xs">Conectando con Firestore en tiempo real...</p>
          </div>
        ) : filteredProductos.length === 0 ? (
          <div className="py-12 text-center text-[#64748B]">
            <Warehouse className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-[#172033]">No se encontraron productos</p>
            <p className="text-xs mt-0.5">Intente cambiar los filtros o el texto de búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="stock-grid-table">
              <thead>
                <tr className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-semibold uppercase tracking-wider border-b border-[#E2E8F0]">
                  <th className="py-2.5 px-3.5">SKU / Producto</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-center">Mín. Requerido</th>
                  
                  {/* Warehouse specific columns */}
                  {selectedAlmacen === "all" ? (
                    <>
                      {almacenes.map(alm => (
                        <th 
                          key={alm.id} 
                          className="py-2.5 px-3 text-center"
                        >
                          {alm.nombre}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-center font-bold bg-[#ECFDF5] text-[#059669]">
                        Stock Global
                      </th>
                    </>
                  ) : (
                    <th className="py-2.5 px-3 text-center font-bold bg-[#ECFDF5] text-[#059669] border-x border-[#E2E8F0]">
                      Stock en {selectedAlmacenObj?.nombre || "Almacén"}
                    </th>
                  )}

                  <th className="py-2.5 px-3 text-center">Estado</th>
                  <th className="py-2.5 px-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-[#172033] text-xs sm:text-sm">
                {filteredProductos.map((prod) => {
                  const globalQty = getGlobalStockQty(prod.sku);
                  
                  // Selected scope quantity
                  const activeQty = selectedAlmacen === "all" 
                    ? globalQty 
                    : getStockQty(prod.sku, selectedAlmacen);

                  const statusInfo = getProductStatusInfo(prod, selectedAlmacen);
                  const minStockToDisplay = getProductMinStock(prod, selectedAlmacen);

                  return (
                    <tr key={prod.sku} className="hover:bg-[#F1F5F9] transition-colors">
                      {/* Name / SKU */}
                      <td className="py-2.5 px-3.5">
                        <div className="font-semibold text-[#172033] leading-tight">{prod.nombre}</div>
                        <div className="font-mono text-[11px] text-[#64748B] mt-0.5">{prod.sku}</div>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
                          {prod.categoria}
                        </span>
                      </td>

                      {/* Min stock: "Por almacén" when viewing all warehouses */}
                      <td className="py-2.5 px-3 text-center font-mono text-[#64748B] text-xs">
                        {selectedAlmacen === "all" ? (
                          <span 
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]"
                            title="Mínimos configurados individualmente por almacén"
                          >
                            Por almacén
                          </span>
                        ) : minStockToDisplay > 0 ? (
                          <>
                            {minStockToDisplay} <span className="text-[10px] text-[#64748B]">{prod.unidad}</span>
                          </>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Off (0)</span>
                        )}
                      </td>

                      {/* Warehouse stocks / Single selected warehouse stock */}
                      {selectedAlmacen === "all" ? (
                        <>
                          {almacenes.map(alm => {
                            const qty = getStockQty(prod.sku, alm.id);
                            const almMin = getProductMinStock(prod, alm.id);
                            let colorClass = "text-[#172033]";
                            if (almMin > 0 && qty === 0) colorClass = "text-rose-600 font-semibold";
                            else if (almMin > 0 && qty <= almMin) colorClass = "text-amber-600 font-semibold";

                            return (
                              <td 
                                key={alm.id} 
                                className="py-2.5 px-3 text-center font-mono text-xs"
                              >
                                <span className={colorClass}>
                                  {qty}
                                </span>
                              </td>
                            );
                          })}

                          {/* Global stock */}
                          <td className="py-2.5 px-3 text-center font-mono font-bold bg-[#F8FAFC] text-xs">
                            <span className={statusInfo.status === "out" ? "text-rose-600" : statusInfo.status === "low" ? "text-amber-600" : "text-[#059669]"}>
                              {globalQty}
                            </span>
                            <span className="text-[10px] text-[#64748B] ml-1 font-normal">{prod.unidad}</span>
                          </td>
                        </>
                      ) : (
                        <td className="py-2.5 px-3 text-center font-mono font-bold bg-[#ECFDF5]/40 border-x border-[#E2E8F0]">
                          <span className={`text-sm ${
                            statusInfo.status === "out" 
                              ? "text-rose-600" 
                              : statusInfo.status === "low" 
                              ? "text-amber-600" 
                              : "text-[#059669]"
                          }`}>
                            {activeQty}
                          </span>
                          <span className="text-[11px] text-[#64748B] ml-1 font-normal">{prod.unidad}</span>
                        </td>
                      )}

                      {/* Status indicator badge */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusInfo.badgeClass}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => onNavigateToMovements(prod.sku)}
                            className="p-1 hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#059669] rounded-md transition-colors"
                            title="Registrar movimiento"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onNavigateToHistory(prod.sku)}
                            className="text-[11px] text-[#172033] hover:text-[#059669] font-medium bg-white hover:bg-[#F1F5F9] px-2 py-1 rounded-md border border-[#E2E8F0] transition-colors shadow-xs"
                            title="Ver trazabilidad y auditoría de este producto"
                          >
                            Auditoría
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footnote information */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-[#64748B] px-1">
        <p>
          Mostrando {filteredProductos.length} {selectedAlmacen === "all" ? "productos registrados en red global" : `artículos en ${selectedAlmacenObj?.nombre || 'el almacén seleccionado'}`}.
        </p>
        <p className="flex items-center">
          <span className="h-1.5 w-1.5 rounded-full bg-[#059669] mr-1.5 animate-pulse" />
          Tiempo real activo.
        </p>
      </div>
    </div>
  );
}
