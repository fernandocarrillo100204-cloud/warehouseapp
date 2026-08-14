/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { firestoreService } from "../lib/firebase";
import { Producto, StockItem } from "../types";
import { 
  Package, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  X, 
  Check, 
  AlertCircle, 
  AlertTriangle, 
  Upload, 
  FileText,
  Layers,
  Archive,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function GestionProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Selected or active items
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);

  // Form fields
  const [sku, setSku] = useState("");
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [stockMinimo, setStockMinimo] = useState<number>(0);
  const [unidad, setUnidad] = useState("pieza");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // CSV Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<{
    successCount: number;
    errors: string[];
    skippedCount: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Real-time subscriptions and auto-sync
  useEffect(() => {
    setLoading(true);

    // Auto-sync any existing inventory SKUs into catalog on initial view
    firestoreService.syncInventoryProducts().catch((err) => {
      console.error("Auto sync inventory products error:", err);
    });

    // Subscribe to products list
    const unsubscribeProductos = firestoreService.getProductosRealtime((data) => {
      setProductos(data);
      setLoading(false);
    });

    // Subscribe to stock list for delete validation and inventory sync
    const unsubscribeStock = firestoreService.getStockRealtime((data) => {
      setStockList(data);
    });

    return () => {
      unsubscribeProductos();
      unsubscribeStock();
    };
  }, []);

  // Consolidate catalog with any SKU that has stock entries so the catalog is NEVER empty if inventory exists
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

    // 2. Complement with any SKUs present in stock records
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

  // Filtered products
  const filteredProductos = effectiveProductos.filter(p => {
    const queryStr = searchQuery.toLowerCase().trim();
    if (!queryStr) return true;
    return (
      p.sku.toLowerCase().includes(queryStr) ||
      p.nombre.toLowerCase().includes(queryStr) ||
      p.categoria.toLowerCase().includes(queryStr)
    );
  });

  // Get current active stock sum across all warehouses for a given SKU (case-insensitive)
  const getProductStockStatus = (productSku: string) => {
    const cleanSku = productSku ? productSku.trim().toUpperCase() : "";
    const productStocks = stockList.filter(item => item.sku?.trim().toUpperCase() === cleanSku);
    const totalQty = productStocks.reduce((sum, item) => sum + item.cantidad, 0);
    const locationsCount = productStocks.filter(item => item.cantidad > 0).length;

    return {
      hasStock: totalQty > 0,
      totalQty,
      locationsCount
    };
  };

  // Open Form modal (for Add or Edit)
  const openFormModal = (product: Producto | null = null) => {
    setFormError(null);
    if (product) {
      setSelectedProduct(product);
      setSku(product.sku);
      setNombre(product.nombre);
      setCategoria(product.categoria);
      setStockMinimo(product.stock_minimo);
      setUnidad(product.unidad);
    } else {
      setSelectedProduct(null);
      setSku("");
      setNombre("");
      setCategoria("");
      setStockMinimo(0);
      setUnidad("pieza");
    }
    setIsFormOpen(true);
  };

  // Open Delete confirmation modal
  const openDeleteModal = (product: Producto) => {
    setSelectedProduct(product);
    setIsDeleteOpen(true);
  };

  // Handle Form Submit (Add or Edit)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sku.trim() || !nombre.trim() || !categoria.trim() || stockMinimo < 0 || !unidad.trim()) {
      setFormError("Por favor, completa todos los campos requeridos.");
      return;
    }

    const cleanSku = sku.trim().toUpperCase();

    // Prevent alphanumeric check for SKU if simple, but format check is good
    if (!/^[A-Z0-9_-]+$/.test(cleanSku)) {
      setFormError("El SKU solo puede contener letras mayúsculas, números, guiones y guiones bajos.");
      return;
    }

    setSubmitLoading(true);
    setFormError(null);

    try {
      if (selectedProduct) {
        // Edit mode (SKU cannot be changed)
        await firestoreService.updateProduct(selectedProduct.sku, {
          nombre: nombre.trim(),
          categoria: categoria.trim(),
          stock_minimo: Number(stockMinimo),
          unidad: unidad.trim()
        });
        setIsFormOpen(false);
      } else {
        // Add mode (Verify duplicate first)
        const duplicate = effectiveProductos.find(p => p.sku.toUpperCase() === cleanSku);
        if (duplicate) {
          throw new Error(`El SKU "${cleanSku}" ya está registrado en el catálogo.`);
        }

        await firestoreService.addProduct({
          sku: cleanSku,
          nombre: nombre.trim(),
          categoria: categoria.trim(),
          stock_minimo: Number(stockMinimo),
          unidad: unidad.trim()
        });
        setIsFormOpen(false);
      }
    } catch (err: any) {
      console.error("Error saving product:", err);
      setFormError(err.message || "Ocurrió un error al guardar el producto.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle Delete execution
  const handleDeleteSubmit = async () => {
    if (!selectedProduct) return;

    const { hasStock } = getProductStockStatus(selectedProduct.sku);
    if (hasStock) {
      alert("No se puede eliminar un producto con inventario activo.");
      return;
    }

    setSubmitLoading(true);
    try {
      await firestoreService.deleteProduct(selectedProduct.sku);
      setIsDeleteOpen(false);
    } catch (err: any) {
      console.error("Error deleting product:", err);
      alert(err.message || "Error al eliminar el producto.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // CSV Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv") || file.type === "text/csv") {
        setCsvFile(file);
        setImportResults(null);
      } else {
        alert("Por favor, selecciona un archivo en formato CSV.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setCsvFile(file);
      setImportResults(null);
    }
  };

  // CSV Parsing and Processing
  const processCSV = () => {
    if (!csvFile) return;

    setSubmitLoading(true);
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setImportResults({
          successCount: 0,
          errors: ["El archivo está vacío o no se pudo leer."],
          skippedCount: 0
        });
        setSubmitLoading(false);
        return;
      }

      // Parse CSV simple parser
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        setImportResults({
          successCount: 0,
          errors: ["El archivo CSV debe incluir una cabecera y al menos una fila."],
          skippedCount: 0
        });
        setSubmitLoading(false);
        return;
      }

      // Parse headers
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const skuIdx = headers.indexOf("sku");
      const nombreIdx = headers.indexOf("nombre");
      const categoriaIdx = headers.indexOf("categoria");
      const stockMinIdx = headers.indexOf("stock_minimo");
      const unidadIdx = headers.indexOf("unidad");

      if (skuIdx === -1 || nombreIdx === -1) {
        setImportResults({
          successCount: 0,
          errors: ["Cabeceras inválidas. Se requieren columnas 'sku' y 'nombre' como mínimo."],
          skippedCount: 0
        });
        setSubmitLoading(false);
        return;
      }

      let successCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      // Loop rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        // Split columns considering simple comma (no quoted commas for simple CSV)
        const cols = line.split(",").map(c => c.trim());
        if (cols.length < Math.max(skuIdx, nombreIdx) + 1) {
          errors.push(`Fila ${i + 1}: Columnas insuficientes.`);
          continue;
        }

        const rawSku = cols[skuIdx];
        const rawNombre = cols[nombreIdx];
        const rawCategoria = categoriaIdx !== -1 ? cols[categoriaIdx] : "General";
        const rawStockMin = stockMinIdx !== -1 ? Number(cols[stockMinIdx]) : 0;
        const rawUnidad = unidadIdx !== -1 ? cols[unidadIdx] : "pieza";

        if (!rawSku || !rawNombre) {
          errors.push(`Fila ${i + 1}: SKU y Nombre son requeridos.`);
          continue;
        }

        const formattedSku = rawSku.toUpperCase();
        if (!/^[A-Z0-9_-]+$/.test(formattedSku)) {
          errors.push(`Fila ${i + 1} (${formattedSku}): Formato de SKU inválido.`);
          continue;
        }

        // Check duplicates inside currently loaded state or against newly added in same loop
        const isDuplicate = productos.some(p => p.sku === formattedSku);
        if (isDuplicate) {
          skippedCount++;
          errors.push(`Fila ${i + 1} (${formattedSku}): El SKU ya existe en la base de datos (Omitido).`);
          continue;
        }

        try {
          // Add product
          await firestoreService.addProduct({
            sku: formattedSku,
            nombre: rawNombre,
            categoria: rawCategoria || "General",
            stock_minimo: isNaN(rawStockMin) ? 0 : rawStockMin,
            unidad: rawUnidad || "pieza"
          });
          successCount++;
        } catch (err: any) {
          errors.push(`Fila ${i + 1} (${formattedSku}): Error al guardar en Firebase - ${err.message || err}`);
        }
      }

      setImportResults({
        successCount,
        skippedCount,
        errors
      });
      setSubmitLoading(false);
      setCsvFile(null);
    };

    reader.onerror = () => {
      setImportResults({
        successCount: 0,
        errors: ["Ocurrió un error al leer el archivo."],
        skippedCount: 0
      });
      setSubmitLoading(false);
    };

    reader.readAsText(csvFile);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="gestion-productos-view">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Catálogo de Productos</h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestiona la lista maestra de artículos, categorías, unidades de medida y márgenes de stock mínimo.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              setImportResults(null);
              setCsvFile(null);
              setIsImportOpen(true);
            }}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-850 hover:border-slate-700 font-semibold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 text-sm focus:outline-none"
          >
            <Upload className="h-4 w-4 text-slate-400" />
            <span>Importar CSV</span>
          </button>
          
          <button
            onClick={() => openFormModal(null)}
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center space-x-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar producto</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Buscar por SKU, nombre o categoría..."
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

      {/* Products list */}
      {loading ? (
        <div className="py-24 text-center text-slate-400">
          <span className="h-8 w-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block mb-3" />
          <p className="text-sm font-medium">Cargando catálogo maestro...</p>
        </div>
      ) : filteredProductos.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-850 rounded-2xl p-12 text-center">
          <div className="bg-slate-950 inline-flex p-4 rounded-full text-slate-600 mb-4">
            <Package className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-1">Catálogo vacío</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {searchQuery ? "No se encontraron productos que coincidan con la búsqueda." : "Agrega productos manualmente o importa un lote de inicio con un archivo CSV."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">SKU / ID</th>
                  <th className="py-4 px-6">Nombre del Artículo</th>
                  <th className="py-4 px-6">Categoría</th>
                  <th className="py-4 px-6">U. de Medida</th>
                  <th className="py-4 px-6">Mínimo Crítico</th>
                  <th className="py-4 px-6">Stock Físico Real</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProductos.map((p) => {
                  const { hasStock, totalQty } = getProductStockStatus(p.sku);
                  const isBelowMin = totalQty <= p.stock_minimo;
                  return (
                    <tr key={p.sku} className="hover:bg-slate-850/35 transition-colors group">
                      <td className="py-4 px-6 font-mono text-xs text-slate-400 font-semibold">
                        {p.sku}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="bg-slate-950 p-2 rounded-lg text-emerald-400 border border-slate-800">
                            <Package className="h-4 w-4" />
                          </div>
                          <span className="font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors">
                            {p.nombre}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="bg-slate-950 px-2.5 py-1 text-xs text-slate-400 border border-slate-800 rounded-lg">
                          {p.categoria}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-300 text-sm font-medium">
                        {p.unidad}
                      </td>
                      <td className="py-4 px-6 text-slate-300 text-sm">
                        {p.stock_minimo} {p.unidad}(s)
                      </td>
                      <td className="py-4 px-6">
                        {hasStock ? (
                          <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            isBelowMin 
                              ? "bg-rose-950/45 text-rose-400 border border-rose-900/40" 
                              : "bg-emerald-950/45 text-emerald-400 border border-emerald-900/40"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isBelowMin ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`} />
                            <span>{totalQty} {p.unidad}(s) {isBelowMin ? "(Stock Crítico)" : ""}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-950 text-slate-500 border border-slate-800/60">
                            <span className="h-1.5 w-1.5 bg-slate-700 rounded-full" />
                            <span>Agotado (0)</span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openFormModal(p)}
                            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(p)}
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
                            title="Eliminar"
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

          {/* Mobile/Tablet Card Grid View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:hidden">
            {filteredProductos.map((p) => {
              const { hasStock, totalQty } = getProductStockStatus(p.sku);
              const isBelowMin = totalQty <= p.stock_minimo;
              return (
                <div key={p.sku} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-950 p-2.5 rounded-xl text-emerald-400 border border-slate-850">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-200 text-base">{p.nombre}</h4>
                        <span className="font-mono text-[10px] text-slate-500 uppercase">{p.sku}</span>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => openFormModal(p)}
                        className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(p)}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 pt-2 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-0.5">Categoría:</span>
                      <span className="bg-slate-950 px-2 py-0.5 border border-slate-850 rounded text-slate-300">
                        {p.categoria}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">U. de Medida:</span>
                      <span className="text-slate-200 font-semibold">{p.unidad}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">Mínimo crítico:</span>
                      <span className="text-slate-200">{p.stock_minimo} uds</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">Stock Real Total:</span>
                      {hasStock ? (
                        <span className={`font-semibold px-2 py-0.5 rounded ${isBelowMin ? "bg-rose-950/50 text-rose-400" : "bg-emerald-950/50 text-emerald-400"}`}>
                          {totalQty} {isBelowMin ? "(Crítico)" : ""}
                        </span>
                      ) : (
                        <span className="text-slate-500">0 (Agotado)</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* FORM MODAL (ADD / EDIT) */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />

              <button
                onClick={() => setIsFormOpen(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-6 flex items-center space-x-3">
                <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-400 border border-emerald-500/10">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">
                    {selectedProduct ? "Editar Producto" : "Nuevo Artículo Maestro"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Define la información básica de catálogo y límites de resurtido.
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* SKU */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      SKU (Fijo al crear) <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!selectedProduct}
                      placeholder="Ej. LAP-ACC-01"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed focus:border-slate-700 text-slate-200 text-sm rounded-xl focus:outline-none transition-all placeholder:text-slate-750 font-mono uppercase"
                    />
                  </div>

                  {/* Nombre */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Nombre del Artículo <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Teclado Mecánico RGB"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-slate-700 text-slate-200 text-sm rounded-xl focus:outline-none transition-all placeholder:text-slate-700"
                    />
                  </div>

                  {/* Categoría */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Categoría <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Accesorios, Tecnología"
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-slate-700 text-slate-200 text-sm rounded-xl focus:outline-none transition-all placeholder:text-slate-700"
                    />
                  </div>

                  {/* Unidad de Medida */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Unidad de Medida <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. pieza, kg, caja, paquete"
                      value={unidad}
                      onChange={(e) => setUnidad(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-slate-700 text-slate-200 text-sm rounded-xl focus:outline-none transition-all placeholder:text-slate-700"
                    />
                  </div>

                  {/* Stock Mínimo */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Mínimo Crítico de Reabastecimiento <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      placeholder="Ej. 10"
                      value={stockMinimo}
                      onChange={(e) => setStockMinimo(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-slate-700 text-slate-200 text-sm rounded-xl focus:outline-none transition-all"
                    />
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Si el inventario sumado baja de esta cantidad en los almacenes, se emitirá una alerta visual para resurtido rápido.
                    </p>
                  </div>
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
                    <span>{selectedProduct ? "Guardar cambios" : "Crear producto"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {isDeleteOpen && selectedProduct && (() => {
          const { hasStock, totalQty } = getProductStockStatus(selectedProduct.sku);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDeleteOpen(false)}
                className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
              />

              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl overflow-hidden"
              >
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
                    {hasStock ? "Bloqueado: Producto con inventario" : "¿Eliminar producto maestro?"}
                  </h3>

                  <p className="text-slate-400 text-xs mt-2 leading-relaxed font-sans">
                    {hasStock 
                      ? `Este artículo tiene actualmente stock real disponible (${totalQty} unidades) registrado en tus almacenes. Para proteger la integridad histórica de tu inventario, primero debes liquidar, desechar o reubicar el stock actual de este SKU.`
                      : `¿Estás completamente seguro de eliminar el producto "${selectedProduct.nombre}" (SKU: ${selectedProduct.sku}) del catálogo maestro? Esta acción es definitiva.`}
                  </p>

                  <div className="w-full mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsDeleteOpen(false)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-250 font-semibold rounded-xl text-xs transition-colors"
                    >
                      {hasStock ? "Cerrar" : "Cancelar"}
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
                        <span>Eliminar del Catálogo</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* CSV IMPORT MODAL */}
      <AnimatePresence>
        {isImportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsImportOpen(false)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />

              <button
                onClick={() => setIsImportOpen(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-4 flex items-center space-x-3 shrink-0">
                <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-400 border border-emerald-500/10">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Importación Masiva (CSV)</h3>
                  <p className="text-xs text-slate-400">
                    Carga el catálogo inicial de la empresa cargando un archivo plano.
                  </p>
                </div>
              </div>

              {/* CSV Spec Guidelines */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-[11px] text-slate-400 space-y-2 shrink-0 mb-4">
                <div className="flex items-center space-x-1.5 font-semibold text-emerald-400">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Especificación requerida del archivo:</span>
                </div>
                <p>
                  Sube un archivo delimitado por comas (`.csv`) con las siguientes columnas exactas en la primera fila:
                </p>
                <div className="bg-slate-900 p-2.5 rounded font-mono text-xs text-slate-300 border border-slate-800 overflow-x-auto select-all">
                  sku,nombre,categoria,stock_minimo,unidad
                </div>
                <p>
                  Ejemplo de fila:<br />
                  <span className="font-mono text-slate-500 text-xs">MON-ACC-24,"Monitor UltraWide 24",Tecnología,10,pieza</span>
                </p>
              </div>

              {/* Drop area / Progress */}
              <div className="overflow-y-auto pr-1 space-y-4 flex-1">
                {!importResults ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
                      isDragging 
                        ? "border-emerald-500 bg-emerald-950/20 text-emerald-300" 
                        : csvFile 
                          ? "border-emerald-500/50 bg-slate-950/50" 
                          : "border-slate-800 hover:border-slate-700 bg-slate-950/20"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div className="bg-slate-900 p-4 rounded-full border border-slate-800 text-slate-500 group-hover:text-emerald-400 transition-colors">
                      <FileText className="h-8 w-8 text-slate-400" />
                    </div>

                    {csvFile ? (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-emerald-400">{csvFile.name}</p>
                        <p className="text-xs text-slate-500">{(csvFile.size / 1024).toFixed(2)} KB • Archivo listo</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-300">Arrastra tu archivo CSV aquí</p>
                        <p className="text-xs text-slate-500">o haz clic para explorar en el equipo</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Import Complete Summary Box */
                  <div className="space-y-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
                      <h4 className="font-bold text-slate-100 flex items-center space-x-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>¡Procesamiento completo!</span>
                      </h4>
                      <div className="grid grid-cols-3 gap-2.5 text-center">
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-850">
                          <span className="text-2xl font-bold text-emerald-400">{importResults.successCount}</span>
                          <span className="block text-[10px] text-slate-500 uppercase mt-0.5 font-semibold">Cargados</span>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-850">
                          <span className="text-2xl font-bold text-amber-400">{importResults.skippedCount}</span>
                          <span className="block text-[10px] text-slate-500 uppercase mt-0.5 font-semibold">Omitidos</span>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-850">
                          <span className="text-2xl font-bold text-rose-400">{importResults.errors.length}</span>
                          <span className="block text-[10px] text-slate-500 uppercase mt-0.5 font-semibold">Alertas</span>
                        </div>
                      </div>
                    </div>

                    {/* Detailed errors list */}
                    {importResults.errors.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bitácora de Advertencias/Errores:</h5>
                        <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 max-h-40 overflow-y-auto font-mono text-[10px] text-slate-400 divide-y divide-slate-900">
                          {importResults.errors.map((err, i) => (
                            <p key={i} className="py-1.5 text-rose-300 flex items-start space-x-2">
                              <span className="text-slate-600 shrink-0 select-none">•</span>
                              <span>{err}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-end space-x-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-250 font-semibold rounded-xl text-xs transition-colors"
                >
                  Cerrar ventana
                </button>
                {csvFile && !importResults && (
                  <button
                    type="button"
                    onClick={processCSV}
                    disabled={submitLoading}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center space-x-1.5"
                  >
                    {submitLoading ? (
                      <span className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : null}
                    <span>Iniciar Procesamiento</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
