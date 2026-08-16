/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { firestoreService } from "../lib/firebase";
import { Almacen, Producto, StockItem } from "../types";
import { 
  Search, 
  Warehouse, 
  AlertTriangle, 
  CheckCircle, 
  Layers, 
  TrendingDown, 
  TrendingUp, 
  Filter, 
  ArrowRightLeft,
  Plus,
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import { motion } from "motion/react";

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
  const effectiveProductos = React.useMemo(() => {
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
  const categorias = Array.from(new Set(effectiveProductos.map(p => p.categoria).filter(Boolean)));

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

  // Helper to evaluate if product is in low stock condition in the current scope
  const isProductLowStock = (p: Producto, almId: string): boolean => {
    if (almId !== "all") {
      const min = getProductMinStock(p, almId);
      if (min <= 0) return false; // 0 = Alerta desactivada
      const qty = getStockQty(p.sku, almId);
      return qty <= min && qty > 0;
    }

    // When viewing "all" warehouses:
    // Check if any warehouse has an active alert (min > 0) and stock is <= min
    if (p.stock_minimo_almacenes && Object.keys(p.stock_minimo_almacenes).length > 0) {
      return almacenes.some(alm => {
        const min = getProductMinStock(p, alm.id);
        if (min <= 0) return false;
        const qty = getStockQty(p.sku, alm.id);
        return qty <= min && qty > 0;
      });
    }

    // Legacy fallback
    const globalMin = Number(p.stock_minimo) || 0;
    if (globalMin <= 0) return false;
    const globalQty = getGlobalStockQty(p.sku);
    return globalQty <= globalMin && globalQty > 0;
  };

  // Calculate stats based on filters & selected warehouse
  const totalSkusInScope = selectedAlmacen === "all"
    ? effectiveProductos.length
    : effectiveProductos.filter(p => getStockQty(p.sku, selectedAlmacen) > 0).length;
  
  // Calculate how many products are low on stock in the selected scope
  const lowStockCount = effectiveProductos.filter(p => isProductLowStock(p, selectedAlmacen)).length;

  const outOfStockCount = effectiveProductos.filter(p => {
    const stockQty = selectedAlmacen === "all" 
      ? getGlobalStockQty(p.sku) 
      : getStockQty(p.sku, selectedAlmacen);
    return stockQty === 0;
  }).length;

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
    const stockQty = selectedAlmacen === "all" 
      ? getGlobalStockQty(p.sku) 
      : getStockQty(p.sku, selectedAlmacen);
    
    // When a specific warehouse is selected with 'all' status, only show products present in that warehouse
    if (selectedAlmacen !== "all" && stockStatusFilter === "all") {
      if (stockQty <= 0) {
        return false;
      }
    }

    let matchesStatus = true;
    const isLow = isProductLowStock(p, selectedAlmacen);
    const isOut = stockQty === 0;

    if (stockStatusFilter === "low") {
      matchesStatus = isLow;
    } else if (stockStatusFilter === "out") {
      matchesStatus = isOut;
    } else if (stockStatusFilter === "ok") {
      matchesStatus = !isLow && !isOut;
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="dashboard-container">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Dashboard de Inventario</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Cuadrado con Auditorías</span>
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Supervisión del stock en tiempo real según el historial de auditoría y movimientos registrados.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          <button
            type="button"
            onClick={handleSyncAuditoria}
            disabled={syncingAudit}
            title="Recalcular y cuadrar el stock matemáticamente a partir de todos los movimientos de auditoría"
            className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-3.5 py-2.5 rounded-xl shadow-sm text-sm font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-emerald-400 ${syncingAudit ? "animate-spin" : ""}`} />
            <span>{syncingAudit ? "Cuadrando..." : "Cuadrar con Auditorías"}</span>
          </button>
          <button
            onClick={() => onNavigateToMovements()}
            className="inline-flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2.5 rounded-xl shadow-md text-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Movimiento</span>
          </button>
        </div>
      </div>

      {/* Sync Success Alert Notice */}
      {syncMessage && (
        <div className="mb-6 p-4 bg-emerald-950/50 border border-emerald-800 rounded-xl text-sm text-emerald-300 flex items-center justify-between animate-fade-in shadow-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{syncMessage}</span>
          </div>
          <button
            onClick={() => setSyncMessage(null)}
            className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded-lg hover:bg-slate-800"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Real-time KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        {/* Total SKUs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total SKUs</span>
            <div className="bg-slate-800 p-2 rounded-xl text-slate-300">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-100">{totalSkusInScope}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {selectedAlmacen === "all" ? "Productos únicos registrados" : "SKUs con stock en sucursal"}
            </p>
          </div>
        </div>

        {/* Bajo Stock Alert */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Stock Crítico</span>
            <div className="bg-amber-950/40 border border-amber-900 p-2 rounded-xl text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-amber-400">
              {loading ? (
                <span className="h-5 w-12 bg-slate-800 animate-pulse inline-block rounded" />
              ) : (
                lowStockCount
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-1">SKUs por debajo de stock mínimo</p>
          </div>
        </div>

        {/* Sin Stock */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Agotado / Sin Stock</span>
            <div className="bg-rose-950/40 border border-rose-900 p-2 rounded-xl text-rose-400">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-rose-400">
              {loading ? (
                <span className="h-5 w-12 bg-slate-800 animate-pulse inline-block rounded" />
              ) : (
                outOfStockCount
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-1">SKUs con cantidad en cero</p>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center">
          <Filter className="h-4 w-4 mr-2 text-slate-400" />
          Filtros de búsqueda rápida
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search SKU/Name */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </span>
            <input
              type="text"
              placeholder="Buscar SKU, nombre o categoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600"
            />
          </div>

          {/* Warehouse Selector (Requested: "un filtro para elegir el almacén") */}
          <div>
            <select
              value={selectedAlmacen}
              onChange={(e) => setSelectedAlmacen(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">🏢 Todos los almacenes (Red Global)</option>
              {almacenes.map(alm => (
                <option key={alm.id} value={alm.id}>
                  🏢 {alm.nombre} ({alm.ubicacion})
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">📦 Todas las categorías</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>
                  📦 {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Alert Status Filter */}
          <div>
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">⚠️ Todos los estados de stock</option>
              <option value="ok">✅ Stock Suficiente / Conforme</option>
              <option value="low">⚠️ Stock Crítico (Por debajo del mínimo)</option>
              <option value="out">🛑 Agotado (Sin stock)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <span className="h-8 w-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block mb-3" />
            <p>Conectando con Firestore en tiempo real...</p>
          </div>
        ) : filteredProductos.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Warehouse className="h-12 w-12 mx-auto text-slate-700 mb-3" />
            <p className="text-base font-semibold text-slate-400">No se encontraron productos</p>
            <p className="text-sm mt-1">Intente cambiar los filtros o el texto de búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="stock-grid-table">
              <thead>
                <tr className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                  <th className="py-4 px-6">SKU / Producto</th>
                  <th className="py-4 px-6">Categoría</th>
                  <th className="py-4 px-6 text-center">Mín. Requerido</th>
                  
                  {/* Warehouse specific columns */}
                  {selectedAlmacen === "all" ? (
                    <>
                      {almacenes.map(alm => (
                        <th 
                          key={alm.id} 
                          className="py-4 px-6 text-center"
                        >
                          {alm.nombre}
                        </th>
                      ))}
                      <th className="py-4 px-6 text-center font-bold bg-slate-800/20 text-emerald-400">
                        Stock Global
                      </th>
                    </>
                  ) : (
                    <th className="py-4 px-6 text-center font-bold bg-emerald-950/40 text-emerald-400 border-x border-slate-800">
                      Stock en {selectedAlmacenObj?.nombre || "Almacén"}
                    </th>
                  )}

                  <th className="py-4 px-6 text-center">Estado</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
                {filteredProductos.map((prod) => {
                  const globalQty = getGlobalStockQty(prod.sku);
                  
                  // Selected scope quantity
                  const activeQty = selectedAlmacen === "all" 
                    ? globalQty 
                    : getStockQty(prod.sku, selectedAlmacen);

                  const isLow = isProductLowStock(prod, selectedAlmacen);
                  const isOut = activeQty === 0;
                  const minStockToDisplay = getProductMinStock(prod, selectedAlmacen);

                  return (
                    <tr key={prod.sku} className="hover:bg-slate-800/20 transition-colors">
                      {/* Name / SKU */}
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-200">{prod.nombre}</div>
                        <div className="font-mono text-xs text-slate-500 mt-0.5">{prod.sku}</div>
                      </td>

                      {/* Category */}
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          {prod.categoria}
                        </span>
                      </td>

                      {/* Min stock */}
                      <td className="py-4 px-6 text-center font-mono text-slate-400">
                        {minStockToDisplay > 0 ? (
                          <>
                            {minStockToDisplay} <span className="text-[10px]">{prod.unidad}</span>
                          </>
                        ) : (
                          <span className="text-slate-500 text-xs">Off (0)</span>
                        )}
                      </td>

                      {/* Warehouse stocks / Single selected warehouse stock */}
                      {selectedAlmacen === "all" ? (
                        <>
                          {almacenes.map(alm => {
                            const qty = getStockQty(prod.sku, alm.id);
                            const almMin = getProductMinStock(prod, alm.id);
                            let colorClass = "text-slate-300";
                            if (qty === 0) colorClass = "text-rose-500/80 font-semibold";
                            else if (almMin > 0 && qty <= almMin) colorClass = "text-amber-500 font-semibold";

                            return (
                              <td 
                                key={alm.id} 
                                className="py-4 px-6 text-center font-mono"
                              >
                                <span className={colorClass}>
                                  {qty}
                                </span>
                              </td>
                            );
                          })}

                          {/* Global stock */}
                          <td className="py-4 px-6 text-center font-mono font-semibold bg-slate-800/10">
                            <span className={globalQty === 0 ? "text-rose-500" : isLow ? "text-amber-500" : "text-emerald-400"}>
                              {globalQty}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-1">{prod.unidad}</span>
                          </td>
                        </>
                      ) : (
                        <td className="py-4 px-6 text-center font-mono font-bold bg-emerald-950/15 border-x border-slate-800/60">
                          <span className={`text-base ${
                            activeQty === 0 
                              ? "text-rose-500" 
                              : isLow 
                              ? "text-amber-500" 
                              : "text-emerald-400"
                          }`}>
                            {activeQty}
                          </span>
                          <span className="text-xs text-slate-500 ml-1.5 font-normal">{prod.unidad}</span>
                        </td>
                      )}

                      {/* Status indicator */}
                      <td className="py-4 px-6 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-rose-950/50 text-rose-400 border border-rose-900">
                            Agotado
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-950/50 text-amber-400 border border-amber-900">
                            Bajo Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-950/50 text-emerald-400 border border-emerald-900">
                            Conforme
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => onNavigateToMovements(prod.sku)}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors"
                            title="Registrar movimiento"
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onNavigateToHistory(prod.sku)}
                            className="text-xs text-slate-400 hover:text-white font-medium bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors"
                          >
                            Ver Auditoría
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
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500 px-2">
        <p>
          Mostrando {filteredProductos.length} {selectedAlmacen === "all" ? "productos registrados en red global" : `artículos con inventario en ${selectedAlmacenObj?.nombre || 'el almacén seleccionado'}`}.
        </p>
        <p className="flex items-center">
          <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
          Actualización en tiempo real vía Firebase Firestore activada.
        </p>
      </div>
    </div>
  );
}
