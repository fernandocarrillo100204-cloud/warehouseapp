/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar, 
  Warehouse, 
  Package, 
  Layers, 
  BarChart3, 
  LineChart as LineChartIcon, 
  Sparkles, 
  Filter, 
  RotateCcw, 
  ShoppingBag, 
  Building2, 
  CalendarDays, 
  Info,
  ChevronRight
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from "recharts";
import { Almacen, Producto, Movimiento, PeriodoVenta } from "../types";
import { firestoreService } from "../lib/firebase";

interface AnalisisVentasProps {
  almacenes: Almacen[];
  productos: Producto[];
  onNavigateToHistory?: (sku?: string) => void;
}

interface PeriodRange {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  daysElapsed: number;
}

export default function AnalisisVentas({ almacenes, productos, onNavigateToHistory }: AnalisisVentasProps) {
  // Filters state
  const [periodo, setPeriodo] = useState<PeriodoVenta>("esta_semana");
  const [selectedAlmacen, setSelectedAlmacen] = useState<string>("all");
  const [selectedSku, setSelectedSku] = useState<string>("all");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [compareWithPrevious, setCompareWithPrevious] = useState<boolean>(true);

  // Real-time data state
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time subscription to movements
  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      const unsubscribe = firestoreService.getMovimientosRealtime((data) => {
        setMovimientos(data);
        setLoading(false);
      });
      return () => {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      };
    } catch (err: any) {
      console.error("Error subscribing to movements for sales analysis:", err);
      setError("No se pudieron cargar los datos de ventas en tiempo real.");
      setLoading(false);
    }
  }, []);

  // Unique categories list
  const categorias = useMemo(() => {
    const set = new Set<string>();
    productos.forEach(p => {
      if (p.categoria && p.categoria.trim()) {
        set.add(p.categoria.trim());
      }
    });
    return Array.from(set).sort();
  }, [productos]);

  // Lookup maps
  const productosMap = useMemo(() => {
    const map = new Map<string, Producto>();
    productos.forEach(p => map.set(p.sku.toUpperCase(), p));
    return map;
  }, [productos]);

  const almacenesMap = useMemo(() => {
    const map = new Map<string, Almacen>();
    almacenes.forEach(a => map.set(a.id, a));
    return map;
  }, [almacenes]);

  // Helper to parse dates accurately
  const normalizeDate = (raw: any): Date => {
    if (!raw) return new Date();
    if (raw instanceof Date) return raw;
    if (typeof raw.toDate === "function") return raw.toDate();
    if (typeof raw.seconds === "number") return new Date(raw.seconds * 1000);
    return new Date(raw);
  };

  // Compute exact Date ranges for Current and Previous periods
  const periodRanges: PeriodRange = useMemo(() => {
    const now = new Date();
    let currentStart = new Date();
    let currentEnd = new Date(now.getTime());
    let previousStart = new Date();
    let previousEnd = new Date();
    let daysElapsed = 1;

    if (periodo === "esta_semana") {
      // Monday of current week at 00:00:00
      const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = (dayOfWeek + 6) % 7; // Monday = 0, Sunday = 6
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
      currentEnd = new Date(now.getTime());

      // Elapsed ms from current week's Monday
      const elapsedMs = currentEnd.getTime() - currentStart.getTime();
      daysElapsed = Math.max(1, Math.ceil(elapsedMs / (24 * 60 * 60 * 1000)));

      // Previous week: Monday of previous week up to the same elapsed time!
      previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousEnd = new Date(previousStart.getTime() + elapsedMs);
    } else if (periodo === "mes_actual") {
      // 1st day of current month at 00:00:00
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      currentEnd = new Date(now.getTime());

      const elapsedMs = currentEnd.getTime() - currentStart.getTime();
      daysElapsed = Math.max(1, now.getDate());

      // Previous month: 1st day of previous month up to same day of month
      const prevMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      previousStart = new Date(prevMonthYear, prevMonth, 1, 0, 0, 0, 0);
      
      // Calculate days in prev month to prevent overflow
      const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
      const targetPrevDay = Math.min(now.getDate(), daysInPrevMonth);
      previousEnd = new Date(prevMonthYear, prevMonth, targetPrevDay, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    } else if (periodo === "ultimos_30_dias") {
      currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd = new Date(now.getTime());
      daysElapsed = 30;

      previousStart = new Date(currentStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      previousEnd = new Date(currentStart.getTime());
    } else if (periodo === "personalizado") {
      const parsedStart = new Date(customStartDate + "T00:00:00");
      const parsedEnd = new Date(customEndDate + "T23:59:59");
      currentStart = isNaN(parsedStart.getTime()) ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) : parsedStart;
      currentEnd = isNaN(parsedEnd.getTime()) ? new Date() : parsedEnd;

      const durationMs = Math.max(24 * 60 * 60 * 1000, currentEnd.getTime() - currentStart.getTime());
      daysElapsed = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));

      previousStart = new Date(currentStart.getTime() - durationMs);
      previousEnd = new Date(currentStart.getTime());
    }

    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
      daysElapsed
    };
  }, [periodo, customStartDate, customEndDate]);

  // Filter ONLY sales (tipo === "salida") and match current dimension filters
  const { salesCurrentPeriod, salesPreviousPeriod } = useMemo(() => {
    const currentList: Movimiento[] = [];
    const previousList: Movimiento[] = [];

    const { currentStart, currentEnd, previousStart, previousEnd } = periodRanges;

    movimientos.forEach(m => {
      // RULE: only consider salida movements
      if (m.tipo !== "salida") return;

      const sku = (m.sku || "").trim().toUpperCase();
      const prod = productosMap.get(sku);

      // Category filter
      if (selectedCategoria !== "all" && prod?.categoria !== selectedCategoria) {
        return;
      }

      // SKU filter
      if (selectedSku !== "all" && sku !== selectedSku.toUpperCase()) {
        return;
      }

      // Warehouse filter
      if (selectedAlmacen !== "all" && m.almacen_id !== selectedAlmacen) {
        return;
      }

      const mDate = normalizeDate(m.fecha);
      const time = mDate.getTime();

      if (time >= currentStart.getTime() && time <= currentEnd.getTime()) {
        currentList.push(m);
      } else if (time >= previousStart.getTime() && time <= previousEnd.getTime()) {
        previousList.push(m);
      }
    });

    return {
      salesCurrentPeriod: currentList,
      salesPreviousPeriod: previousList
    };
  }, [movimientos, periodRanges, selectedAlmacen, selectedSku, selectedCategoria, productosMap]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalUnitsCurrent = salesCurrentPeriod.reduce((acc, m) => acc + Number(m.cantidad || 0), 0);
    const totalUnitsPrevious = salesPreviousPeriod.reduce((acc, m) => acc + Number(m.cantidad || 0), 0);

    // Percentage Variation
    let variationPercentage: number | null = null;
    let variationLabel = "Sin base de comparación";
    let isPositive = false;
    let isNegative = false;

    if (totalUnitsPrevious > 0) {
      variationPercentage = ((totalUnitsCurrent - totalUnitsPrevious) / totalUnitsPrevious) * 100;
      if (variationPercentage > 0) {
        variationLabel = `+${variationPercentage.toFixed(1)}%`;
        isPositive = true;
      } else if (variationPercentage < 0) {
        variationLabel = `${variationPercentage.toFixed(1)}%`;
        isNegative = true;
      } else {
        variationLabel = "0.0%";
      }
    } else if (totalUnitsPrevious === 0 && totalUnitsCurrent > 0) {
      variationLabel = "Sin base de comparación (0 uds antes)";
    } else {
      variationLabel = "Sin base de comparación";
    }

    const unitDifference = totalUnitsCurrent - totalUnitsPrevious;

    // Top Product
    const productUnitsMap: Record<string, number> = {};
    salesCurrentPeriod.forEach(m => {
      const sku = (m.sku || "").toUpperCase();
      productUnitsMap[sku] = (productUnitsMap[sku] || 0) + Number(m.cantidad || 0);
    });

    let topProductSku = "";
    let topProductUnits = 0;
    Object.entries(productUnitsMap).forEach(([sku, units]) => {
      if (units > topProductUnits) {
        topProductUnits = units;
        topProductSku = sku;
      }
    });
    const topProduct = topProductSku ? productosMap.get(topProductSku) : null;

    // Top Warehouse
    const warehouseUnitsMap: Record<string, number> = {};
    salesCurrentPeriod.forEach(m => {
      const wid = m.almacen_id;
      warehouseUnitsMap[wid] = (warehouseUnitsMap[wid] || 0) + Number(m.cantidad || 0);
    });

    let topWarehouseId = "";
    let topWarehouseUnits = 0;
    Object.entries(warehouseUnitsMap).forEach(([wid, units]) => {
      if (units > topWarehouseUnits) {
        topWarehouseUnits = units;
        topWarehouseId = wid;
      }
    });
    const topWarehouse = topWarehouseId ? almacenesMap.get(topWarehouseId) : null;

    // Daily average
    const dailyAverage = (totalUnitsCurrent / periodRanges.daysElapsed);

    return {
      totalUnitsCurrent,
      totalUnitsPrevious,
      unitDifference,
      variationPercentage,
      variationLabel,
      isPositive,
      isNegative,
      topProductSku,
      topProductUnits,
      topProduct,
      topWarehouseId,
      topWarehouseUnits,
      topWarehouse,
      dailyAverage,
      daysElapsed: periodRanges.daysElapsed
    };
  }, [salesCurrentPeriod, salesPreviousPeriod, periodRanges, productosMap, almacenesMap]);

  // Chart 1: Sales by day comparison (Current vs Previous)
  const salesByDayData = useMemo(() => {
    // Generate buckets based on period
    const { currentStart, currentEnd, previousStart, daysElapsed } = periodRanges;
    const daysCount = Math.min(31, Math.max(1, daysElapsed));

    const dayLabels: string[] = [];
    const currentBuckets: number[] = new Array(daysCount).fill(0);
    const previousBuckets: number[] = new Array(daysCount).fill(0);

    const weekdays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    for (let i = 0; i < daysCount; i++) {
      const bucketDate = new Date(currentStart.getTime() + i * 24 * 60 * 60 * 1000);
      if (periodo === "esta_semana") {
        const dayIdx = bucketDate.getDay();
        dayLabels.push(`${weekdays[dayIdx]} ${bucketDate.getDate()}`);
      } else if (periodo === "mes_actual") {
        dayLabels.push(`Día ${i + 1}`);
      } else {
        dayLabels.push(`${bucketDate.getDate()}/${bucketDate.getMonth() + 1}`);
      }
    }

    // Populate current period sales
    salesCurrentPeriod.forEach(m => {
      const mDate = normalizeDate(m.fecha);
      const diffMs = mDate.getTime() - currentStart.getTime();
      const dayIdx = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      if (dayIdx >= 0 && dayIdx < daysCount) {
        currentBuckets[dayIdx] += Number(m.cantidad || 0);
      }
    });

    // Populate previous period sales
    salesPreviousPeriod.forEach(m => {
      const mDate = normalizeDate(m.fecha);
      const diffMs = mDate.getTime() - previousStart.getTime();
      const dayIdx = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      if (dayIdx >= 0 && dayIdx < daysCount) {
        previousBuckets[dayIdx] += Number(m.cantidad || 0);
      }
    });

    return dayLabels.map((label, idx) => ({
      dia: label,
      "Periodo actual": currentBuckets[idx],
      "Periodo anterior": previousBuckets[idx]
    }));
  }, [salesCurrentPeriod, salesPreviousPeriod, periodRanges, periodo]);

  // Chart 2: Sales by Product (Horizontal Bar Chart sorted descending)
  const salesByProductData = useMemo(() => {
    const map: Record<string, { sku: string; nombre: string; unidades: number; categoria: string }> = {};

    // Initialize with all filtered products or active products
    productos.forEach(p => {
      if (selectedCategoria !== "all" && p.categoria !== selectedCategoria) return;
      if (selectedSku !== "all" && p.sku !== selectedSku) return;
      map[p.sku] = {
        sku: p.sku,
        nombre: p.nombre,
        categoria: p.categoria,
        unidades: 0
      };
    });

    salesCurrentPeriod.forEach(m => {
      const sku = (m.sku || "").toUpperCase();
      if (!map[sku]) {
        const prod = productosMap.get(sku);
        map[sku] = {
          sku,
          nombre: prod ? prod.nombre : sku,
          categoria: prod ? prod.categoria : "General",
          unidades: 0
        };
      }
      map[sku].unidades += Number(m.cantidad || 0);
    });

    const list = Object.values(map);
    // Sort descending by units sold
    list.sort((a, b) => b.unidades - a.unidades);
    return list;
  }, [salesCurrentPeriod, productos, selectedCategoria, selectedSku, productosMap]);

  // Chart 3: Sales by Warehouse
  const salesByWarehouseData = useMemo(() => {
    const map: Record<string, { id: string; nombre: string; unidades: number; unidadesAnterior: number }> = {};

    almacenes.forEach(a => {
      map[a.id] = {
        id: a.id,
        nombre: a.nombre,
        unidades: 0,
        unidadesAnterior: 0
      };
    });

    salesCurrentPeriod.forEach(m => {
      if (map[m.almacen_id]) {
        map[m.almacen_id].unidades += Number(m.cantidad || 0);
      }
    });

    salesPreviousPeriod.forEach(m => {
      if (map[m.almacen_id]) {
        map[m.almacen_id].unidadesAnterior += Number(m.cantidad || 0);
      }
    });

    return Object.values(map);
  }, [almacenes, salesCurrentPeriod, salesPreviousPeriod]);

  // Automated Data-Driven Summary (strictly based on factual numbers)
  const automatedSummary = useMemo(() => {
    if (salesCurrentPeriod.length === 0 && salesPreviousPeriod.length === 0) {
      return "No se registran salidas (ventas) en los periodos consultados para los filtros seleccionados.";
    }

    if (salesCurrentPeriod.length === 0) {
      return `En el periodo actual no se han registrado ventas. En el periodo anterior se registraron ${metrics.totalUnitsPrevious} unidades vendidas.`;
    }

    const sentences: string[] = [];

    // Top product narrative
    if (metrics.topProduct) {
      const prevProdUnits = salesPreviousPeriod
        .filter(m => m.sku.toUpperCase() === metrics.topProductSku)
        .reduce((sum, m) => sum + Number(m.cantidad || 0), 0);

      if (prevProdUnits > 0) {
        const prodVar = ((metrics.topProductUnits - prevProdUnits) / prevProdUnits) * 100;
        const sign = prodVar >= 0 ? "+" : "";
        sentences.push(
          `Las ventas de ${metrics.topProduct.nombre} (${metrics.topProductSku}) registraron ${metrics.topProductUnits} unidades (${sign}${prodVar.toFixed(1)}% respecto al periodo anterior).`
        );
      } else {
        sentences.push(
          `El producto con mayor volumen fue ${metrics.topProduct.nombre} (${metrics.topProductSku}) con ${metrics.topProductUnits} unidades vendidas.`
        );
      }
    }

    // Warehouse concentration narrative
    if (metrics.topWarehouse) {
      const prevWhUnits = salesPreviousPeriod
        .filter(m => m.almacen_id === metrics.topWarehouseId)
        .reduce((sum, m) => sum + Number(m.cantidad || 0), 0);
      const whDiff = metrics.topWarehouseUnits - prevWhUnits;

      if (whDiff > 0 && prevWhUnits > 0) {
        sentences.push(
          `El incremento se concentró principalmente en ${metrics.topWarehouse.nombre}, con ${whDiff} unidades más que el periodo anterior (${metrics.topWarehouseUnits} unidades totales).`
        );
      } else {
        sentences.push(
          `La mayor actividad comercial se concentró en ${metrics.topWarehouse.nombre}, acumulando ${metrics.topWarehouseUnits} unidades vendidas.`
        );
      }
    }

    // Peak sales day narrative
    let peakDayLabel = "";
    let peakDayUnits = 0;
    salesByDayData.forEach(d => {
      const val = d["Periodo actual"] || 0;
      if (val > peakDayUnits) {
        peakDayUnits = val;
        peakDayLabel = d.dia;
      }
    });

    if (peakDayUnits > 0 && peakDayLabel) {
      sentences.push(`${peakDayLabel} fue el día con mayor venta, sumando un total de ${peakDayUnits} unidades.`);
    }

    return sentences.join(" ");
  }, [salesCurrentPeriod, salesPreviousPeriod, metrics, salesByDayData]);

  // Interactive filter helpers
  const handleSelectProductFromChart = (sku: string) => {
    if (selectedSku === sku) {
      setSelectedSku("all");
    } else {
      setSelectedSku(sku);
    }
  };

  const handleSelectWarehouseFromChart = (almacenId: string) => {
    if (selectedAlmacen === almacenId) {
      setSelectedAlmacen("all");
    } else {
      setSelectedAlmacen(almacenId);
    }
  };

  const handleResetFilters = () => {
    setPeriodo("esta_semana");
    setSelectedAlmacen("all");
    setSelectedSku("all");
    setSelectedCategoria("all");
  };

  const hasActiveFilters = selectedAlmacen !== "all" || selectedSku !== "all" || selectedCategoria !== "all" || periodo !== "esta_semana";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn" id="sales-analytics-container">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Análisis de Ventas</h1>
              <p className="text-sm text-slate-400">
                Monitoreo comercial y tendencias de salida de mercancía por producto, almacén y periodo
              </p>
            </div>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center space-x-3">
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="flex items-center space-x-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restablecer filtros</span>
            </button>
          )}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Tiempo real activo</span>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-300 font-medium text-sm">
            <Filter className="h-4 w-4 text-emerald-400" />
            <span>Filtros de Análisis Comercial</span>
          </div>
          <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={compareWithPrevious}
              onChange={(e) => setCompareWithPrevious(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20"
            />
            <span>Comparar con periodo anterior</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Period Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center space-x-1">
              <Calendar className="h-3.5 w-3.5 text-emerald-400" />
              <span>Periodo</span>
            </label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as PeriodoVenta)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="esta_semana">Esta semana</option>
              <option value="mes_actual">Mes actual</option>
              <option value="ultimos_30_dias">Últimos 30 días</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          {/* Warehouse Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center space-x-1">
              <Warehouse className="h-3.5 w-3.5 text-emerald-400" />
              <span>Almacén</span>
            </label>
            <select
              value={selectedAlmacen}
              onChange={(e) => setSelectedAlmacen(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">Todos los almacenes</option>
              {almacenes.map(alm => (
                <option key={alm.id} value={alm.id}>
                  {alm.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Product Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center space-x-1">
              <Package className="h-3.5 w-3.5 text-emerald-400" />
              <span>Producto</span>
            </label>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">Todos los productos</option>
              {productos.map(p => (
                <option key={p.sku} value={p.sku}>
                  {p.sku} - {p.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center space-x-1">
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
              <span>Categoría</span>
            </label>
            <select
              value={selectedCategoria}
              onChange={(e) => setSelectedCategoria(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">Todas las categorías</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Range picker if "personalizado" */}
        {periodo === "personalizado" && (
          <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-4 text-xs text-slate-300">
            <span className="font-semibold text-slate-400">Rango personalizado:</span>
            <div className="flex items-center space-x-2">
              <span className="text-slate-500">Desde:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-500">Hasta:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <span className="h-9 w-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block mb-3" />
          <p className="text-sm font-medium">Calculando métricas y análisis de ventas...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-center">
          <p className="text-sm font-semibold">{error}</p>
        </div>
      ) : (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Card 1: Total Units Sold */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Unidades vendidas</span>
                  <ShoppingBag className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-extrabold text-white tracking-tight">
                  {metrics.totalUnitsCurrent} <span className="text-sm font-medium text-slate-400">uds</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-400 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <span>Total salidas</span>
                <span className="font-mono text-slate-300">{salesCurrentPeriod.length} regs</span>
              </div>
            </div>

            {/* Card 2: Variation vs Previous Period */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Variación vs anterior</span>
                  {metrics.isPositive ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  ) : metrics.isNegative ? (
                    <TrendingDown className="h-4 w-4 text-rose-400" />
                  ) : (
                    <Minus className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                <div className="flex items-baseline space-x-2">
                  <span
                    className={`text-2xl font-bold tracking-tight ${
                      metrics.isPositive
                        ? "text-emerald-400"
                        : metrics.isNegative
                        ? "text-rose-400"
                        : "text-slate-300"
                    }`}
                  >
                    {metrics.variationLabel}
                  </span>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-400 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <span>Diferencia neta:</span>
                <span className="font-mono text-slate-300">
                  {metrics.unitDifference > 0 ? `+${metrics.unitDifference}` : metrics.unitDifference} uds
                </span>
              </div>
            </div>

            {/* Card 3: Top Selling Product */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Producto más vendido</span>
                  <Package className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="truncate">
                  <div className="text-lg font-bold text-white truncate" title={metrics.topProduct?.nombre || "Sin ventas"}>
                    {metrics.topProduct ? metrics.topProduct.nombre : "Sin ventas"}
                  </div>
                  <div className="text-xs font-mono text-emerald-400">
                    {metrics.topProductSku || "—"}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-400 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <span>Volumen:</span>
                <span className="font-mono font-semibold text-slate-200">{metrics.topProductUnits} uds</span>
              </div>
            </div>

            {/* Card 4: Top Warehouse */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Almacén líder</span>
                  <Building2 className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="truncate">
                  <div className="text-lg font-bold text-white truncate" title={metrics.topWarehouse?.nombre || "Sin ventas"}>
                    {metrics.topWarehouse ? metrics.topWarehouse.nombre : "Sin ventas"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {metrics.topWarehouse ? metrics.topWarehouse.ubicacion : "—"}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-400 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <span>Despachos:</span>
                <span className="font-mono font-semibold text-slate-200">{metrics.topWarehouseUnits} uds</span>
              </div>
            </div>

            {/* Card 5: Daily Average */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Promedio diario</span>
                  <CalendarDays className="h-4 w-4 text-amber-400" />
                </div>
                <div className="text-3xl font-extrabold text-white tracking-tight">
                  {metrics.dailyAverage.toFixed(1)} <span className="text-sm font-medium text-slate-400">uds/día</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-400 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <span>Días evaluados:</span>
                <span className="font-mono text-slate-300">{metrics.daysElapsed} d</span>
              </div>
            </div>
          </div>

          {/* Automated Data Summary Card */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Resumen de Comportamiento Comercial
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {automatedSummary}
                </p>
              </div>
            </div>
          </div>

          {/* Main Charts Section */}
          <div className="space-y-6">
            {/* Chart 1: Ventas por día (Arriba, ocupando todo el ancho) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                    <LineChartIcon className="h-4 w-4 text-emerald-400" />
                    <span>Ventas por día</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {compareWithPrevious ? "Comparativa contra periodo anterior" : "Evolución de salidas diarias"}
                  </p>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesByDayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="currentPeriodGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="dia" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "0.75rem",
                        color: "#f8fafc",
                        fontSize: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)"
                      }}
                      formatter={(val: any) => [`${val} unidades`, ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Area
                      type="monotone"
                      dataKey="Periodo actual"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#currentPeriodGradient)"
                    />
                    {compareWithPrevious && (
                      <Line
                        type="monotone"
                        dataKey="Periodo anterior"
                        stroke="#64748b"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 3, fill: "#64748b" }}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sub-grid for Chart 2 & Chart 3 (Abajo en dos columnas iguales, apiladas en móviles) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 2: Ventas por producto */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                      <BarChart3 className="h-4 w-4 text-emerald-400" />
                      <span>Ventas por producto</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ranking de unidades vendidas (clic en una barra para filtrar)
                    </p>
                  </div>
                </div>

                <div className="h-64 w-full overflow-y-auto">
                  <ResponsiveContainer width="100%" height={Math.max(240, salesByProductData.length * 40)}>
                    <BarChart
                      layout="vertical"
                      data={salesByProductData}
                      margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="sku"
                        stroke="#64748b"
                        tick={{ fill: "#cbd5e1", fontSize: 11, fontWeight: 500 }}
                        width={70}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "0.75rem",
                          color: "#f8fafc",
                          fontSize: "12px"
                        }}
                        formatter={(val: any, name: any, item: any) => [
                          `${val} unidades (${item.payload.nombre})`,
                          "Ventas"
                        ]}
                      />
                      <Bar
                        dataKey="unidades"
                        radius={[0, 6, 6, 0]}
                        cursor="pointer"
                        onClick={(data: any) => {
                          if (data && data.sku) {
                            handleSelectProductFromChart(data.sku);
                          }
                        }}
                      >
                        {salesByProductData.map((entry) => (
                          <Cell
                            key={`cell-${entry.sku}`}
                            fill={selectedSku === entry.sku ? "#34d399" : "#10b981"}
                            opacity={selectedSku !== "all" && selectedSku !== entry.sku ? 0.35 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Ventas por almacén */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-cyan-400" />
                      <span>Ventas por almacén</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Distribución de salidas por centro logístico (clic para filtrar)
                    </p>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesByWarehouseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="nombre" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "0.75rem",
                          color: "#f8fafc",
                          fontSize: "12px"
                        }}
                        formatter={(val: any) => [`${val} unidades`, ""]}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                      <Bar
                        dataKey="unidades"
                        name="Periodo actual"
                        fill="#06b6d4"
                        radius={[6, 6, 0, 0]}
                        cursor="pointer"
                        onClick={(data: any) => {
                          if (data && data.id) {
                            handleSelectWarehouseFromChart(data.id);
                          }
                        }}
                      >
                        {salesByWarehouseData.map((entry) => (
                          <Cell
                            key={`alm-${entry.id}`}
                            fill={selectedAlmacen === entry.id ? "#22d3ee" : "#06b6d4"}
                            opacity={selectedAlmacen !== "all" && selectedAlmacen !== entry.id ? 0.35 : 1}
                          />
                        ))}
                      </Bar>
                      {compareWithPrevious && (
                        <Bar
                          dataKey="unidadesAnterior"
                          name="Periodo anterior"
                          fill="#475569"
                          radius={[6, 6, 0, 0]}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Related Sales Movements Detail Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <ShoppingBag className="h-4 w-4 text-emerald-400" />
                  <span>Detalle de Movimientos de Ventas (Salidas)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Registros correspondientes a los filtros de periodo, producto y almacén actuales
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  {salesCurrentPeriod.length} movimientos
                </span>
                {onNavigateToHistory && (
                  <button
                    onClick={() => onNavigateToHistory(selectedSku !== "all" ? selectedSku : undefined)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center space-x-1 transition-colors"
                  >
                    <span>Ver en Historial General</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {salesCurrentPeriod.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No hay salidas/ventas registradas en este periodo con los filtros activos.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                      <th className="py-3.5 px-6">Folio</th>
                      <th className="py-3.5 px-6">Fecha y Hora</th>
                      <th className="py-3.5 px-6">Producto y SKU</th>
                      <th className="py-3.5 px-6">Almacén</th>
                      <th className="py-3.5 px-6 text-right">Cantidad vendida</th>
                      <th className="py-3.5 px-6">Referencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {salesCurrentPeriod.map((mov) => {
                      const mDate = normalizeDate(mov.fecha);
                      const prod = productosMap.get((mov.sku || "").toUpperCase());
                      const alm = almacenesMap.get(mov.almacen_id);

                      return (
                        <tr key={mov.id || `${mov.sku}_${mDate.getTime()}`} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3.5 px-6 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-950 border border-slate-800 text-emerald-400">
                              {mov.folio || "—"}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 whitespace-nowrap text-slate-400 text-xs">
                            <div>{mDate.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</div>
                            <div className="text-slate-500 font-mono">{mDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</div>
                          </td>
                          <td className="py-3.5 px-6">
                            <div className="font-semibold text-slate-200">{prod ? prod.nombre : mov.sku}</div>
                            <div className="text-xs font-mono text-emerald-400">{mov.sku}</div>
                          </td>
                          <td className="py-3.5 px-6 whitespace-nowrap">
                            <div className="font-medium text-slate-300">{alm ? alm.nombre : mov.almacen_id}</div>
                            <div className="text-xs text-slate-500">{alm ? alm.ubicacion : ""}</div>
                          </td>
                          <td className="py-3.5 px-6 text-right whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                              -{mov.cantidad} uds
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-slate-400 text-xs max-w-xs truncate" title={mov.referencia}>
                            {mov.referencia || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
