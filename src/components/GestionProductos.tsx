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
    <div className="max-w-7xl mx-auto px-3.5 sm:px-5 lg:px-6 py-5" id="gestion-productos-view">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-5 gap-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-[#172033] tracking-tight leading-tight">
            Catálogo de Productos
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Gestiona la lista maestra de productos, categorías, unidades de medida y alertas de stock mínimo por almacén.
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0">
          <button
            onClick={() => {
              setImportResults(null);
              setCsvFile(null);
              setIsImportOpen(true);
            }}
            className="flex-1 sm:flex-initial bg-white hover:bg-[#F1F5F9] text-[#172033] border border-[#E2E8F0] font-semibold px-3 py-2 rounded-lg transition-all flex items-center justify-center space-x-1.5 text-xs focus:outline-none shadow-xs"
          >
            <Upload className="h-3.5 w-3.5 text-[#64748B]" />
            <span>Importar CSV</span>
          </button>

          <button
            onClick={() => setIsCatalogosOpen(true)}
            className="flex-1 sm:flex-initial bg-white hover:bg-[#F1F5F9] text-[#172033] border border-[#E2E8F0] font-semibold px-3 py-2 rounded-lg transition-all flex items-center justify-center space-x-1.5 text-xs focus:outline-none shadow-xs"
          >
            <FolderTree className="h-3.5 w-3.5 text-[#059669]" />
            <span>Administrar catálogos</span>
          </button>
          
          <button
            onClick={() => openFormModal(null)}
            className="w-full sm:w-auto bg-[#059669] hover:bg-[#047857] text-white font-semibold px-3.5 py-2 rounded-lg transition-all shadow-xs flex items-center justify-center space-x-1.5 text-xs focus:outline-none"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Crear producto</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 mb-4 shadow-xs">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-3.5 w-3.5 text-[#64748B]" />
          </div>
          <input
            type="text"
            placeholder="Buscar por SKU, nombre o categoría..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#E2E8F0] text-[#172033] text-xs sm:text-sm rounded-lg focus:outline-none focus:border-[#059669] transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")} 
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#64748B] hover:text-[#172033]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Products list */}
      {loading ? (
        <div className="py-14 text-center text-[#64748B]">
          <span className="h-6 w-6 border-2 border-[#059669] border-t-transparent rounded-full animate-spin inline-block mb-2" />
          <p className="text-xs font-medium">Cargando catálogo de productos...</p>
        </div>
      ) : filteredProductos.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center shadow-xs">
          <div className="bg-[#F8FAFC] inline-flex p-3 rounded-full text-slate-400 mb-2.5">
            <Package className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-[#172033] mb-0.5">Catálogo de productos vacío</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            {searchQuery ? "No se encontraron productos que coincidan con la búsqueda." : "Crea tu primer producto con el botón 'Crear producto' o importa una lista con archivo CSV."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-hidden bg-white border border-[#E2E8F0] rounded-xl shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                  <th className="py-2.5 px-4">SKU / ID</th>
                  <th className="py-2.5 px-4">Nombre del Producto</th>
                  <th className="py-2.5 px-4">Categoría</th>
                  <th className="py-2.5 px-4">U. de Medida</th>
                  <th className="py-2.5 px-4">Stock Mínimo (Almacenes)</th>
                  <th className="py-2.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs sm:text-sm">
                {filteredProductos.map((p) => {
                  return (
                    <tr key={p.sku} className="hover:bg-[#F1F5F9] transition-colors group">
                      <td className="py-2.5 px-4 font-mono text-[11px] text-[#64748B] font-semibold">
                        {p.sku}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="bg-[#ECFDF5] p-1.5 rounded-md text-[#059669] border border-emerald-200">
                            <Package className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-semibold text-[#172033] group-hover:text-[#059669] transition-colors">
                            {p.nombre}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="bg-[#F8FAFC] px-2 py-0.5 text-xs text-[#172033] border border-[#E2E8F0] rounded-md">
                          {p.categoria}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[#172033] text-xs font-medium capitalize">
                        {p.unidad}
                      </td>
                      <td className="py-2.5 px-4 text-[#172033] text-xs">
                        {(() => {
                          const configuredAlmacenes = almacenes.filter(alm => (p.stock_minimo_almacenes?.[alm.id] ?? 0) > 0);
                          const totalConfigured = configuredAlmacenes.length;
                          const tooltipLines = almacenes.map(alm => {
                            const val = p.stock_minimo_almacenes?.[alm.id] ?? 0;
                            return `${alm.nombre}: ${val > 0 ? `${val} ${p.unidad || "uds"}` : "Sin alerta"}`;
                          }).join(" • ");

                          if (totalConfigured > 0) {
                            return (
                              <span 
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#F8FAFC] border border-[#E2E8F0] text-[#172033] cursor-default"
                                title={tooltipLines}
                              >
                                <span className="font-semibold text-[#059669] mr-1">{totalConfigured}</span>
                                <span>{totalConfigured === 1 ? "almacén configurado" : "almacenes configurados"}</span>
                              </span>
                            );
                          } else if (p.stock_minimo && p.stock_minimo > 0) {
                            return (
                              <span className="text-[#172033] text-xs font-medium">
                                {p.stock_minimo} {p.unidad || "uds"} · mínimo global
                              </span>
                            );
                          } else {
                            return (
                              <span className="text-[#64748B] text-xs">
                                Sin alertas activas
                              </span>
                            );
                          }
                        })()}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => openFormModal(p)}
                            className="p-1.5 text-[#64748B] hover:text-[#059669] hover:bg-[#F1F5F9] rounded-md transition-colors"
                            title="Editar producto"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(p)}
                            className="p-1.5 text-[#64748B] hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Eliminar producto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
            {filteredProductos.map((p) => {
              const configuredAlmacenes = almacenes.filter(alm => (p.stock_minimo_almacenes?.[alm.id] ?? 0) > 0);
              const totalConfigured = configuredAlmacenes.length;
              const tooltipLines = almacenes.map(alm => {
                const val = p.stock_minimo_almacenes?.[alm.id] ?? 0;
                return `${alm.nombre}: ${val > 0 ? `${val} ${p.unidad || "uds"}` : "Sin alerta"}`;
              }).join(" • ");

              return (
                <div key={p.sku} className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 space-y-2.5 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="bg-[#ECFDF5] p-2 rounded-lg text-[#059669] border border-emerald-200">
                        <Package className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-[#172033] text-sm">{p.nombre}</h4>
                        <span className="font-mono text-[10px] text-[#64748B] uppercase">{p.sku}</span>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => openFormModal(p)}
                        className="p-1.5 text-[#64748B] hover:text-[#059669] hover:bg-[#F1F5F9] rounded-md transition-colors"
                        title="Editar producto"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(p)}
                        className="p-1.5 text-[#64748B] hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        title="Eliminar producto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 gap-x-2 pt-1 text-xs">
                    <div>
                      <span className="text-[#64748B] block text-[11px] mb-0.5">Categoría:</span>
                      <span className="bg-[#F8FAFC] px-2 py-0.5 border border-[#E2E8F0] rounded text-[#172033] text-xs">
                        {p.categoria}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[11px] mb-0.5">U. de Medida:</span>
                      <span className="text-[#172033] font-semibold capitalize text-xs">{p.unidad}</span>
                    </div>
                  </div>

                  {/* Warehouse minimums on mobile */}
                  <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B]">Mínimos por almacén:</span>
                    <span 
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F8FAFC] border border-[#E2E8F0] text-[#172033]"
                      title={tooltipLines}
                    >
                      {totalConfigured > 0 ? (
                        <>
                          <span className="font-semibold text-[#059669] mr-1">{totalConfigured}</span>
                          <span>{totalConfigured === 1 ? "almacén" : "almacenes"}</span>
                        </>
                      ) : p.stock_minimo && p.stock_minimo > 0 ? (
                        <span>{p.stock_minimo} {p.unidad || "uds"} · global</span>
                      ) : (
                        <span className="text-[#64748B]">Sin alertas</span>
                      )}
                    </span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!submitLoading) setIsFormOpen(false);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-xl bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
            >
              <button
                onClick={() => {
                  if (!submitLoading) setIsFormOpen(false);
                }}
                disabled={submitLoading}
                className="absolute top-3 right-3 p-1.5 text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] rounded-lg transition-all disabled:opacity-40 z-10"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Modal Header (Fixed at top) */}
              <div className="p-4 flex items-center space-x-2.5 shrink-0 border-b border-[#E2E8F0]">
                <div className="bg-[#ECFDF5] p-2 rounded-lg text-[#059669] border border-emerald-200">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172033] leading-tight">
                    {selectedProduct ? "Editar Producto" : "Crear Nuevo Producto"}
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Define la ficha técnica del producto y sus límites de stock mínimo por almacén.
                  </p>
                </div>
              </div>

              {/* Form with scrollable body and fixed footer */}
              <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Scrollable central content */}
                <div className="p-4 space-y-3.5 overflow-y-auto flex-1 min-h-0">
                  {/* General Form Error Banner */}
                  {fieldErrors.general && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg flex items-start space-x-2 text-xs">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span>{fieldErrors.general}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    
                    {/* SKU FIELD */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#172033] uppercase tracking-wider flex items-center justify-between">
                        <span>SKU del Producto {!selectedProduct && <span className="text-[#059669]">*</span>}</span>
                        {selectedProduct && (
                          <span className="text-[9px] text-[#64748B] font-normal lowercase bg-[#F8FAFC] px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                            solo lectura
                          </span>
                        )}
                      </label>
                      {selectedProduct ? (
                        <div className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] text-[#172033] text-xs rounded-lg font-mono select-all flex items-center justify-between">
                          <span>{selectedProduct.sku}</span>
                          <span className="text-[10px] text-[#64748B] font-sans">Identificador maestro</span>
                        </div>
                      ) : (
                        <input
                          type="text"
                          required
                          disabled={submitLoading}
                          placeholder="Ej. PLAS-POLO-01"
                          value={sku}
                          onChange={(e) => handleSkuInputChange(e.target.value)}
                          className={`w-full px-3 py-1.5 bg-white border ${
                            fieldErrors.sku ? "border-rose-500" : "border-[#E2E8F0]"
                          } text-[#172033] text-xs rounded-lg focus:outline-none focus:border-[#059669] transition-all placeholder:text-slate-400 font-mono uppercase`}
                        />
                      )}
                      {fieldErrors.sku && !selectedProduct ? (
                        <p className="text-[11px] text-rose-600 flex items-center gap-1 mt-0.5">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span>{fieldErrors.sku}</span>
                        </p>
                      ) : (
                        <p className="text-[10px] text-[#64748B] leading-tight">
                          {selectedProduct 
                            ? "El SKU es permanente para proteger los registros históricos." 
                            : "Solo letras mayúsculas, números y guiones (-)."}
                        </p>
                      )}
                    </div>

                    {/* NOMBRE DEL PRODUCTO */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#172033] uppercase tracking-wider">
                        Nombre del Producto <span className="text-[#059669]">*</span>
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
                        className={`w-full px-3 py-1.5 bg-white border ${
                          fieldErrors.nombre ? "border-rose-500" : "border-[#E2E8F0]"
                        } text-[#172033] text-xs rounded-lg focus:outline-none focus:border-[#059669] transition-all placeholder:text-slate-400`}
                      />
                      {fieldErrors.nombre && (
                        <p className="text-[11px] text-rose-600 flex items-center gap-1 mt-0.5">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span>{fieldErrors.nombre}</span>
                        </p>
                      )}
                    </div>

                    {/* CATEGORÍA SELECTOR & CREAR NUEVA */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#172033] uppercase tracking-wider">
                        Categoría del Producto <span className="text-[#059669]">*</span>
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
                        className={`w-full px-3 py-1.5 bg-white border ${
                          fieldErrors.categoria ? "border-rose-500" : "border-[#E2E8F0]"
                        } text-[#172033] text-xs rounded-lg focus:outline-none focus:border-[#059669] transition-all`}
                      >
                        <option value="" disabled>-- Seleccionar categoría --</option>
                        {categoriasOpciones.map((cat) => (
                          <option key={cat.id || cat.nombre} value={cat.nombre}>
                            {cat.nombre} {!cat.activa ? "(Desactivada)" : ""}
                          </option>
                        ))}
                        <option value="__NEW__" className="text-[#059669] font-semibold">
                          ➕ Crear nueva categoría...
                        </option>
                      </select>

                      {/* Input extra si seleccionó "Crear nueva categoría" */}
                      {categoriaSelect === "__NEW__" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="pt-1"
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
                            className="w-full px-3 py-1.5 bg-white border border-[#059669] text-[#172033] text-xs rounded-lg focus:outline-none transition-all placeholder:text-slate-400"
                          />
                        </motion.div>
                      )}

                      {fieldErrors.categoria && (
                        <p className="text-[11px] text-rose-600 flex items-center gap-1 mt-0.5">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span>{fieldErrors.categoria}</span>
                        </p>
                      )}
                    </div>

                    {/* UNIDAD DE MEDIDA ESTANDARIZADA */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#172033] uppercase tracking-wider">
                        Unidad de Medida <span className="text-[#059669]">*</span>
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
                        className={`w-full px-3 py-1.5 bg-white border ${
                          fieldErrors.unidad ? "border-rose-500" : "border-[#E2E8F0]"
                        } text-[#172033] text-xs rounded-lg focus:outline-none focus:border-[#059669] transition-all`}
                      >
                        {unidadesOpciones.map((u) => (
                          <option key={u.id || u.abreviatura} value={u.abreviatura}>
                            {u.nombre} ({u.abreviatura}) {!u.activa ? "(Desactivada)" : ""}
                          </option>
                        ))}
                        <option value="otra" className="text-[#059669] font-semibold">
                          ➕ Otra unidad (especificar)...
                        </option>
                      </select>

                      {/* Input extra si seleccionó "otra" */}
                      {unidadSelect === "otra" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="pt-1"
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
                            className="w-full px-3 py-1.5 bg-white border border-[#059669] text-[#172033] text-xs rounded-lg focus:outline-none transition-all placeholder:text-slate-400"
                          />
                        </motion.div>
                      )}

                      {fieldErrors.unidad && (
                        <p className="text-[11px] text-rose-600 flex items-center gap-1 mt-0.5">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span>{fieldErrors.unidad}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* STOCK MÍNIMO POR ALMACÉN ACTIVO */}
                  <div className="pt-2.5 border-t border-[#E2E8F0] space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <h4 className="text-[11px] font-bold text-[#172033] uppercase tracking-wider flex items-center gap-1.5">
                          <Warehouse className="h-3 w-3 text-[#059669]" />
                          <span>Stock Mínimo por Almacén</span>
                        </h4>
                        <p className="text-[10px] text-[#64748B] mt-0.5">
                          Límite de alerta de resurtido para cada almacén. El valor <span className="font-semibold text-[#172033]">0</span> desactiva la alerta.
                        </p>
                      </div>
                    </div>

                    {almacenes.length === 0 ? (
                      <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] text-[11px] text-[#64748B] text-center">
                        No hay almacenes activos registrados. Se guardará sin alertas específicas de almacén.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {almacenes.map((alm) => {
                          const rawVal = stockMinimosPorAlmacen[alm.id] ?? 0;
                          const numVal = Number(rawVal);
                          const isAlertOff = numVal === 0 || isNaN(numVal);
                          const currentUnitText = unidadSelect === "otra" && otraUnidad.trim() ? otraUnidad.trim() : (UNIDADES_ESTANDAR.find(u => u.value === unidadSelect)?.label.split(" ")[0].toLowerCase() || unidadSelect);

                          return (
                            <div 
                              key={alm.id}
                              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-2.5 space-y-1.5 hover:border-slate-300 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="font-semibold text-[#172033] text-[11px] block">{alm.nombre}</span>
                                  <span className="text-[10px] text-[#64748B] block">{alm.ubicacion}</span>
                                </div>
                                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${
                                  isAlertOff 
                                    ? "bg-white border-[#E2E8F0] text-[#64748B]" 
                                    : "bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold"
                                }`}>
                                  {isAlertOff ? "Alerta off (0)" : `≤ ${numVal} ${currentUnitText}`}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <label className="text-[10px] text-[#64748B] shrink-0">Mínimo:</label>
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
                                  className="w-full px-2.5 py-1 bg-white border border-[#E2E8F0] focus:border-[#059669] text-[#172033] text-xs rounded-md focus:outline-none transition-all font-mono"
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
                <div className="p-3.5 border-t border-[#E2E8F0] bg-white flex items-center justify-end space-x-2 shrink-0">
                  <button
                    type="button"
                    disabled={submitLoading}
                    onClick={() => setIsFormOpen(false)}
                    className="px-3 py-1.5 bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] hover:text-[#172033] font-semibold rounded-lg text-xs transition-colors disabled:opacity-40"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="px-4 py-1.5 bg-[#059669] hover:bg-[#047857] text-white font-bold rounded-lg text-xs transition-all flex items-center space-x-1.5 disabled:opacity-50 shadow-xs"
                  >
                    {submitLoading ? (
                      <>
                        <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Guardando...</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreatedProductPrompt(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-2xl overflow-hidden"
            >
              <button
                onClick={() => setCreatedProductPrompt(null)}
                className="absolute top-3 right-3 p-1.5 text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] rounded-lg transition-all"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex flex-col items-center text-center p-1">
                <div className="bg-[#ECFDF5] border border-emerald-200 p-2.5 rounded-full mb-3 text-[#059669]">
                  <Sparkles className="h-6 w-6" />
                </div>

                <h3 className="text-base font-bold text-[#172033]">
                  ¡Producto creado correctamente!
                </h3>

                <p className="text-[#64748B] text-xs mt-1 font-medium">
                  ¿Deseas registrar su entrada inicial?
                </p>

                {/* Product Summary Badge */}
                <div className="w-full my-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-left font-mono text-xs text-[#172033] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">SKU:</span>
                    <span className="text-[#059669] font-bold">{createdProductPrompt.sku}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Nombre:</span>
                    <span className="text-[#172033] truncate max-w-[200px]">{createdProductPrompt.nombre}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Categoría:</span>
                    <span className="text-[#64748B]">{createdProductPrompt.categoria}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Unidad:</span>
                    <span className="text-[#64748B] capitalize">{createdProductPrompt.unidad}</span>
                  </div>
                </div>

                <div className="w-full flex flex-col sm:flex-row gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setCreatedProductPrompt(null)}
                    className="w-full sm:w-1/2 px-3 py-2 bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] hover:text-[#172033] font-semibold rounded-lg text-xs transition-colors"
                  >
                    No, permanecer aquí
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
                    className="w-full sm:w-1/2 px-3 py-2 bg-[#059669] hover:bg-[#047857] text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center space-x-1 shadow-xs"
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDeleteOpen(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              />

              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="relative w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-2xl overflow-hidden"
              >
                <button
                  onClick={() => setIsDeleteOpen(false)}
                  className="absolute top-3 right-3 p-1.5 text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] rounded-lg transition-all"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex flex-col items-center text-center p-1">
                  <div className={`p-2.5 rounded-full mb-3 border ${hasStock ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-rose-50 border-rose-200 text-rose-600"}`}>
                    <AlertTriangle className="h-6 w-6" />
                  </div>

                  <h3 className="text-base font-bold text-[#172033]">
                    {hasStock ? "Bloqueado: Producto con inventario activo" : "¿Eliminar producto del catálogo?"}
                  </h3>

                  <p className="text-[#64748B] text-xs mt-1.5 leading-relaxed font-sans">
                    {hasStock 
                      ? `Este producto tiene actualmente stock disponible (${totalQty} ${selectedProduct.unidad}) registrado en tus almacenes. Para proteger la integridad histórica de tu inventario, primero debes liquidar, transferir o dar salida a la mercadería existente de este SKU.`
                      : `¿Estás completamente seguro de eliminar el producto "${selectedProduct.nombre}" (SKU: ${selectedProduct.sku}) del catálogo maestro? Esta acción es definitiva.`}
                  </p>

                  <div className="w-full mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDeleteOpen(false)}
                      className="w-full sm:w-auto px-3.5 py-2 bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] hover:text-[#172033] font-semibold rounded-lg text-xs transition-colors"
                    >
                      {hasStock ? "Cerrar" : "Cancelar"}
                    </button>
                    {!hasStock && (
                      <button
                        type="button"
                        onClick={handleDeleteSubmit}
                        disabled={submitLoading}
                        className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 shadow-xs"
                      >
                        {submitLoading ? (
                          <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsImportOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-lg bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
            >
              <button
                onClick={() => setIsImportOpen(false)}
                className="absolute top-3 right-3 p-1.5 text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] rounded-lg transition-all"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-3 flex items-center space-x-2.5 shrink-0">
                <div className="bg-[#ECFDF5] p-2 rounded-lg text-[#059669] border border-emerald-200">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172033]">Importación Masiva de Productos (CSV)</h3>
                  <p className="text-xs text-[#64748B]">
                    Carga el catálogo de productos de la empresa mediante un archivo plano CSV.
                  </p>
                </div>
              </div>

              {/* CSV Spec Guidelines */}
              <div className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0] text-[10px] text-[#64748B] space-y-1.5 shrink-0 mb-3">
                <div className="flex items-center space-x-1.5 font-semibold text-[#059669]">
                  <FileText className="h-3 w-3" />
                  <span>Especificación requerida del archivo:</span>
                </div>
                <p>
                  Sube un archivo delimitado por comas (`.csv`) con las siguientes columnas exactas en la primera fila:
                </p>
                <div className="bg-white p-2 rounded font-mono text-[11px] text-[#172033] border border-[#E2E8F0] overflow-x-auto select-all">
                  sku,nombre,categoria,stock_minimo,unidad
                </div>
                <p>
                  Ejemplo: <span className="font-mono text-[#64748B] text-[10px]">POLO-MET-01,"Tornillo Hexagonal 3/8",Cerrajería Metálica,100,pieza</span>
                </p>
              </div>

              {/* Drop area / Progress */}
              <div className="overflow-y-auto pr-1 space-y-3 flex-1">
                {!importResults ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                      isDragging 
                        ? "border-[#059669] bg-emerald-50 text-[#059669]" 
                        : csvFile 
                          ? "border-emerald-300 bg-emerald-50/40" 
                          : "border-[#E2E8F0] hover:border-slate-300 bg-[#F8FAFC]"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div className="bg-white p-3 rounded-full border border-[#E2E8F0] text-[#64748B]">
                      <FileText className="h-6 w-6 text-[#64748B]" />
                    </div>

                    {csvFile ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-[#059669]">{csvFile.name}</p>
                        <p className="text-[10px] text-[#64748B]">{(csvFile.size / 1024).toFixed(2)} KB • Archivo listo</p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-[#172033]">Arrastra tu archivo CSV aquí</p>
                        <p className="text-[10px] text-[#64748B]">o haz clic para explorar en el equipo</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Import Complete Summary Box */
                  <div className="space-y-3">
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-2">
                      <h4 className="font-bold text-[#172033] flex items-center space-x-1.5 text-xs">
                        <Check className="h-3.5 w-3.5 text-[#059669]" />
                        <span>¡Procesamiento de productos completo!</span>
                      </h4>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white p-2 rounded-lg border border-[#E2E8F0]">
                          <span className="text-xl font-bold text-[#059669]">{importResults.successCount}</span>
                          <span className="block text-[9px] text-[#64748B] uppercase mt-0.5 font-semibold">Cargados</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-[#E2E8F0]">
                          <span className="text-xl font-bold text-amber-600">{importResults.skippedCount}</span>
                          <span className="block text-[9px] text-[#64748B] uppercase mt-0.5 font-semibold">Omitidos</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-[#E2E8F0]">
                          <span className="text-xl font-bold text-rose-600">{importResults.errors.length}</span>
                          <span className="block text-[9px] text-[#64748B] uppercase mt-0.5 font-semibold">Alertas</span>
                        </div>
                      </div>
                    </div>

                    {/* Detailed errors list */}
                    {importResults.errors.length > 0 && (
                      <div className="space-y-1.5">
                        <h5 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Bitácora de Advertencias/Errores:</h5>
                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5 max-h-32 overflow-y-auto font-mono text-[9px] text-[#64748B] divide-y divide-[#E2E8F0]">
                          {importResults.errors.map((err, i) => (
                            <p key={i} className="py-1 text-rose-700 flex items-start space-x-1.5">
                              <span className="text-slate-400 shrink-0 select-none">•</span>
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
              <div className="pt-3 mt-3 border-t border-[#E2E8F0] flex items-center justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] hover:text-[#172033] font-semibold rounded-lg text-xs transition-colors"
                >
                  Cerrar ventana
                </button>
                {csvFile && !importResults && (
                  <button
                    type="button"
                    onClick={processCSV}
                    disabled={submitLoading}
                    className="px-4 py-1.5 bg-[#059669] hover:bg-[#047857] text-white font-bold rounded-lg text-xs transition-all flex items-center space-x-1.5 disabled:opacity-50 shadow-xs"
                  >
                    {submitLoading ? (
                      <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
