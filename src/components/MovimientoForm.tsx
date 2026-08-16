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
  PlusCircle, 
  MinusCircle, 
  Settings, 
  CheckCircle, 
  X, 
  AlertCircle, 
  Info,
  Layers,
  HelpCircle
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { motion, AnimatePresence } from "motion/react";

interface MovimientoFormProps {
  almacenes: Almacen[];
  productos: Producto[];
  preselectedSku?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function MovimientoForm({ 
  almacenes, 
  productos, 
  preselectedSku = "", 
  onSuccess, 
  onCancel 
}: MovimientoFormProps) {
  const [sku, setSku] = useState(preselectedSku);
  const [useCustomSku, setUseCustomSku] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("Tecnología");
  const [newProductMinStock, setNewProductMinStock] = useState<number | string>(5);
  
  const [almacenId, setAlmacenId] = useState("");
  const [almacenDestinoId, setAlmacenDestinoId] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "salida" | "transferencia">("entrada");
  const [cantidad, setCantidad] = useState<number | string>(1);
  const [referencia, setReferencia] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // QR/Barcode Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (preselectedSku) {
      setSku(preselectedSku);
      setUseCustomSku(false);
    }
  }, [preselectedSku]);

  // Set default warehouse if available
  useEffect(() => {
    if (almacenes.length > 0 && !almacenId) {
      setAlmacenId(almacenes[0].id);
    }
    if (almacenes.length > 1 && !almacenDestinoId) {
      setAlmacenDestinoId(almacenes[1].id);
    }
  }, [almacenes, almacenId, almacenDestinoId]);

  // Handle SKU changes to toggle "New product" creation state
  const handleSkuChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSku(val);
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
        html5QrcodeRef.ref = qrInstance; // Keep ref manually
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

    // Form validations
    if (!sku) {
      setFormError("Por favor ingresa o selecciona un SKU.");
      return;
    }

    if (!almacenId) {
      setFormError("Por favor selecciona el almacén de origen.");
      return;
    }

    if (tipo === "transferencia" && almacenId === almacenDestinoId) {
      setFormError("El almacén de destino debe ser diferente al de origen.");
      return;
    }

    const numCantidad = Number(cantidad);
    if (!cantidad || isNaN(numCantidad) || numCantidad <= 0) {
      setFormError("La cantidad debe ser mayor a 0.");
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
      
      // Notify parent & reset
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
    <div className="max-w-3xl mx-auto px-4 py-8" id="movimiento-form-container">
      {/* Back button */}
      <div className="mb-6">
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors inline-flex items-center"
        >
          &larr; Volver al Dashboard
        </button>
      </div>

      {/* Main card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-800 bg-slate-950 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg text-emerald-400">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Registrar Movimiento de Mercancía</h2>
              <p className="text-xs text-slate-500">
                Las transacciones en Firestore actualizan el stock de forma atómica.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Status alerts */}
          {formError && (
            <div className="bg-rose-950/40 border border-rose-800 text-rose-300 px-4 py-3 rounded-xl flex items-start space-x-2.5 text-sm">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-xl flex items-start space-x-2.5 text-sm">
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* SECTION 1: SKU IDENTIFICATION & SCANNING */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
              1. Identificación del Producto
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Left Selector/Input */}
              <div className="md:col-span-8">
                {useCustomSku ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">
                      Escribe el nuevo SKU (Código único)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: SKU-90045"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">
                      Selecciona un producto existente
                    </label>
                    <select
                      value={sku}
                      onChange={handleSkuChange}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
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
              </div>

              {/* Scan Barcode Button */}
              <div className="md:col-span-4 flex space-x-2">
                <button
                  type="button"
                  onClick={startScanner}
                  className="flex-1 inline-flex items-center justify-center space-x-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium py-2.5 px-3 rounded-xl text-xs transition-colors"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Escanear Cámara</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUseCustomSku(!useCustomSku);
                    setSku("");
                    setFormError(null);
                  }}
                  className="inline-flex items-center justify-center p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs transition-colors"
                  title={useCustomSku ? "Elegir de lista" : "Registrar SKU nuevo"}
                >
                  <Settings className="h-4 w-4" />
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
                  className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4 overflow-hidden"
                >
                  <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold">
                    <Info className="h-4 w-4" />
                    <span>¡Estás registrando un nuevo SKU en la base de datos!</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                        Nombre del Producto
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Cargador USB-C GaN"
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                        Categoría
                      </label>
                      <select
                        value={newProductCategory}
                        onChange={(e) => setNewProductCategory(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-lg py-2 px-2 text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Tecnología">Tecnología</option>
                        <option value="Oficina">Oficina</option>
                        <option value="Mobiliario">Mobiliario</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
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
                        className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* SECTION 2: MOVEMENT TRANSACTION DETAILS */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
              2. Detalles del Movimiento
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">
                  Tipo de Transacción
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["entrada", "salida", "transferencia"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipo(t)}
                      className={`py-2 px-2 text-xs font-semibold capitalize rounded-xl border transition-all ${
                        tipo === t
                          ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/5"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800"
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
                <label className="block text-xs font-semibold text-slate-400 mb-2">
                  Cantidad (Unidades)
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
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Origin Warehouse */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">
                  {tipo === "transferencia" ? "Almacén de Origen" : "Almacén afectado"}
                </label>
                <select
                  value={almacenId}
                  onChange={(e) => setAlmacenId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-emerald-500"
                >
                  {almacenes.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} ({a.ubicacion})
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Warehouse (Transfers only) */}
              {tipo === "transferencia" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">
                    Almacén de Destino
                  </label>
                  <select
                    value={almacenDestinoId}
                    onChange={(e) => setAlmacenDestinoId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {almacenes.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.nombre} ({a.ubicacion})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                Referencia / Justificación del movimiento
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Factura Compra F-3200, Nota de Entrega N-105, Conteo físico anual..."
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-sm font-semibold transition-all shadow-md focus:outline-none"
            >
              {loading ? (
                <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin inline-block" />
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <QrCode className="h-5 w-5" />
                  <span className="font-bold text-sm text-slate-200">Escanear Código de Barra / QR</span>
                </div>
                <button 
                  onClick={stopScanner}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 flex flex-col items-center">
                {scannerError ? (
                  <div className="bg-rose-950/40 border border-rose-800 text-rose-400 p-4 rounded-xl text-xs flex items-start space-x-2.5 w-full">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <span>{scannerError}</span>
                  </div>
                ) : (
                  <div className="w-full">
                    {/* Scanner camera element */}
                    <div 
                      id="qr-scanner-view" 
                      className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800"
                    />
                    <p className="text-xs text-slate-500 mt-4 text-center leading-relaxed">
                      Enfoca el código de barras o código QR de tu producto usando la cámara de tu dispositivo. El sistema lo leerá y cerrará automáticamente este lector.
                    </p>
                  </div>
                )}

                {/* Demonstration placeholder values so the user can easily copy/paste them during manual testing */}
                <div className="mt-6 pt-5 border-t border-slate-800 w-full">
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Códigos de prueba (Demos)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {["SKU-1001", "SKU-1002", "SKU-1003", "SKU-NUEVO"].map((demoCode) => (
                      <button
                        key={demoCode}
                        type="button"
                        onClick={() => handleScanSuccess(demoCode)}
                        className="bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors"
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
