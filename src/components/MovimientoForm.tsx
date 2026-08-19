/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { firestoreService } from "../lib/firebase";
import { Almacen, Producto } from "../types";
import { 
  ArrowRightLeft, 
  QrCode, 
  Settings, 
  CheckCircle, 
  X, 
  AlertCircle, 
  Info
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { motion, AnimatePresence } from "motion/react";

interface MovimientoFormProps {
  almacenes: Almacen[];
  productos: Producto[];
  preselectedSku?: string;
  preselectedAlmacenId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function MovimientoForm({ 
  almacenes, 
  productos, 
  preselectedSku = "", 
  preselectedAlmacenId = "",
  onSuccess, 
  onCancel 
}: MovimientoFormProps) {
  const [sku, setSku] = useState(preselectedSku);
  const [useCustomSku, setUseCustomSku] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("Tecnología");
  const [newProductMinStock, setNewProductMinStock] = useState<number | string>(5);
  
  // Warehouses MUST start empty unless explicitly provided via contextual action with BOTH sku and almacen
  const [almacenId, setAlmacenId] = useState<string>(() => {
    if (preselectedSku && preselectedAlmacenId) {
      return preselectedAlmacenId;
    }
    return "";
  });
  const [almacenDestinoId, setAlmacenDestinoId] = useState<string>("");
  const [tipo, setTipo] = useState<"entrada" | "salida" | "transferencia">("entrada");
  const [cantidad, setCantidad] = useState<number | string>(1);
  const [referencia, setReferencia] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Field-specific validation errors
  const [almacenError, setAlmacenError] = useState<string | null>(null);
  const [almacenDestinoError, setAlmacenDestinoError] = useState<string | null>(null);
  const [skuError, setSkuError] = useState<string | null>(null);

  // QR/Barcode Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  // Synchronize contextual preselection ONLY when both product and warehouse are explicitly sent
  useEffect(() => {
    if (preselectedSku && preselectedAlmacenId) {
      setSku(preselectedSku);
      setAlmacenId(preselectedAlmacenId);
      setUseCustomSku(false);
    } else if (preselectedSku) {
      setSku(preselectedSku);
      setUseCustomSku(false);
    }
  }, [preselectedSku, preselectedAlmacenId]);

  // Handler for changing transaction type: MUST clear any selected warehouse
  const handleTipoChange = (newTipo: "entrada" | "salida" | "transferencia") => {
    setTipo(newTipo);
    setAlmacenId("");
    setAlmacenDestinoId("");
    setAlmacenError(null);
    setAlmacenDestinoError(null);
    setFormError(null);
  };

  // Handle SKU changes to toggle "New product" creation state
  const handleSkuChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSku(val);
    setSkuError(null);
    setFormError(null);
  };

  // QR Scanner management
  const startScanner = async () => {
    setScannerError(null);
    setShowScanner(true);
    
    // Allow div to render before starting
    setTimeout(async () => {
      try {
        const qrInstance = new Html5Qrcode("qr-scanner-view");
        html5QrcodeRef.current = qrInstance;

        await qrInstance.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size * 0.5 }; // Wider for barcodes
            }
          },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {
            // Quiet fail for scan frame misses
          }
        );
      } catch (err: any) {
        console.error("Failed to start QR scanner:", err);
        setScannerError("No se pudo acceder a la cámara. Por favor concede los permisos o escribe el SKU.");
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
      } catch (err) {
        console.error("Failed to stop scanner:", err);
      } finally {
        html5QrcodeRef.current = null;
      }
    }
    setShowScanner(false);
  };

  const handleScanSuccess = async (decodedSku: string) => {
    await stopScanner();
    
    // Check if the scanned SKU matches an existing product
    const exists = productos.some(p => p.sku.toLowerCase() === decodedSku.toLowerCase());
    setSku(decodedSku);
    setSkuError(null);
    
    if (exists) {
      setUseCustomSku(false);
      setFormSuccess(`Código escaneado con éxito: "${decodedSku}" (Producto existente)`);
    } else {
      setUseCustomSku(true);
      setNewProductName(`Nuevo Producto (${decodedSku})`);
      setFormSuccess(`Código escaneado con éxito: "${decodedSku}". Es un SKU nuevo, por favor registra su nombre.`);
    }
    
    // Auto clear success notice after 5s
    setTimeout(() => setFormSuccess(null), 5000);
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setAlmacenError(null);
    setAlmacenDestinoError(null);
    setSkuError(null);

    let hasError = false;

    // 1. Validate SKU
    if (!sku.trim()) {
      setSkuError("Por favor ingresa o selecciona un SKU.");
      hasError = true;
    }

    // 2. Validate Origin Warehouse (MUST NOT be empty)
    if (!almacenId) {
      setAlmacenError(
        tipo === "transferencia" 
          ? "Por favor selecciona el almacén de origen." 
          : "Por favor selecciona el almacén para el movimiento."
      );
      hasError = true;
    }

    // 3. Validate Destination Warehouse in transfers
    if (tipo === "transferencia") {
      if (!almacenDestinoId) {
        setAlmacenDestinoError("Por favor selecciona el almacén de destino.");
        hasError = true;
      } else if (almacenId && almacenId === almacenDestinoId) {
        setAlmacenDestinoError("El almacén de destino no puede ser igual al de origen.");
        hasError = true;
      }
    }

    // 4. Validate Quantity
    const numCantidad = Number(cantidad);
    if (!cantidad || isNaN(numCantidad) || numCantidad <= 0) {
      setFormError("La cantidad debe ser mayor a 0.");
      hasError = true;
    }

    // 5. Validate Reference
    if (!referencia.trim()) {
      setFormError("Por favor ingresa una referencia o justificación para el movimiento.");
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setLoading(true);

    try {
      // 1. If it's a brand new SKU, ensure the product gets registered first
      if (useCustomSku) {
        if (!newProductName.trim()) {
          throw new Error("Por favor completa el nombre del nuevo producto.");
        }
        await firestoreService.ensureProductExists(
          sku.toUpperCase(), 
          newProductName, 
          newProductCategory, 
          Number(newProductMinStock) || 5, 
          "uds"
        );
      }

      // 2. Perform the movement database transaction
      const result = await firestoreService.registerMovimientoTransaction({
        sku: sku.toUpperCase(),
        almacen_id: almacenId,
        tipo,
        cantidad: Number(cantidad),
        referencia: referencia.trim() || `Movimiento manual - ${tipo}`,
        almacen_destino_id: tipo === "transferencia" ? almacenDestinoId : undefined
      });

      setFormSuccess(`¡Movimiento registrado con éxito! Folio asignado: ${result.folio}`);
      
      // Reset warehouse states back to empty after successful save
      setAlmacenId("");
      setAlmacenDestinoId("");
      setSku("");
      setCantidad(1);
      setReferencia("");
      setUseCustomSku(false);
      setNewProductName("");
      setAlmacenError(null);
      setAlmacenDestinoError(null);
      setSkuError(null);
      
      // Notify parent
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Ocurrió un error al procesar la transacción.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-3.5 sm:px-5 py-5" id="movimiento-form-container">
      {/* Main card */}
      <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-xl shadow-xs overflow-hidden">
        <div className="border-b border-[#E2E8F0] dark:border-[#263449] bg-[#F8FAFC] dark:bg-[#182235] px-4 sm:px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="bg-[#ECFDF5] dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-1.5 rounded-lg text-[#059669] dark:text-emerald-400">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172033] dark:text-[#F8FAFC]">Registrar Movimiento de Mercancía</h2>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Registro seguro en la base de datos con actualización atómica de inventario.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Status alerts */}
          {formError && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-400 px-3 py-2 rounded-lg flex items-start space-x-2 text-xs">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-400 px-3 py-2 rounded-lg flex items-start space-x-2 text-xs">
              <CheckCircle className="h-4 w-4 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* SECTION 1: SKU IDENTIFICATION & SCANNING */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] border-b border-[#E2E8F0] dark:border-[#263449] pb-1.5">
              1. Identificación del Producto
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {/* Left Selector/Input */}
              <div className="md:col-span-8">
                {useCustomSku ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#172033] dark:text-[#F8FAFC] mb-1">
                      Escribe el nuevo SKU (Código único) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: SKU-90045"
                      value={sku}
                      onChange={(e) => {
                        setSku(e.target.value);
                        setSkuError(null);
                      }}
                      className={`w-full bg-white dark:bg-[#0F172A] border ${
                        skuError 
                          ? "border-rose-500 dark:border-rose-500" 
                          : "border-[#E2E8F0] dark:border-[#263449] focus:border-[#059669] dark:focus:border-emerald-500"
                      } text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 px-3 text-xs sm:text-sm focus:outline-none font-mono placeholder:text-slate-400 dark:placeholder:text-slate-500`}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#172033] dark:text-[#F8FAFC] mb-1">
                      Selecciona un producto existente *
                    </label>
                    <select
                      value={sku}
                      onChange={handleSkuChange}
                      className={`w-full bg-white dark:bg-[#0F172A] border ${
                        skuError 
                          ? "border-rose-500 dark:border-rose-500" 
                          : "border-[#E2E8F0] dark:border-[#263449] focus:border-[#059669] dark:focus:border-emerald-500"
                      } text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 px-2.5 text-xs sm:text-sm focus:outline-none transition-colors`}
                    >
                      <option value="">-- Seleccionar SKU --</option>
                      {productos.map(p => (
                        <option key={p.sku} value={p.sku}>
                          {p.sku} - {p.nombre} ({p.categoria})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {skuError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-center space-x-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{skuError}</span>
                  </p>
                )}
              </div>

              {/* Scan Barcode Button */}
              <div className="md:col-span-4 flex space-x-2">
                <button
                  type="button"
                  onClick={startScanner}
                  className="flex-1 inline-flex items-center justify-center space-x-1.5 bg-[#ECFDF5] dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-[#059669] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-medium py-1.5 px-2.5 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>Escanear Cámara</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUseCustomSku(!useCustomSku);
                    setSku("");
                    setSkuError(null);
                    setFormError(null);
                  }}
                  className="inline-flex items-center justify-center p-2 bg-white dark:bg-[#0F172A] hover:bg-[#F1F5F9] dark:hover:bg-[#182235] text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F8FAFC] rounded-lg border border-[#E2E8F0] dark:border-[#263449] text-xs transition-colors cursor-pointer"
                  title={useCustomSku ? "Elegir de lista" : "Registrar SKU nuevo"}
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* If New Product Mode, prompt for mandatory metadata */}
            <AnimatePresence>
              {useCustomSku && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-[#F8FAFC] dark:bg-[#182235] p-3 rounded-lg border border-[#E2E8F0] dark:border-[#263449] space-y-3 overflow-hidden"
                >
                  <div className="flex items-center space-x-1.5 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                    <Info className="h-3.5 w-3.5" />
                    <span>¡Estás registrando un nuevo SKU en la base de datos!</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#172033] dark:text-[#F8FAFC] mb-1">
                        Nombre del Producto *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Cargador USB-C GaN"
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 px-2.5 text-xs focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#172033] dark:text-[#F8FAFC] mb-1">
                        Categoría
                      </label>
                      <select
                        value={newProductCategory}
                        onChange={(e) => setNewProductCategory(e.target.value)}
                        className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 px-2 text-xs focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500"
                      >
                        <option value="Tecnología">Tecnología</option>
                        <option value="Oficina">Oficina</option>
                        <option value="Mobiliario">Mobiliario</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#172033] dark:text-[#F8FAFC] mb-1">
                        Mínimo de Alerta
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newProductMinStock}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNewProductMinStock(v === "" ? "" : Number(v));
                        }}
                        className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 px-2.5 text-xs focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* SECTION 2: MOVEMENT TRANSACTION DETAILS */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] border-b border-[#E2E8F0] dark:border-[#263449] pb-1.5">
              2. Detalles del Movimiento
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Type selector */}
              <div>
                <label className="block text-[11px] font-semibold text-[#172033] dark:text-[#F8FAFC] mb-1.5">
                  Tipo de Transacción
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["entrada", "salida", "transferencia"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTipoChange(t)}
                      className={`py-1.5 px-2 text-xs font-semibold capitalize rounded-lg border transition-all cursor-pointer ${
                        tipo === t
                          ? "bg-[#059669] text-white border-[#059669] shadow-xs"
                          : "bg-white dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] border-[#E2E8F0] dark:border-[#263449] hover:bg-[#F1F5F9] dark:hover:bg-[#182235] hover:text-[#172033] dark:hover:text-[#F8FAFC]"
                      }`}
                    >
                      {t === "entrada" && "Entrada"}
                      {t === "salida" && "Salida"}
                      {t === "transferencia" && "Transf."}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-[11px] font-semibold text-[#172033] dark:text-[#F8FAFC] mb-1.5">
                  Cantidad (Unidades) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="Ej. 10"
                  value={cantidad}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setCantidad("");
                    } else {
                      const parsed = parseInt(v, 10);
                      setCantidad(isNaN(parsed) ? "" : parsed);
                    }
                  }}
                  className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 px-3 text-xs sm:text-sm focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500 font-mono placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Origin Warehouse Selector - Starts empty, shows disabled placeholder */}
              <div>
                <label className="block text-[11px] font-semibold text-[#172033] dark:text-[#F8FAFC] mb-1.5">
                  {tipo === "transferencia" ? "Almacén de Origen *" : "Almacén afectado *"}
                </label>
                <select
                  id="select-almacen-origen"
                  value={almacenId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAlmacenId(val);
                    setAlmacenError(null);
                    if (tipo === "transferencia" && val && val === almacenDestinoId) {
                      setAlmacenDestinoError("El almacén de destino no puede ser igual al de origen.");
                    } else if (almacenDestinoError && val !== almacenDestinoId) {
                      setAlmacenDestinoError(null);
                    }
                  }}
                  className={`w-full bg-white dark:bg-[#0F172A] border ${
                    almacenError 
                      ? "border-rose-500 dark:border-rose-500 focus:border-rose-500" 
                      : "border-[#E2E8F0] dark:border-[#263449] focus:border-[#059669] dark:focus:border-emerald-500"
                  } text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 px-2.5 text-xs sm:text-sm focus:outline-none transition-colors`}
                >
                  <option value="" disabled>-- Seleccionar almacén --</option>
                  {almacenes.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} ({a.ubicacion})
                    </option>
                  ))}
                </select>
                {almacenError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-center space-x-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{almacenError}</span>
                  </p>
                )}
              </div>

              {/* Destination Warehouse Selector (Transfers only) - Starts empty */}
              {tipo === "transferencia" && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#172033] dark:text-[#F8FAFC] mb-1.5">
                    Almacén de Destino *
                  </label>
                  <select
                    id="select-almacen-destino"
                    value={almacenDestinoId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAlmacenDestinoId(val);
                      setAlmacenDestinoError(null);
                      if (val && val === almacenId) {
                        setAlmacenDestinoError("El almacén de destino debe ser diferente al de origen.");
                      }
                    }}
                    className={`w-full bg-white dark:bg-[#0F172A] border ${
                      almacenDestinoError 
                        ? "border-rose-500 dark:border-rose-500 focus:border-rose-500" 
                        : "border-[#E2E8F0] dark:border-[#263449] focus:border-[#059669] dark:focus:border-emerald-500"
                    } text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 px-2.5 text-xs sm:text-sm focus:outline-none transition-colors`}
                  >
                    <option value="" disabled>-- Seleccionar almacén --</option>
                    {almacenes.map(a => (
                      <option key={a.id} value={a.id} disabled={a.id === almacenId}>
                        {a.nombre} ({a.ubicacion}) {a.id === almacenId ? "— (Mismo que origen)" : ""}
                      </option>
                    ))}
                  </select>
                  {almacenDestinoError && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-center space-x-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{almacenDestinoError}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Reference */}
            <div>
              <label className="block text-[11px] font-semibold text-[#172033] dark:text-[#F8FAFC] mb-1.5">
                Referencia / Justificación del movimiento *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Factura Compra F-3200, Nota de Entrega N-105, Conteo físico anual..."
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="w-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#263449] text-[#172033] dark:text-[#F8FAFC] rounded-lg py-1.5 px-3 text-xs sm:text-sm focus:outline-none focus:border-[#059669] dark:focus:border-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#263449] flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-white dark:bg-[#0F172A] hover:bg-[#F1F5F9] dark:hover:bg-[#182235] text-[#172033] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#263449] rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-xs font-semibold transition-all shadow-xs focus:outline-none cursor-pointer"
            >
              {loading ? (
                <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                "Guardar Transacción"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* HTML5 QRCODE CAMERA DIALOG */}
      <AnimatePresence>
        {showScanner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263449] rounded-2xl w-full max-w-lg overflow-hidden shadow-xl"
            >
              <div className="px-5 py-3.5 border-b border-[#E2E8F0] dark:border-[#263449] bg-[#F8FAFC] dark:bg-[#182235] flex items-center justify-between">
                <div className="flex items-center space-x-2 text-[#059669] dark:text-emerald-400">
                  <QrCode className="h-4 w-4" />
                  <span className="font-bold text-sm text-[#172033] dark:text-[#F8FAFC]">Escanear Código de Barra / QR</span>
                </div>
                <button 
                  onClick={stopScanner}
                  className="p-1 text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#182235] rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 flex flex-col items-center">
                {scannerError ? (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-400 p-4 rounded-xl text-xs flex items-start space-x-2.5 w-full">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{scannerError}</span>
                  </div>
                ) : (
                  <div className="w-full">
                    {/* Scanner camera element */}
                    <div 
                      id="qr-scanner-view" 
                      className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-[#263449]"
                    />
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-3 text-center leading-relaxed">
                      Enfoca el código de barras o código QR de tu producto usando la cámara. El sistema lo leerá automáticamente.
                    </p>
                  </div>
                )}

                {/* Demonstration placeholder values */}
                <div className="mt-5 pt-4 border-t border-[#E2E8F0] dark:border-[#263449] w-full">
                  <h4 className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                    Códigos de prueba (Demos)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {["SKU-1001", "SKU-1002", "SKU-1003", "SKU-NUEVO"].map((demoCode) => (
                      <button
                        key={demoCode}
                        type="button"
                        onClick={() => handleScanSuccess(demoCode)}
                        className="bg-[#F8FAFC] dark:bg-[#182235] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-[#172033] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#263449] px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                      >
                        {demoCode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
