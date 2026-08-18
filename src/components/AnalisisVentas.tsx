/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  TrendingUp, 
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
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from "recharts";
import { Almacen, Producto, Movimiento, PeriodoVenta } from "../types";
import { firestoreService } from "../lib/firebase";
import { useTheme } from "../context/ThemeContext";

interface AnalisisVentasProps {
  almacenes: Almacen[];
  productos: Producto[];
  onNavigateToHistory?: (sku?: string) => void;
}

interface PeriodRange {
  currentStart: Date;
  currentEnd: Date;
  daysElapsed: number;
}

export default function AnalisisVentas({ almacenes, productos, onNavigateToHistory }: AnalisisVentasProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

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

  // Compute exact Date ranges for the selected period
  const periodRanges: PeriodRange = useMemo(() => {
    const now = new Date();
    let currentStart = new Date();
    let currentEnd = new Date(now.getTime());
    let daysElapsed = 1;

    if (periodo === "esta_semana") {
      // Monday of current week at 00:00:00
      const dayOfWeek = now.getDay();
      const diffToMonday = (dayOfWeek + 6) % 7;
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
      currentEnd = new Date(now.getTime());

      const elapsedMs = currentEnd.getTime() - currentStart.getTime();
      daysElapsed = Math.max(1, Math.ceil(elapsedMs / (24 * 60 * 60 * 1000)));
    } else if (periodo === "mes_actual") {
      // 1st day of current month at 00:00:00
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      currentEnd = new Date(now.getTime());
      daysElapsed = Math.max(1, now.getDate());
    } else if (periodo === "ultimos_30_dias") {
      currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd = new Date(now.getTime());
      daysElapsed = 30;
    } else if (periodo === "personalizado") {
      const parsedStart = new Date(customStartDate + "T00:00:00");
      const parsedEnd = new Date(customEndDate + "T23:59:59");
      currentStart = isNaN(parsedStart.getTime()) ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) : parsedStart;
      currentEnd = isNaN(parsedEnd.getTime()) ? new Date() : parsedEnd;

      const durationMs = Math.max(24 * 60 * 60 * 1000, currentEnd.getTime() - currentStart.getTime());
      daysElapsed = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));
    }

    return {
      currentStart,
      currentEnd,
      daysElapsed
    };
  }, [periodo, customStartDate, customEndDate]);

  // Filter ONLY sales (tipo === "salida") and match dimension filters for the selected period
  const salesCurrentPeriod = useMemo(() => {
    const currentList: Movimiento[] = [];
    const { currentStart, currentEnd } = periodRanges;

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
      }
    });

    return currentList;
  }, [movimientos, periodRanges, selectedAlmacen, selectedSku, selectedCategoria, productosMap]);

  // Aggregate Metrics for Current Period
  const metrics = useMemo(() => {
    const totalUnitsCurrent = salesCurrentPeriod.reduce((acc, m) => acc + Number(m.cantidad || 0), 0);

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
      topProductSku,
      topProductUnits,
      topProduct,
      topWarehouseId,
      topWarehouseUnits,
      topWarehouse,
      dailyAverage,
      daysElapsed: periodRanges.daysElapsed
    };
  }, [salesCurrentPeriod, periodRanges, productosMap, almacenesMap]);

  // Chart 1: Sales by day (Current Period)
  const salesByDayData = useMemo(() => {
    const { currentStart, daysElapsed } = periodRanges;
    const daysCount = Math.min(31, Math.max(1, daysElapsed));

    const dayLabels: string[] = [];
    const currentBuckets: number[] = new Array(daysCount).fill(0);
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

    salesCurrentPeriod.forEach(m => {
      const mDate = normalizeDate(m.fecha);
      const diffMs = mDate.getTime() - currentStart.getTime();
      const dayIdx = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      if (dayIdx >= 0 && dayIdx < daysCount) {
        currentBuckets[dayIdx] += Number(m.cantidad || 0);
      }
    });

    return dayLabels.map((label, idx) => ({
      dia: label,
      unidades: currentBuckets[idx]
    }));
  }, [salesCurrentPeriod, periodRanges, periodo]);

  // Chart 2: Sales by Product (Horizontal Bar Chart sorted descending)
  const salesByProductData = useMemo(() => {
    const map: Record<string, { sku: string; nombre: string; unidades: number; categoria: string }> = {};

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
    list.sort((a, b) => b.unidades - a.unidades);
    return list;
  }, [salesCurrentPeriod, productos, selectedCategoria, selectedSku, productosMap]);

  // Chart 3: Sales by Warehouse
  const salesByWarehouseData = useMemo(() => {
    const map: Record<string, { id: string; nombre: string; unidades: number }> = {};

    almacenes.forEach(a => {
      map[a.id] = {
        id: a.id,
        nombre: a.nombre,
        unidades: 0
      };
    });

    salesCurrentPeriod.forEach(m => {
      if (map[m.almacen_id]) {
        map[m.almacen_id].unidades += Number(m.cantidad || 0);
      }
    });

    return Object.values(map);
  }, [almacenes, salesCurrentPeriod]);

  // Automated Data-Driven Summary (describing top product, top warehouse, volume, and peak sales day)
  const automatedSummary = useMemo(() => {
    if (salesCurrentPeriod.length === 0) {
      return "No se registran salidas (ventas) en el periodo consultado para los filtros seleccionados.";
    }

    const sentences: string[] = [];

    // Volume
    sentences.push(
      `En el periodo seleccionado se registraron ${metrics.totalUnitsCurrent} unidades vendidas a través de ${salesCurrentPeriod.length} movimientos de salida.`
    );

    // Top product narrative
    if (metrics.topProduct && metrics.topProductUnits > 0) {
      sentences.push(
        `El producto líder en volumen fue ${metrics.topProduct.nombre} (${metrics.topProductSku}) con ${metrics.topProductUnits} unidades.`
      );
    }

    // Top warehouse narrative
    if (metrics.topWarehouse && metrics.topWarehouseUnits > 0) {
      sentences.push(
        `La mayor actividad comercial se concentró en ${metrics.topWarehouse.nombre}, acumulando ${metrics.topWarehouseUnits} unidades vendidas.`
      );
    }

    // Peak sales day narrative
    let peakDayLabel = "";
    let peakDayUnits = 0;
    salesByDayData.forEach(d => {
      if (d.unidades > peakDayUnits) {
        peakDayUnits = d.unidades;
        peakDayLabel = d.dia;
      }
    });

    if (peakDayUnits > 0 && peakDayLabel) {
      sentences.push(`${peakDayLabel} fue el día con mayor venta, registrando ${peakDayUnits} unidades.`);
    }

    return sentences.join(" ");
  }, [salesCurrentPeriod, metrics, salesByDayData]);

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
    <div className="max-w-7xl mx-auto px-3.5 sm:px-5 lg:px-6 py-5 space-y-4 animate-fadeIn" id="sales-analytics-container">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#263449] pb-3.5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-[#ECFDF5] dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[#059669] dark:text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-[28px] font-bold text-[#172033] dark:text-[#F8FAFC] tracking-tight leading-tight">Análisis de Ventas</h1>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                Monitoreo comercial y tendencias de salida de mercancía por producto, almacén y periodo
              </p>
            </div>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center space-x-2.5 shrink-0">
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F8FAFC] bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#182235] transition-colors shadow-2xs"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Restablecer</span>
            </button>
          )}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFC] dark:bg-[#182235] border border-[#E2E8F0] dark:border-[#263449] text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#059669] dark:bg-emerald-400 animate-pulse" />
            <span>Tiempo real activo</span>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-xl p-3 sm:p-3.5 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-[#172033] dark:text-[#F8FAFC] font-semibold text-xs">
            <Filter className="h-3.5 w-3.5 text-[#059669] dark:text-emerald-400" />
            <span>Filtros de Análisis Comercial</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Period Selector */}
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1 flex items-center space-x-1">
              <Calendar className="h-3 w-3 text-[#059669] dark:text-emerald-400" />
              <span>Periodo</span>
            </label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as PeriodoVenta)}
              className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500 transition-colors"
            >
              <option value="esta_semana">Esta semana</option>
              <option value="mes_actual">Mes actual</option>
              <option value="ultimos_30_dias">Últimos 30 días</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          {/* Warehouse Filter */}
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1 flex items-center space-x-1">
              <Warehouse className="h-3 w-3 text-[#059669] dark:text-emerald-400" />
              <span>Almacén</span>
            </label>
            <select
              value={selectedAlmacen}
              onChange={(e) => setSelectedAlmacen(e.target.value)}
              className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500 transition-colors"
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
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1 flex items-center space-x-1">
              <Package className="h-3 w-3 text-[#059669] dark:text-emerald-400" />
              <span>Producto</span>
            </label>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500 transition-colors"
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
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1 flex items-center space-x-1">
              <Layers className="h-3 w-3 text-[#059669] dark:text-emerald-400" />
              <span>Categoría</span>
            </label>
            <select
              value={selectedCategoria}
              onChange={(e) => setSelectedCategoria(e.target.value)}
              className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500 transition-colors"
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
          <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#263449] flex flex-col sm:flex-row items-center gap-3 text-xs text-[#172033] dark:text-[#F8FAFC]">
            <span className="font-semibold text-[#64748B] dark:text-[#94A3B8] text-[11px]">Rango:</span>
            <div className="flex items-center space-x-2">
              <span className="text-[#64748B] dark:text-[#94A3B8] text-[11px]">Desde:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] rounded-md px-2 py-1 text-[#172033] dark:text-[#F8FAFC] text-xs focus:border-[#059669] dark:focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[#64748B] dark:text-[#94A3B8] text-[11px]">Hasta:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] rounded-md px-2 py-1 text-[#172033] dark:text-[#F8FAFC] text-xs focus:border-[#059669] dark:focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="py-14 text-center text-[#64748B] dark:text-[#94A3B8]">
          <span className="h-6 w-6 border-2 border-[#059669] dark:border-emerald-400 border-t-transparent rounded-full animate-spin inline-block mb-2" />
          <p className="text-xs font-medium">Calculando métricas y análisis de ventas...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-center">
          <p className="text-xs font-semibold">{error}</p>
        </div>
      ) : (
        <>
          {/* Key Metric Cards - Evenly distributed in 4 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Card 1: Total Units Sold */}
            <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-xl p-3.5 shadow-2xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Unidades vendidas</span>
                  <ShoppingBag className="h-3.5 w-3.5 text-[#059669] dark:text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-[#172033] dark:text-[#F8FAFC] tracking-tight">
                  {metrics.totalUnitsCurrent} <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">uds</span>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-[#64748B] dark:text-[#94A3B8] pt-1.5 border-t border-[#E2E8F0] dark:border-[#263449] flex items-center justify-between">
                <span>Total salidas</span>
                <span className="font-mono text-[#172033] dark:text-[#F8FAFC] font-medium">{salesCurrentPeriod.length} regs</span>
              </div>
            </div>

            {/* Card 2: Top Selling Product */}
            <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Producto líder</span>
                  <Package className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="truncate">
                  <div className="text-sm font-bold text-[#172033] dark:text-[#F8FAFC] truncate" title={metrics.topProduct?.nombre || "Sin ventas"}>
                    {metrics.topProduct ? metrics.topProduct.nombre : "Sin ventas"}
                  </div>
                  <div className="text-[11px] font-mono text-[#059669] dark:text-emerald-400 font-medium">
                    {metrics.topProductSku || "—"}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-[#64748B] dark:text-[#94A3B8] pt-1.5 border-t border-[#E2E8F0] dark:border-[#263449] flex items-center justify-between">
                <span>Volumen:</span>
                <span className="font-mono font-semibold text-[#172033] dark:text-[#F8FAFC]">{metrics.topProductUnits} uds</span>
              </div>
            </div>

            {/* Card 3: Top Warehouse */}
            <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Almacén líder</span>
                  <Building2 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="truncate">
                  <div className="text-sm font-bold text-[#172033] dark:text-[#F8FAFC] truncate" title={metrics.topWarehouse?.nombre || "Sin ventas"}>
                    {metrics.topWarehouse ? metrics.topWarehouse.nombre : "Sin ventas"}
                  </div>
                  <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                    {metrics.topWarehouse ? metrics.topWarehouse.ubicacion : "—"}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-[#64748B] dark:text-[#94A3B8] pt-1.5 border-t border-[#E2E8F0] dark:border-[#263449] flex items-center justify-between">
                <span>Unidades vendidas:</span>
                <span className="font-mono font-semibold text-[#172033] dark:text-[#F8FAFC]">{metrics.topWarehouseUnits} uds</span>
              </div>
            </div>

            {/* Card 4: Daily Average */}
            <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Promedio diario</span>
                  <CalendarDays className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-[#172033] dark:text-[#F8FAFC] tracking-tight">
                  {metrics.dailyAverage.toFixed(1)} <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">uds/d</span>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-[#64748B] dark:text-[#94A3B8] pt-1.5 border-t border-[#E2E8F0] dark:border-[#263449] flex items-center justify-between">
                <span>Días evaluados:</span>
                <span className="font-mono text-[#172033] dark:text-[#F8FAFC] font-medium">{metrics.daysElapsed} d</span>
              </div>
            </div>
          </div>

          {/* Automated Data Summary Card */}
          <div className="bg-[#F8FAFC] dark:bg-[#182235] border border-[#E2E8F0] dark:border-[#263449] rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-start space-x-2.5">
              <div className="p-1.5 rounded-lg bg-[#ECFDF5] dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#059669] dark:text-emerald-400">
                  Resumen de Comportamiento Comercial
                </h3>
                <p className="text-xs text-[#172033] dark:text-[#F8FAFC] leading-relaxed">
                  {automatedSummary}
                </p>
              </div>
            </div>
          </div>

          {/* Main Charts Section or Empty State */}
          {metrics.totalUnitsCurrent === 0 ? (
            <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-xl p-8 text-center text-[#64748B] dark:text-[#94A3B8] shadow-2xs">
              <ShoppingBag className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-[#172033] dark:text-[#F8FAFC]">Sin ventas registradas en este periodo</p>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-md mx-auto">
                No se encontraron salidas comerciales de mercancía durante el rango de fechas seleccionado.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Chart 1: Ventas por día */}
              <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2.5">
                  <div>
                    <h3 className="text-sm font-bold text-[#172033] dark:text-[#F8FAFC] flex items-center space-x-1.5">
                      <LineChartIcon className="h-4 w-4 text-[#059669] dark:text-emerald-400" />
                      <span>Ventas por día</span>
                    </h3>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                      Evolución de salidas diarias de mercancía en el periodo
                    </p>
                  </div>
                </div>

                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesByDayData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="currentPeriodGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#263449" : "#F1F5F9"} />
                      <XAxis dataKey="dia" stroke={isDark ? "#94A3B8" : "#94A3B8"} tick={{ fill: isDark ? "#94A3B8" : "#64748B", fontSize: 10 }} />
                      <YAxis stroke={isDark ? "#94A3B8" : "#94A3B8"} tick={{ fill: isDark ? "#94A3B8" : "#64748B", fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#111827" : "#FFFFFF",
                          borderColor: isDark ? "#263449" : "#E2E8F0",
                          borderRadius: "0.5rem",
                          color: isDark ? "#F8FAFC" : "#172033",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          fontSize: "11px"
                        }}
                        formatter={(val: any) => [`${val} unidades`, "Ventas"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="unidades"
                        name="Ventas"
                        stroke="#059669"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#currentPeriodGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sub-grid for Chart 2 & Chart 3 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {/* Chart 2: Ventas por producto */}
                <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2.5">
                    <div>
                      <h3 className="text-sm font-bold text-[#172033] dark:text-[#F8FAFC] flex items-center space-x-1.5">
                        <BarChart3 className="h-4 w-4 text-[#059669] dark:text-emerald-400" />
                        <span>Ventas por producto</span>
                      </h3>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                        Ranking de unidades vendidas (clic en una barra para filtrar)
                      </p>
                    </div>
                  </div>

                  <div className="h-52 w-full overflow-y-auto">
                    <ResponsiveContainer width="100%" height={Math.max(200, salesByProductData.length * 34)}>
                      <BarChart
                        layout="vertical"
                        data={salesByProductData}
                        margin={{ top: 5, right: 15, left: 35, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#263449" : "#F1F5F9"} horizontal={false} />
                        <XAxis type="number" stroke={isDark ? "#94A3B8" : "#94A3B8"} tick={{ fill: isDark ? "#94A3B8" : "#64748B", fontSize: 10 }} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="sku"
                          stroke={isDark ? "#94A3B8" : "#94A3B8"}
                          tick={{ fill: isDark ? "#F8FAFC" : "#172033", fontSize: 10, fontWeight: 500 }}
                          width={65}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? "#111827" : "#FFFFFF",
                            borderColor: isDark ? "#263449" : "#E2E8F0",
                            borderRadius: "0.5rem",
                            color: isDark ? "#F8FAFC" : "#172033",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            fontSize: "11px"
                          }}
                          formatter={(val: any, name: any, item: any) => [
                            `${val} unidades (${item.payload.nombre})`,
                            "Ventas"
                          ]}
                        />
                        <Bar
                          dataKey="unidades"
                          name="Ventas"
                          radius={[0, 4, 4, 0]}
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
                              fill={selectedSku === entry.sku ? "#059669" : "#10b981"}
                              opacity={selectedSku !== "all" && selectedSku !== entry.sku ? 0.35 : 1}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 3: Ventas por almacén */}
                <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2.5">
                    <div>
                      <h3 className="text-sm font-bold text-[#172033] dark:text-[#F8FAFC] flex items-center space-x-1.5">
                        <Building2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                        <span>Ventas por almacén</span>
                      </h3>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                        Distribución de salidas por centro logístico (clic para filtrar)
                      </p>
                    </div>
                  </div>

                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesByWarehouseData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#263449" : "#F1F5F9"} />
                        <XAxis dataKey="nombre" stroke={isDark ? "#94A3B8" : "#94A3B8"} tick={{ fill: isDark ? "#94A3B8" : "#64748B", fontSize: 10 }} />
                        <YAxis stroke={isDark ? "#94A3B8" : "#94A3B8"} tick={{ fill: isDark ? "#94A3B8" : "#64748B", fontSize: 10 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? "#111827" : "#FFFFFF",
                            borderColor: isDark ? "#263449" : "#E2E8F0",
                            borderRadius: "0.5rem",
                            color: isDark ? "#F8FAFC" : "#172033",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            fontSize: "11px"
                          }}
                          formatter={(val: any) => [`${val} unidades`, "Ventas"]}
                        />
                        <Bar
                          dataKey="unidades"
                          name="Ventas"
                          fill="#0891b2"
                          radius={[4, 4, 0, 0]}
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
                              fill={selectedAlmacen === entry.id ? "#0e7490" : "#0891b2"}
                              opacity={selectedAlmacen !== "all" && selectedAlmacen !== entry.id ? 0.35 : 1}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Related Sales Movements Detail Table */}
          <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-xl shadow-2xs overflow-hidden">
            <div className="p-3 sm:p-3.5 border-b border-[#E2E8F0] dark:border-[#263449] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div>
                <h3 className="text-sm font-bold text-[#172033] dark:text-[#F8FAFC] flex items-center space-x-1.5">
                  <ShoppingBag className="h-4 w-4 text-[#059669] dark:text-emerald-400" />
                  <span>Detalle de Movimientos de Ventas (Salidas)</span>
                </h3>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                  Registros correspondientes a los filtros de periodo, producto y almacén actuales
                </p>
              </div>
              <div className="flex items-center space-x-2.5">
                <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] bg-[#F8FAFC] dark:bg-[#182235] px-2 py-0.5 rounded border border-[#E2E8F0] dark:border-[#263449]">
                  {salesCurrentPeriod.length} movimientos
                </span>
                {onNavigateToHistory && (
                  <button
                    onClick={() => onNavigateToHistory(selectedSku !== "all" ? selectedSku : undefined)}
                    className="text-xs text-[#059669] dark:text-emerald-400 hover:text-[#047857] dark:hover:text-emerald-300 font-semibold flex items-center space-x-1 transition-colors"
                  >
                    <span>Ver en Historial</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {salesCurrentPeriod.length === 0 ? (
              <div className="py-12 text-center text-[#64748B] dark:text-[#94A3B8]">
                <Info className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                <p className="text-xs font-medium">No hay salidas/ventas registradas en este periodo con los filtros activos.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] dark:bg-[#182235] text-[#64748B] dark:text-[#94A3B8] text-[11px] font-semibold uppercase tracking-wider border-b border-[#E2E8F0] dark:border-[#263449]">
                      <th className="py-2.5 px-3.5">Folio</th>
                      <th className="py-2.5 px-3">Fecha y Hora</th>
                      <th className="py-2.5 px-3">Producto y SKU</th>
                      <th className="py-2.5 px-3">Almacén</th>
                      <th className="py-2.5 px-3 text-right">Cantidad</th>
                      <th className="py-2.5 px-3.5">Referencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#263449] text-xs sm:text-sm">
                    {salesCurrentPeriod.map((mov) => {
                      const mDate = normalizeDate(mov.fecha);
                      const prod = productosMap.get((mov.sku || "").toUpperCase());
                      const alm = almacenesMap.get(mov.almacen_id);

                      return (
                        <tr key={mov.id || `${mov.sku}_${mDate.getTime()}`} className="hover:bg-[#F1F5F9] dark:hover:bg-[#182235]/60 transition-colors">
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#F8FAFC] dark:bg-[#182235] border border-[#E2E8F0] dark:border-[#263449] text-[#059669] dark:text-emerald-400">
                              {mov.folio || "—"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-[#64748B] dark:text-[#94A3B8] text-xs">
                            <div className="text-[#172033] dark:text-[#F8FAFC] font-medium">{mDate.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</div>
                            <div className="text-[#64748B] dark:text-[#94A3B8] font-mono text-[10px]">{mDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#172033] dark:text-[#F8FAFC] leading-tight">{prod ? prod.nombre : mov.sku}</div>
                            <div className="text-[11px] font-mono text-[#059669] dark:text-emerald-400 font-medium">{mov.sku}</div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-medium text-[#172033] dark:text-[#F8FAFC] text-xs">{alm ? alm.nombre : mov.almacen_id}</div>
                            <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">{alm ? alm.ubicacion : ""}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400">
                              -{mov.cantidad} uds
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-[#64748B] dark:text-[#94A3B8] text-xs max-w-xs truncate" title={mov.referencia}>
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
