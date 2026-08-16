/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { firestoreService } from "../lib/firebase";
import { Producto, StockItem, Almacen, CategoriaCatalogo, UnidadMedidaCatalogo } from "../types";
import ModalCatalogos from "./ModalCatalogos";
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
  Warehouse,
  ArrowRight,
  Sparkles,
  Info,
  FolderTree
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface GestionProductosProps {
  almacenes?: Almacen[];
  onNavigateToMovimiento?: (sku: string) => void;
}

// Standard fallback units of measure
const UNIDADES_ESTANDAR = [
  { value: "pieza", label: "Pieza (pza)" },
  { value: "uds", label: "Unidad (uds)" },
  { value: "caja", label: "Caja (cja)" },
  { value: "paquete", label: "Paquete (paq)" },
  { value: "kilogramo", label: "Kilogramo (kg)" },
  { value: "litro", label: "Litro (L)" },
  { value: "metro", label: "Metro (m)" },
  { value: "rollo", label: "Rollo (rll)" },
  { value: "otra", label: "Otra (especificar)..." }
];

const CATEGORIAS_POR_DEFECTO = [
  "Inyección de Plástico",
  "Extrusión",
  "Cerrajería Metálica",
  "Tornillería y Herrajes",
  "Empaque y Embalaje",
  "Materia Prima",
  "Tecnología",
  "General"
];

export default function GestionProductos({ 
  almacenes: propAlmacenes, 
  onNavigateToMovimiento 
}: GestionProductosProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>(propAlmacenes || []);
  const [catalogCategorias, setCatalogCategorias] = useState<CategoriaCatalogo[]>([]);
  const [catalogUnidades, setCatalogUnidades] = useState<UnidadMedidaCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCatalogosOpen, setIsCatalogosOpen] = useState(false);
  
  // Prompt after creation: "¿Deseas registrar su entrada inicial?"
  const [createdProductPrompt, setCreatedProductPrompt] = useState<Producto | null>(null);

  // Selected product for edit / delete
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);

  // Form fields
  const [sku, setSku] = useState("");
  const [nombre, setNombre] = useState("");
  const [categoriaSelect, setCategoriaSelect] = useState("");
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [unidadSelect, setUnidadSelect] = useState("pieza");
  const [otraUnidad, setOtraUnidad] = useState("");
  const [stockMinimosPorAlmacen, setStockMinimosPorAlmacen] = useState<Record<string, number | string>>({});

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    sku?: string;
    nombre?: string;
    categoria?: string;
    unidad?: string;
    general?: string;
    [key: string]: string | undefined;
  }>({});

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

  // Synchronize warehouses from prop or realtime listener
  useEffect(() => {
    if (propAlmacenes && propAlmacenes.length > 0) {
      setAlmacenes(propAlmacenes);
    } else {
      const unsubscribe = firestoreService.getAlmacenesRealtime((data) => {
        setAlmacenes(data);
      });
      return () => unsubscribe();
    }
  }, [propAlmacenes]);

  // Real-time subscriptions for products, stock, categories and units
  useEffect(() => {
    setLoading(true);

    firestoreService.seedAndImportCatalogos();

    const unsubscribeProductos = firestoreService.getProductosRealtime((data) => {
      setProductos(data);
      setLoading(false);
    });

    const unsubscribeStock = firestoreService.getStockRealtime((data) => {
      setStockList(data);
    });

    const unsubscribeCats = firestoreService.getCategoriasRealtime((data) => {
      setCatalogCategorias(data);
    });

    const unsubscribeUnits = firestoreService.getUnidadesRealtime((data) => {
      setCatalogUnidades(data);
    });

    return () => {
      unsubscribeProductos();
      unsubscribeStock();
      unsubscribeCats();
      unsubscribeUnits();
    };
  }, []);

  // Compute all available categories dynamically
  const categoriasDisponibles = React.useMemo(() => {
    const set = new Set<string>(CATEGORIAS_POR_DEFECTO);
    catalogCategorias.forEach(c => {
      if (c.nombre && c.nombre.trim()) set.add(c.nombre.trim());
    });
    productos.forEach(p => {
      if (p.categoria && p.categoria.trim()) {
        set.add(p.categoria.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [catalogCategorias, productos]);

  // Compute category options for the form (active only for new, includes current for existing)
  const categoriasOpciones = useMemo(() => {
    const list: { id: string; nombre: string; activa: boolean }[] = [];
    
    catalogCategorias.forEach(c => {
      if (c.activa) {
        list.push(c);
      } else if (selectedProduct && selectedProduct.categoria && selectedProduct.categoria.trim().toLowerCase() === c.nombre.trim().toLowerCase()) {
        list.push(c);
      }
    });

    // Fallback if catalog was empty or selected product category not yet in list
    if (list.length === 0) {
      CATEGORIAS_POR_DEFECTO.forEach(nom => {
        list.push({ id: nom, nombre: nom, activa: true });
      });
    }

    if (selectedProduct && selectedProduct.categoria && !list.some(c => c.nombre.toLowerCase() === selectedProduct.categoria.toLowerCase())) {
      list.push({ id: "current_cat", nombre: selectedProduct.categoria, activa: false });
    }

    return list;
  }, [catalogCategorias, selectedProduct]);

  // Compute unit options for the form (active only for new, includes current for existing)
  const unidadesOpciones = useMemo(() => {
    const list: { id: string; nombre: string; abreviatura: string; activa: boolean }[] = [];
    
    catalogUnidades.forEach(u => {
      if (u.activa) {
        list.push(u);
      } else if (selectedProduct && selectedProduct.unidad && (
        selectedProduct.unidad.trim().toLowerCase() === u.abreviatura.trim().toLowerCase() ||
        selectedProduct.unidad.trim().toLowerCase() === u.nombre.trim().toLowerCase()
      )) {
        list.push(u);
      }
    });

    // Fallback if catalog was empty
    if (list.length === 0) {
      UNIDADES_ESTANDAR.filter(u => u.value !== "otra").forEach(u => {
        list.push({ id: u.value, nombre: u.label, abreviatura: u.value, activa: true });
      });
    }

    if (selectedProduct && selectedProduct.unidad) {
      const pUnit = selectedProduct.unidad.trim().toLowerCase();
      if (!list.some(u => u.abreviatura.toLowerCase() === pUnit || u.nombre.toLowerCase() === pUnit)) {
        list.push({ id: "current_unit", nombre: selectedProduct.unidad, abreviatura: pUnit, activa: false });
      }
    }

    return list;
  }, [catalogUnidades, selectedProduct]);

  // Normalize SKU: uppercase, no spaces, only A-Z, 0-9, and hyphen
  const handleSkuInputChange = (val: string) => {
    const normalized = val.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9-]/g, "");
    setSku(normalized);
    if (fieldErrors.sku) {
      setFieldErrors(prev => ({ ...prev, sku: undefined }));
    }
  };

  // Filtered products
  const filteredProductos = productos.filter(p => {
    const queryStr = searchQuery.toLowerCase().trim();
    if (!queryStr) return true;
    return (
      p.sku.toLowerCase().includes(queryStr) ||
      p.nombre.toLowerCase().includes(queryStr) ||
      p.categoria.toLowerCase().includes(queryStr)
    );
  });

  // Calculate current stock sum across all warehouses for a given SKU
  const getProductStockStatus = (productSku: string) => {
    const clean = productSku.trim().toUpperCase();
    const productStocks = stockList.filter(item => item.sku?.trim().toUpperCase() === clean);
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
    setFieldErrors({});

    if (product) {
      // Edit mode: Keep SKU exactly as is without modifying, validating or altering it
      setSelectedProduct(product);
      setSku(product.sku);
      setNombre(product.nombre);

      // Category matching
      setCategoriaSelect(product.categoria || "");
      setNuevaCategoria("");

      // Unit matching (support uds, ud, unidad, unidades, and other standard aliases)
      const currentUnitLower = (product.unidad || "").trim().toLowerCase();
      const matchUnit = catalogUnidades.find(u => 
        u.abreviatura.toLowerCase() === currentUnitLower || 
        u.nombre.toLowerCase() === currentUnitLower
      );
      if (matchUnit) {
        setUnidadSelect(matchUnit.abreviatura);
        setOtraUnidad("");
      } else if (currentUnitLower) {
        setUnidadSelect("otra");
        setOtraUnidad(product.unidad || "");
      } else {
        setUnidadSelect("uds");
        setOtraUnidad("");
      }

      // Warehouse specific minimums
      const mins: Record<string, number | string> = {};
      almacenes.forEach(alm => {
        if (product.stock_minimo_almacenes && product.stock_minimo_almacenes[alm.id] !== undefined) {
          mins[alm.id] = product.stock_minimo_almacenes[alm.id];
        } else if (product.stock_minimo !== undefined) {
          mins[alm.id] = product.stock_minimo;
        } else {
          mins[alm.id] = 0;
        }
      });
      setStockMinimosPorAlmacen(mins);
    } else {
      // Create mode
      setSelectedProduct(null);
      setSku("");
      setNombre("");
      const firstActiveCat = catalogCategorias.find(c => c.activa);
      setCategoriaSelect(firstActiveCat ? firstActiveCat.nombre : (categoriasDisponibles[0] || "General"));
      setNuevaCategoria("");
      const firstActiveUnit = catalogUnidades.find(u => u.activa);
      setUnidadSelect(firstActiveUnit ? firstActiveUnit.abreviatura : "uds");
      setOtraUnidad("");

      const initialMins: Record<string, number | string> = {};
      almacenes.forEach(alm => {
        initialMins[alm.id] = 0; // Default 0 (Alerta desactivada)
      });
      setStockMinimosPorAlmacen(initialMins);
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
    const errors: typeof fieldErrors = {};

    // 1. SKU validation: ONLY applied when creating new products
    let cleanSku = "";
    if (!selectedProduct) {
      cleanSku = sku.trim().toUpperCase();
      if (!cleanSku) {
        errors.sku = "El SKU del producto es obligatorio.";
      } else if (!/^[A-Z0-9-]+$/.test(cleanSku)) {
        errors.sku = "El SKU solo puede contener letras mayúsculas, números y guiones (-).";
      }
    }

    // 2. Nombre validation
    const cleanNombre = nombre.trim();
    if (!cleanNombre) {
      errors.nombre = "El nombre del producto es obligatorio.";
    }

    // 3. Category validation
    let finalCategoria = categoriaSelect.trim();
    if (categoriaSelect === "__NEW__") {
      finalCategoria = nuevaCategoria.trim();
      if (!finalCategoria) {
        errors.categoria = "Ingresa el nombre de la nueva categoría.";
      }
    } else if (!categoriaSelect) {
      errors.categoria = "Selecciona una categoría para el producto.";
    }

    // 4. Unit validation
    let finalUnidad = unidadSelect.trim();
    if (unidadSelect === "otra") {
      finalUnidad = otraUnidad.trim().toLowerCase();
      if (!finalUnidad) {
        errors.unidad = "Especifica la unidad de medida personalizada.";
      }
    }

    // 5. Stock minimums per warehouse validation
    const finalStockMinimosPorAlmacen: Record<string, number> = {};
    almacenes.forEach(alm => {
      const rawVal = stockMinimosPorAlmacen[alm.id];
      const numVal = Number(rawVal);
      if (isNaN(numVal) || numVal < 0) {
        errors[`min_${alm.id}`] = "El valor debe ser 0 o mayor.";
        finalStockMinimosPorAlmacen[alm.id] = 0;
      } else {
        finalStockMinimosPorAlmacen[alm.id] = Math.floor(numVal);
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitLoading(true);
    setFieldErrors({});

    try {
      // If user created a new category inline, register into catalog
      if (categoriaSelect === "__NEW__" && finalCategoria) {
        try {
          await firestoreService.addCategoria(finalCategoria);
        } catch (e) {
          // Ignore if duplicate
        }
      }

      // If user specified custom unit inline, register into catalog
      if (unidadSelect === "otra" && finalUnidad) {
        try {
          const capName = finalUnidad.charAt(0).toUpperCase() + finalUnidad.slice(1);
          await firestoreService.addUnidad(capName, finalUnidad.toLowerCase());
        } catch (e) {
          // Ignore if duplicate
        }
      }

      if (selectedProduct) {
        // Edit mode (SKU cannot be changed and is kept intact without modification or validation)
        const updatedProductData: Partial<Omit<Producto, "sku">> = {
          nombre: cleanNombre,
          categoria: finalCategoria,
          stock_minimo_almacenes: finalStockMinimosPorAlmacen,
          stock_minimo: Math.max(0, ...Object.values(finalStockMinimosPorAlmacen)), // Fallback legacy
          unidad: finalUnidad
        };

        await firestoreService.updateProduct(selectedProduct.sku, updatedProductData);
        setIsFormOpen(false);
      } else {
        // Create mode: Verify duplicate SKU in Firebase / store
        const isDuplicate = await firestoreService.checkSkuExists(cleanSku);
        if (isDuplicate) {
          setFieldErrors({
            sku: `El SKU "${cleanSku}" ya está registrado en el catálogo. Usa uno diferente.`
          });
          setSubmitLoading(false);
          return;
        }

        const newProduct: Producto = {
          sku: cleanSku,
          nombre: cleanNombre,
          categoria: finalCategoria,
          stock_minimo_almacenes: finalStockMinimosPorAlmacen,
          stock_minimo: Math.max(0, ...Object.values(finalStockMinimosPorAlmacen)), // Fallback legacy
          unidad: finalUnidad
        };

        // Note: No automatic stock is recorded here; stock remains 0 until movement
        await firestoreService.addProduct(newProduct);
        setIsFormOpen(false);

        // Open prompt: "¿Deseas registrar su entrada inicial?"
        setCreatedProductPrompt(newProduct);
      }
    } catch (err: any) {
      console.error("Error al guardar el producto:", err);
      setFieldErrors({
        general: err.message || "Ocurrió un error al guardar el producto en la base de datos."
      });
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
      console.error("Error al eliminar producto:", err);
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

      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        setImportResults({
          successCount: 0,
          errors: ["El archivo CSV debe incluir una cabecera y al menos una fila de productos."],
          skippedCount: 0
        });
        setSubmitLoading(false);
        return;
      }

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

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
        if (cols.length < Math.max(skuIdx, nombreIdx) + 1) {
          errors.push(`Fila ${i + 1}: Columnas insuficientes.`);
          continue;
        }

        const rawSku = cols[skuIdx];
        const rawNombre = cols[nombreIdx];
        const rawCategoria = categoriaIdx !== -1 && cols[categoriaIdx] ? cols[categoriaIdx] : "General";
        const rawStockMin = stockMinIdx !== -1 ? Number(cols[stockMinIdx]) : 0;
        const rawUnidad = unidadIdx !== -1 && cols[unidadIdx] ? cols[unidadIdx] : "pieza";

        if (!rawSku || !rawNombre) {
          errors.push(`Fila ${i + 1}: SKU y Nombre del producto son requeridos.`);
          continue;
        }

        const formattedSku = rawSku.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9-]/g, "");
        if (!/^[A-Z0-9-]+$/.test(formattedSku)) {
          errors.push(`Fila ${i + 1} (${formattedSku}): Formato de SKU no válido.`);
          continue;
        }

        const isDuplicate = productos.some(p => p.sku.toUpperCase() === formattedSku);
        if (isDuplicate) {
          skippedCount++;
          errors.push(`Fila ${i + 1} (${formattedSku}): El SKU ya existe en la base de datos (Omitido).`);
          continue;
        }

        try {
          const warehouseMins: Record<string, number> = {};
          almacenes.forEach(alm => {
            warehouseMins[alm.id] = isNaN(rawStockMin) ? 0 : Math.max(0, rawStockMin);
          });

          await firestoreService.addProduct({
            sku: formattedSku,
            nombre: rawNombre,
            categoria: rawCategoria || "General",
            stock_minimo_almacenes: warehouseMins,
            stock_minimo: isNaN(rawStockMin) ? 0 : rawStockMin,
            unidad: rawUnidad || "pieza"
          });
          successCount++;
        } catch (err: any) {
          errors.push(`Fila ${i + 1} (${formattedSku}): Error al guardar el producto - ${err.message || err}`);
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
            Gestiona la lista maestra de productos, categorías, unidades de medida y alertas de stock mínimo por almacén.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              setImportResults(null);
              setCsvFile(null);
              setIsImportOpen(true);
            }}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 font-semibold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 text-sm focus:outline-none"
          >
            <Upload className="h-4 w-4 text-slate-400" />
            <span>Importar CSV</span>
          </button>

          <button
            onClick={() => setIsCatalogosOpen(true)}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 font-semibold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 text-sm focus:outline-none"
          >
            <FolderTree className="h-4 w-4 text-emerald-400" />
            <span>Administrar catálogos</span>
          </button>
          
          <button
            onClick={() => openFormModal(null)}
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center space-x-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Plus className="h-4 w-4" />
            <span>Crear producto</span>
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
          <p className="text-sm font-medium">Cargando catálogo de productos...</p>
        </div>
      ) : filteredProductos.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="bg-slate-950 inline-flex p-4 rounded-full text-slate-600 mb-4">
            <Package className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-1">Catálogo de productos vacío</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {searchQuery ? "No se encontraron productos que coincidan con la búsqueda." : "Crea tu primer producto con el botón 'Crear producto' o importa una lista con archivo CSV."}
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
                  <th className="py-4 px-6">Nombre del Producto</th>
                  <th className="py-4 px-6">Categoría</th>
                  <th className="py-4 px-6">U. de Medida</th>
                  <th className="py-4 px-6">Stock Mínimo (Almacenes)</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProductos.map((p) => {
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
                      <td className="py-4 px-6 text-slate-300 text-sm font-medium capitalize">
                        {p.unidad}
                      </td>
                      <td className="py-4 px-6 text-slate-300 text-xs">
                        {p.stock_minimo_almacenes && Object.keys(p.stock_minimo_almacenes).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {almacenes.map(alm => {
                              const minVal = p.stock_minimo_almacenes?.[alm.id] ?? 0;
                              return (
                                <span 
                                  key={alm.id}
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${
                                    minVal > 0 
                                      ? "bg-slate-950 border-slate-800 text-slate-300" 
                                      : "bg-slate-950/40 border-slate-850 text-slate-500"
                                  }`}
                                  title={`${alm.nombre}: ${minVal > 0 ? `${minVal} ${p.unidad}(s)` : "Alerta desactivada"}`}
                                >
                                  <span className="text-slate-400 font-medium mr-1">{alm.nombre.split(" ")[0]}:</span>
                                  <span className={minVal > 0 ? "font-semibold text-emerald-400" : "text-slate-500"}>
                                    {minVal > 0 ? minVal : "Off"}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            {p.stock_minimo > 0 ? `${p.stock_minimo} ${p.unidad}(s) (Global)` : "Sin alerta"}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openFormModal(p)}
                            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
                            title="Editar producto"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(p)}
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
                            title="Eliminar producto"
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
              return (
                <div key={p.sku} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-950 p-2.5 rounded-xl text-emerald-400 border border-slate-800">
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
                      <span className="bg-slate-950 px-2 py-0.5 border border-slate-800 rounded text-slate-300">
                        {p.categoria}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">U. de Medida:</span>
                      <span className="text-slate-200 font-semibold capitalize">{p.unidad}</span>
                    </div>
                  </div>

                  {/* Warehouse minimums on mobile */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-500 block mb-1 font-medium">Stock mínimo por almacén:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {almacenes.map(alm => {
                        const minVal = p.stock_minimo_almacenes?.[alm.id] ?? p.stock_minimo ?? 0;
                        return (
                          <span 
                            key={alm.id}
                            className="bg-slate-950 px-2 py-0.5 border border-slate-850 rounded text-[10px] text-slate-300"
                          >
                            <span className="text-slate-400">{alm.nombre}: </span>
                            <span className={minVal > 0 ? "font-bold text-emerald-400" : "text-slate-500"}>
                              {minVal > 0 ? minVal : "Off"}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* FORM MODAL (CREATE / EDIT PRODUCT) */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!submitLoading) setIsFormOpen(false);
              }}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />

              <button
                onClick={() => {
                  if (!submitLoading) setIsFormOpen(false);
                }}
                disabled={submitLoading}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all disabled:opacity-40 z-10"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Modal Header (Fixed at top) */}
              <div className="p-6 pb-4 flex items-center space-x-3 shrink-0 border-b border-slate-800/80">
                <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-400 border border-emerald-500/10">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">
                    {selectedProduct ? "Editar Producto" : "Crear Nuevo Producto"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Define la ficha técnica del producto y sus límites de stock mínimo por almacén.
                  </p>
                </div>
              </div>

              {/* Form with scrollable body and fixed footer */}
              <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Scrollable central content */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
                  {/* General Form Error Banner */}
                  {fieldErrors.general && (
                    <div className="bg-rose-950/40 border border-rose-800 text-rose-300 px-4 py-3 rounded-xl flex items-start space-x-2 text-xs">
                      <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{fieldErrors.general}</span>
                    </div>
                  )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* SKU FIELD */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>SKU del Producto {!selectedProduct && <span className="text-emerald-400">*</span>}</span>
                      {selectedProduct && (
                        <span className="text-[10px] text-slate-400 font-normal lowercase bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          solo lectura
                        </span>
                      )}
                    </label>
                    {selectedProduct ? (
                      <div className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 text-slate-300 text-sm rounded-xl font-mono select-all flex items-center justify-between">
                        <span>{selectedProduct.sku}</span>
                        <span className="text-[11px] text-slate-500 font-sans">Identificador maestro</span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        required
                        disabled={submitLoading}
                        placeholder="Ej. PLAS-POLO-01"
                        value={sku}
                        onChange={(e) => handleSkuInputChange(e.target.value)}
                        className={`w-full px-4 py-2.5 bg-slate-950 border ${
                          fieldErrors.sku ? "border-rose-500 focus:border-rose-500" : "border-slate-800 focus:border-slate-700"
                        } text-slate-200 text-sm rounded-xl focus:outline-none transition-all placeholder:text-slate-700 font-mono uppercase`}
                      />
                    )}
                    {fieldErrors.sku && !selectedProduct ? (
                      <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{fieldErrors.sku}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 leading-tight">
                        {selectedProduct 
                          ? "El SKU es un identificador permanente y se conserva intacto para proteger los registros históricos." 
                          : "Solo letras mayúsculas, números y guiones (-). No podrá modificarse una vez creado."}
                      </p>
                    )}
                  </div>

                  {/* NOMBRE DEL PRODUCTO */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Nombre del Producto <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={submitLoading}
                      placeholder="Ej. Tapa de Polipropileno 28mm"
                      value={nombre}
                      onChange={(e) => {
                        setNombre(e.target.value);
                        if (fieldErrors.nombre) {
                          setFieldErrors(prev => ({ ...prev, nombre: undefined }));
                        }
                      }}
                      className={`w-full px-4 py-2.5 bg-slate-950 border ${
                        fieldErrors.nombre ? "border-rose-500 focus:border-rose-500" : "border-slate-800 focus:border-slate-700"
                      } text-slate-200 text-sm rounded-xl focus:outline-none transition-all placeholder:text-slate-700`}
                    />
                    {fieldErrors.nombre && (
                      <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{fieldErrors.nombre}</span>
                      </p>
                    )}
                  </div>

                  {/* CATEGORÍA SELECTOR & CREAR NUEVA */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Categoría del Producto <span className="text-emerald-400">*</span>
                    </label>
                    <select
                      value={categoriaSelect}
                      disabled={submitLoading}
                      onChange={(e) => {
                        setCategoriaSelect(e.target.value);
                        if (fieldErrors.categoria) {
                          setFieldErrors(prev => ({ ...prev, categoria: undefined }));
                        }
                      }}
                      className={`w-full px-4 py-2.5 bg-slate-950 border ${
                        fieldErrors.categoria ? "border-rose-500 focus:border-rose-500" : "border-slate-800 focus:border-slate-700"
                      } text-slate-200 text-sm rounded-xl focus:outline-none transition-all`}
                    >
                      <option value="" disabled>-- Seleccionar categoría --</option>
                      {categoriasOpciones.map((cat) => (
                        <option key={cat.id || cat.nombre} value={cat.nombre}>
                          {cat.nombre} {!cat.activa ? "(Desactivada)" : ""}
                        </option>
                      ))}
                      <option value="__NEW__" className="text-emerald-400 font-semibold">
                        ➕ Crear nueva categoría...
                      </option>
                    </select>

                    {/* Input extra si seleccionó "Crear nueva categoría" */}
                    {categoriaSelect === "__NEW__" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="pt-1.5"
                      >
                        <input
                          type="text"
                          required
                          disabled={submitLoading}
                          placeholder="Escribe el nombre de la nueva categoría..."
                          value={nuevaCategoria}
                          onChange={(e) => {
                            setNuevaCategoria(e.target.value);
                            if (fieldErrors.categoria) {
                              setFieldErrors(prev => ({ ...prev, categoria: undefined }));
                            }
                          }}
                          className="w-full px-4 py-2 bg-slate-950 border border-emerald-500/60 focus:border-emerald-500 text-slate-200 text-sm rounded-xl focus:outline-none transition-all placeholder:text-slate-700"
                        />
                      </motion.div>
                    )}

                    {fieldErrors.categoria && (
                      <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{fieldErrors.categoria}</span>
                      </p>
                    )}
                  </div>

                  {/* UNIDAD DE MEDIDA ESTANDARIZADA */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Unidad de Medida <span className="text-emerald-400">*</span>
                    </label>
                    <select
                      value={unidadSelect}
                      disabled={submitLoading}
                      onChange={(e) => {
                        setUnidadSelect(e.target.value);
                        if (fieldErrors.unidad) {
                          setFieldErrors(prev => ({ ...prev, unidad: undefined }));
                        }
                      }}
                      className={`w-full px-4 py-2.5 bg-slate-950 border ${
                        fieldErrors.unidad ? "border-rose-500 focus:border-rose-500" : "border-slate-800 focus:border-slate-700"
                      } text-slate-200 text-sm rounded-xl focus:outline-none transition-all`}
                    >
                      {unidadesOpciones.map((u) => (
                        <option key={u.id || u.abreviatura} value={u.abreviatura}>
                          {u.nombre} ({u.abreviatura}) {!u.activa ? "(Desactivada)" : ""}
                        </option>
                      ))}
                      <option value="otra" className="text-emerald-400 font-semibold">
                        ➕ Otra unidad (especificar)...
                      </option>
                    </select>

                    {/* Input extra si seleccionó "otra" */}
                    {unidadSelect === "otra" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="pt-1.5"
                      >
                        <input
                          type="text"
                          required
                          disabled={submitLoading}
                          placeholder="Especifica la unidad (ej. par, tonelada, millar)..."
                          value={otraUnidad}
                          onChange={(e) => {
                            setOtraUnidad(e.target.value);
                            if (fieldErrors.unidad) {
                              setFieldErrors(prev => ({ ...prev, unidad: undefined }));
                            }
                          }}
                          className="w-full px-4 py-2 bg-slate-950 border border-emerald-500/60 focus:border-emerald-500 text-slate-200 text-sm rounded-xl focus:outline-none transition-all placeholder:text-slate-700"
                        />
                      </motion.div>
                    )}

                    {fieldErrors.unidad && (
                      <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{fieldErrors.unidad}</span>
                      </p>
                    )}
                  </div>
                </div>

                  {/* STOCK MÍNIMO POR ALMACÉN ACTIVO */}
                  <div className="pt-3 border-t border-slate-800/90 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Warehouse className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Stock Mínimo por Almacén</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Define el límite de alerta de resurtido para cada almacén. El valor <span className="font-semibold text-slate-300">0</span> desactiva la alerta.
                        </p>
                      </div>
                    </div>

                    {almacenes.length === 0 ? (
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-500 text-center">
                        No hay almacenes activos registrados. Se guardará sin alertas específicas de almacén.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {almacenes.map((alm) => {
                          const rawVal = stockMinimosPorAlmacen[alm.id] ?? 0;
                          const numVal = Number(rawVal);
                          const isAlertOff = numVal === 0 || isNaN(numVal);
                          const currentUnitText = unidadSelect === "otra" && otraUnidad.trim() ? otraUnidad.trim() : (UNIDADES_ESTANDAR.find(u => u.value === unidadSelect)?.label.split(" ")[0].toLowerCase() || unidadSelect);

                          return (
                            <div 
                              key={alm.id}
                              className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 hover:border-slate-700 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="font-semibold text-slate-200 text-xs block">{alm.nombre}</span>
                                  <span className="text-[10px] text-slate-500 block">{alm.ubicacion}</span>
                                </div>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                  isAlertOff 
                                    ? "bg-slate-900 border-slate-800 text-slate-500" 
                                    : "bg-emerald-950/60 border-emerald-800 text-emerald-400"
                                }`}>
                                  {isAlertOff ? "Alerta desactivada (0)" : `Alerta: ≤ ${numVal} ${currentUnitText}`}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <label className="text-[11px] text-slate-400 shrink-0">Mínimo:</label>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  disabled={submitLoading}
                                  value={rawVal}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setStockMinimosPorAlmacen(prev => ({
                                      ...prev,
                                      [alm.id]: v === "" ? "" : Math.max(0, Number(v))
                                    }));
                                  }}
                                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none transition-all font-mono"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer Controls (Fixed at bottom) */}
                <div className="p-5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end space-x-3 shrink-0">
                  <button
                    type="button"
                    disabled={submitLoading}
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 font-semibold rounded-xl text-xs transition-colors disabled:opacity-40"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center space-x-2 disabled:opacity-50 shadow-md shadow-emerald-500/10"
                  >
                    {submitLoading ? (
                      <>
                        <span className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        <span>Guardando producto...</span>
                      </>
                    ) : (
                      <span>{selectedProduct ? "Guardar cambios" : "Crear producto"}</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROMPT MODAL: "¿Deseas registrar su entrada inicial?" */}
      <AnimatePresence>
        {createdProductPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreatedProductPrompt(null)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />

              <button
                onClick={() => setCreatedProductPrompt(null)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex flex-col items-center text-center p-1">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-full mb-4 text-emerald-400">
                  <Sparkles className="h-8 w-8" />
                </div>

                <h3 className="text-lg font-bold text-slate-100">
                  ¡Producto creado correctamente!
                </h3>

                <p className="text-slate-300 text-sm mt-2 font-medium">
                  ¿Deseas registrar su entrada inicial?
                </p>

                {/* Product Summary Badge */}
                <div className="w-full my-4 bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-left font-mono text-xs text-slate-300 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">SKU:</span>
                    <span className="text-emerald-400 font-bold">{createdProductPrompt.sku}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nombre:</span>
                    <span className="text-slate-200 truncate max-w-[200px]">{createdProductPrompt.nombre}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Categoría:</span>
                    <span className="text-slate-400">{createdProductPrompt.categoria}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Unidad:</span>
                    <span className="text-slate-400 capitalize">{createdProductPrompt.unidad}</span>
                  </div>
                </div>

                <div className="w-full flex flex-col sm:flex-row gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setCreatedProductPrompt(null)}
                    className="w-full sm:w-1/2 px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 font-semibold rounded-xl text-xs transition-colors"
                  >
                    No, continuar en catálogo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const skuToPreselect = createdProductPrompt.sku;
                      setCreatedProductPrompt(null);
                      if (onNavigateToMovimiento) {
                        onNavigateToMovimiento(skuToPreselect);
                      }
                    }}
                    className="w-full sm:w-1/2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-500/10"
                  >
                    <span>Sí, registrar entrada</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
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
                    {hasStock ? "Bloqueado: Producto con inventario activo" : "¿Eliminar producto del catálogo?"}
                  </h3>

                  <p className="text-slate-400 text-xs mt-2 leading-relaxed font-sans">
                    {hasStock 
                      ? `Este producto tiene actualmente stock disponible (${totalQty} ${selectedProduct.unidad}) registrado en tus almacenes. Para proteger la integridad histórica de tu inventario, primero debes liquidar, transferir o dar salida a la mercadería existente de este SKU.`
                      : `¿Estás completamente seguro de eliminar el producto "${selectedProduct.nombre}" (SKU: ${selectedProduct.sku}) del catálogo maestro? Esta acción es definitiva.`}
                  </p>

                  <div className="w-full mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsDeleteOpen(false)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 font-semibold rounded-xl text-xs transition-colors"
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
                  <h3 className="text-lg font-bold text-slate-100">Importación Masiva de Productos (CSV)</h3>
                  <p className="text-xs text-slate-400">
                    Carga el catálogo de productos de la empresa mediante un archivo plano CSV.
                  </p>
                </div>
              </div>

              {/* CSV Spec Guidelines */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-2 shrink-0 mb-4">
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
                  <span className="font-mono text-slate-500 text-xs">POLO-MET-01,"Tornillo Hexagonal 3/8",Cerrajería Metálica,100,pieza</span>
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
                        <span>¡Procesamiento de productos completo!</span>
                      </h4>
                      <div className="grid grid-cols-3 gap-2.5 text-center">
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                          <span className="text-2xl font-bold text-emerald-400">{importResults.successCount}</span>
                          <span className="block text-[10px] text-slate-500 uppercase mt-0.5 font-semibold">Cargados</span>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                          <span className="text-2xl font-bold text-amber-400">{importResults.skippedCount}</span>
                          <span className="block text-[10px] text-slate-500 uppercase mt-0.5 font-semibold">Omitidos</span>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                          <span className="text-2xl font-bold text-rose-400">{importResults.errors.length}</span>
                          <span className="block text-[10px] text-slate-500 uppercase mt-0.5 font-semibold">Alertas</span>
                        </div>
                      </div>
                    </div>

                    {/* Detailed errors list */}
                    {importResults.errors.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bitácora de Advertencias/Errores:</h5>
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-40 overflow-y-auto font-mono text-[10px] text-slate-400 divide-y divide-slate-900">
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
                  className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 font-semibold rounded-xl text-xs transition-colors"
                >
                  Cerrar ventana
                </button>
                {csvFile && !importResults && (
                  <button
                    type="button"
                    onClick={processCSV}
                    disabled={submitLoading}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center space-x-1.5 disabled:opacity-50"
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

      {/* Administrar Catálogos Modal */}
      <ModalCatalogos
        isOpen={isCatalogosOpen}
        onClose={() => setIsCatalogosOpen(false)}
        productos={productos}
      />
    </div>
  );
}
