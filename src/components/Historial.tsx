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
  X
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
    const matchesSku = !skuFilter || mov.sku.toLowerCase().includes(skuFilter.toLowerCase());
    const matchesWarehouse = warehouseFilter === "all" || mov.almacen_id === warehouseFilter || mov.almacen_destino_id === warehouseFilter;
    const matchesTipo = tipoFilter === "all" || mov.tipo === tipoFilter;

    return matchesSku && matchesWarehouse && matchesTipo;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="historial-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Historial de Auditoría</h1>
          <p className="text-sm text-slate-400 mt-1">
            Registro inmutable de transacciones físicas, compras, ventas y conciliaciones.
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <button
            onClick={loadMovimientos}
            className="text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium px-4 py-2.5 rounded-xl transition-colors inline-flex items-center space-x-2"
          >
            <History className="h-4 w-4" />
            <span>Refrescar Registro</span>
          </button>
        </div>
      </div>

      {/* Main filters bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center">
            <SlidersHorizontal className="h-4 w-4 mr-2 text-slate-400" />
            Búsqueda e Histórico
          </h3>
          {(skuFilter || warehouseFilter !== "all" || tipoFilter !== "all") && (
            <button
              onClick={() => {
                setSkuFilter("");
                setWarehouseFilter("all");
                setTipoFilter("all");
                if (onClearPreselectedSku) onClearPreselectedSku();
              }}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center"
            >
              <X className="h-3 w-3 mr-1" />
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* SKU Filter */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </span>
            <input
              type="text"
              placeholder="Buscar SKU específico..."
              value={skuFilter}
              onChange={(e) => setSkuFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600"
            />
            {skuFilter && (
              <button
                onClick={() => {
                  setSkuFilter("");
                  if (onClearPreselectedSku) onClearPreselectedSku();
                }}
                className="absolute right-3.5 inset-y-0 flex items-center text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Warehouse Filter */}
          <div>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">🏢 Todos los almacenes</option>
              {almacenes.map(alm => (
                <option key={alm.id} value={alm.id}>
                  🏢 {alm.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Transaction Type Filter */}
          <div>
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">📁 Todos los tipos</option>
              <option value="entrada">📥 Compras (Entradas)</option>
              <option value="salida">📤 Ventas (Salidas)</option>
              <option value="ajuste">⚙️ Ajustes de Inventario</option>
              <option value="transferencia">🔄 Transferencias Internas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <span className="h-8 w-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block mb-3" />
            <p>Buscando registros...</p>
          </div>
        ) : filteredMovimientos.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-700 mb-3" />
            <p className="text-base font-semibold text-slate-400">Sin movimientos para mostrar</p>
            <p className="text-sm mt-1">No hay transacciones registradas que coincidan con estos filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="audit-log-table">
              <thead>
                <tr className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                  <th className="py-4 px-6">Fecha / Hora</th>
                  <th className="py-4 px-6">SKU / Producto</th>
                  <th className="py-4 px-6">Almacén Origen</th>
                  <th className="py-4 px-6">Transacción</th>
                  <th className="py-4 px-6 text-center">Cantidad</th>
                  <th className="py-4 px-6">Referencia / Glosa</th>
                  <th className="py-4 px-6">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
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
                      badgeColorClass = "bg-emerald-950 text-emerald-400 border border-emerald-800";
                      typeLabel = "Entrada";
                      qtyPrefix = "+";
                      qtyColorClass = "text-emerald-400 font-bold";
                      break;
                    case "salida":
                      badgeColorClass = "bg-rose-950 text-rose-400 border border-rose-800";
                      typeLabel = "Salida";
                      qtyPrefix = "-";
                      qtyColorClass = "text-rose-400 font-bold";
                      break;
                    case "ajuste":
                      badgeColorClass = "bg-purple-950 text-purple-400 border border-purple-800";
                      typeLabel = "Ajuste";
                      qtyPrefix = "≡";
                      qtyColorClass = "text-purple-400 font-semibold";
                      break;
                    case "transferencia":
                      badgeColorClass = "bg-blue-950 text-blue-400 border border-blue-800";
                      typeLabel = "Transferencia";
                      qtyPrefix = "⇆";
                      qtyColorClass = "text-blue-400 font-semibold";
                      break;
                  }

                  return (
                    <tr key={mov.id} className="hover:bg-slate-800/10 transition-colors">
                      {/* Date & Time */}
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2.5 text-slate-400">
                          <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span className="font-medium whitespace-nowrap">{dateStr}</span>
                        </div>
                      </td>

                      {/* Product details */}
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-200">
                          {getProductName(mov.sku)}
                        </div>
                        <div className="font-mono text-xs text-slate-500 mt-0.5">
                          {mov.sku}
                        </div>
                      </td>

                      {/* Origin warehouse */}
                      <td className="py-4 px-6">
                        <div className="font-medium text-slate-300">
                          {getWarehouseName(mov.almacen_id)}
                        </div>
                        {mov.tipo === "transferencia" && mov.almacen_destino_id && (
                          <div className="text-[11px] text-emerald-400 font-medium flex items-center mt-1">
                            <span>Destino: {getWarehouseName(mov.almacen_destino_id)}</span>
                          </div>
                        )}
                      </td>

                      {/* Movement Type */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeColorClass}`}>
                          {typeLabel}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className={`py-4 px-6 text-center font-mono ${qtyColorClass}`}>
                        {qtyPrefix} {mov.cantidad}
                      </td>

                      {/* Reference string */}
                      <td className="py-4 px-6 text-slate-300 italic max-w-xs truncate" title={mov.referencia}>
                        {mov.referencia}
                      </td>

                      {/* Authorized by */}
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2 text-xs text-slate-400">
                          <User className="h-3 w-3 text-slate-500" />
                          <span className="truncate max-w-[140px]" title={mov.usuario}>
                            {mov.usuario.split("@")[0]}
                          </span>
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

      <div className="mt-4 text-xs text-slate-500 flex justify-between px-2">
        <p>Mostrando {filteredMovimientos.length} de {movimientos.length} transacciones registradas.</p>
        <p>Los registros históricos son de carácter auditable y no editables.</p>
      </div>
    </div>
  );
}
