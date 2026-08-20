/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore,
  initializeFirestore,
  setLogLevel,
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc,
  addDoc, 
  deleteDoc,
  onSnapshot, 
  runTransaction, 
  query, 
  where, 
  orderBy,
  limit,
  startAfter,
  Timestamp
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  User as FirebaseUser
} from "firebase/auth";
import { 
  Almacen, 
  Producto, 
  StockItem, 
  Movimiento, 
  Usuario, 
  CategoriaCatalogo, 
  UnidadMedidaCatalogo,
  ResumenVentaDiaria
} from "../types";

// Silence non-critical network retry noise from Firestore client
try {
  setLogLevel("error");
} catch {
  // Ignore if not supported in runtime
}

// Detect if Firebase config is present in environment variables
const metaEnv = (import.meta as any).env || {};
const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || "",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: metaEnv.VITE_FIREBASE_APP_ID || ""
};

const isConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  firebaseConfig.apiKey !== "MY_FIREBASE_API_KEY" &&
  firebaseConfig.apiKey !== "your-api-key" &&
  !firebaseConfig.apiKey.includes("your-") &&
  !firebaseConfig.projectId.includes("your-") &&
  firebaseConfig.apiKey.length > 15
);

// Initialize Firebase if configured
let realApp;
let realDb: any = null;
let realAuth: any = null;

if (isConfigured) {
  try {
    realApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    try {
      realDb = initializeFirestore(realApp, {
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true
      });
    } catch {
      realDb = getFirestore(realApp);
    }
    realAuth = getAuth(realApp);
    console.log("Firebase inicializado exitosamente.");
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
    realDb = null;
    realAuth = null;
  }
} else {
  console.log("Firebase no configurado. Operando en modo Emulador Local (localStorage).");
}

// --- HELPER PARA FECHAS LOCALES Y-M-D ---
export function getLocalDateString(date: Date | { seconds: number; nanoseconds: number } | any): string {
  if (!date) {
    date = new Date();
  }
  const d = date instanceof Date 
    ? date 
    : (typeof date?.toDate === "function" ? date.toDate() : (date?.seconds ? new Date(date.seconds * 1000) : new Date(date)));
  
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    const y = fallback.getFullYear();
    const m = String(fallback.getMonth() + 1).padStart(2, "0");
    const day = String(fallback.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// --- LOCAL STORAGE HIGH-FIDELITY EMULATOR (SOLO CUANDO FIREBASE NO ESTÁ CONFIGURADO) ---
const STORAGE_PREFIX = "inventario_mvp_";

const getLocalStorageItem = <T>(key: string, defaultValue: T): T => {
  const value = localStorage.getItem(STORAGE_PREFIX + key);
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch (e) {
    console.error(`Error parsing localStorage key ${key}:`, e);
    return defaultValue;
  }
};

const setLocalStorageItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing to localStorage key ${key}:`, e);
  }
};

// Listeners for local emulator reactivity
const listeners = {
  almacenes: [] as ((data: Almacen[]) => void)[],
  productos: [] as ((data: Producto[]) => void)[],
  stock: [] as ((data: StockItem[]) => void)[],
  movimientos: [] as ((data: Movimiento[]) => void)[],
  categorias: [] as ((data: CategoriaCatalogo[]) => void)[],
  unidades: [] as ((data: UnidadMedidaCatalogo[]) => void)[],
  auth: [] as ((user: Usuario | null) => void)[]
};

const notifyListeners = (key: keyof typeof listeners, data: any) => {
  listeners[key].forEach(cb => {
    try {
      cb(data);
    } catch (err) {
      console.error(`Error notifying listener for ${key}:`, err);
    }
  });
};

// Clear legacy localStorage cache on startup
try {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith(STORAGE_PREFIX) || key.startsWith("inventario_mvp_"))) {
      if (key !== STORAGE_PREFIX + "currentUser" && key !== "currentUser") {
        keysToRemove.push(key);
      }
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
} catch (e) {
  // Ignore in SSR/non-browser
}

// Ensure warehouse collection exists for local emulator without demo products or stock
const initializeLocalEmulator = () => {
  if (isConfigured) return;

  const almacenes = getLocalStorageItem<Almacen[]>("almacenes", []);
  if (almacenes.length === 0) {
    const initialAlmacenes: Almacen[] = [
      { id: "alm_principal", nombre: "Almacén Central (CDMX)", ubicacion: "Parque Industrial Norte, Bodega 4" },
      { id: "alm_secundario", nombre: "Sucursal Guadalajara", ubicacion: "Av. Vallarta Poniente #4520" },
      { id: "alm_norte", nombre: "Cedis Monterrey", ubicacion: "Carretera a Laredo Km 14" },
      { id: "alm_sur", nombre: "Sucursal Mérida (Sureste)", ubicacion: "Calle 60 Norte #298, Parque Industrial" }
    ];
    setLocalStorageItem("almacenes", initialAlmacenes);
  }

  // Ensure products, stock, movements and counters are clean
  setLocalStorageItem("productos", []);
  setLocalStorageItem("stock", {});
  setLocalStorageItem("movimientos", []);
  setLocalStorageItem("resumen_ventas", {});
  setLocalStorageItem("contadores_movimientos", {
    entrada: 0,
    salida: 0,
    transferencia: 0,
    ajuste: 0
  });
};

initializeLocalEmulator();

export const isRealFirebase = isConfigured;

// --- SERVICIO DE AUTENTICACIÓN ---
export const authService = {
  isConfigured: () => isConfigured,

  login: async (email: string, pass: string): Promise<Usuario> => {
    return authService.loginWithEmail(email, pass);
  },

  loginWithGoogle: async (): Promise<Usuario> => {
    if (isConfigured && realAuth) {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(realAuth, provider);
      return {
        uid: result.user.uid,
        email: result.user.email || "",
        nombre: result.user.displayName || undefined
      };
    } else {
      // Local Emulator Google Login
      const mockUser: Usuario = {
        uid: "local_google_user_001",
        email: "admin.local@stockmaster.io",
        nombre: "Administrador StockMaster"
      };
      setLocalStorageItem("currentUser", mockUser);
      notifyListeners("auth", mockUser);
      return mockUser;
    }
  },

  loginWithEmail: async (email: string, pass: string): Promise<Usuario> => {
    if (isConfigured && realAuth) {
      const result = await signInWithEmailAndPassword(realAuth, email, pass);
      return {
        uid: result.user.uid,
        email: result.user.email || ""
      };
    } else {
      const mockUser: Usuario = {
        uid: "local_email_user_002",
        email: email || "usuario.demo@stockmaster.io",
        nombre: email.split("@")[0]
      };
      setLocalStorageItem("currentUser", mockUser);
      notifyListeners("auth", mockUser);
      return mockUser;
    }
  },

  logout: async (): Promise<void> => {
    if (isConfigured && realAuth) {
      await signOut(realAuth);
    } else {
      localStorage.removeItem(STORAGE_PREFIX + "currentUser");
      notifyListeners("auth", null);
    }
  },

  onAuthStateChange: (callback: (user: Usuario | null) => void): (() => void) => {
    if (isConfigured && realAuth) {
      return onAuthStateChanged(realAuth, (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          callback({
            uid: firebaseUser.uid,
            email: firebaseUser.email || ""
          });
        } else {
          callback(null);
        }
      });
    } else {
      const initialUser = getLocalStorageItem<Usuario | null>("currentUser", null);
      callback(initialUser);

      let currentCachedUid = initialUser ? initialUser.uid : null;
      const update = (newUser: Usuario | null) => {
        const newUid = newUser ? newUser.uid : null;
        if (newUid !== currentCachedUid) {
          currentCachedUid = newUid;
          callback(newUser);
        }
      };

      listeners.auth.push(update);
      return () => {
        listeners.auth = listeners.auth.filter(cb => cb !== update);
      };
    }
  },

  getCurrentUser: (): Usuario | null => {
    if (isConfigured && realAuth) {
      const fbUser = realAuth.currentUser;
      return fbUser ? { uid: fbUser.uid, email: fbUser.email || "" } : null;
    } else {
      return getLocalStorageItem<Usuario | null>("currentUser", null);
    }
  }
};

// --- SERVICIO DE FIRESTORE / INVENTARIO ---
export const firestoreService = {
  isConfigured: () => isConfigured,

  // --- ALMACENES ---
  getAlmacenes: async (): Promise<Almacen[]> => {
    if (isConfigured && realDb) {
      const snap = await getDocs(collection(realDb, "almacenes"));
      const list: Almacen[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as Almacen);
      });
      return list;
    }
    return getLocalStorageItem<Almacen[]>("almacenes", []);
  },

  getAlmacenesRealtime: (onUpdate: (almacenes: Almacen[]) => void): (() => void) => {
    if (isConfigured && realDb) {
      return onSnapshot(
        collection(realDb, "almacenes"),
        (snap) => {
          const list: Almacen[] = [];
          snap.forEach(d => {
            list.push({ id: d.id, ...d.data() } as Almacen);
          });
          onUpdate(list);
        },
        (error) => {
          console.error("Error en listener de almacenes:", error);
        }
      );
    }

    const update = () => {
      const list = getLocalStorageItem<Almacen[]>("almacenes", []);
      onUpdate(list);
    };
    update();
    listeners.almacenes.push(update);
    return () => {
      listeners.almacenes = listeners.almacenes.filter(cb => cb !== update);
    };
  },

  addAlmacen: async (almacen: Omit<Almacen, "id">): Promise<string> => {
    if (isConfigured && realDb) {
      const docRef = await addDoc(collection(realDb, "almacenes"), almacen);
      return docRef.id;
    }
    const list = getLocalStorageItem<Almacen[]>("almacenes", []);
    const newId = "alm_" + Math.random().toString(36).substr(2, 9);
    const newItem: Almacen = { id: newId, ...almacen };
    list.push(newItem);
    setLocalStorageItem("almacenes", list);
    notifyListeners("almacenes", list);
    return newId;
  },

  updateAlmacen: async (id: string, data: Partial<Omit<Almacen, "id">>): Promise<void> => {
    if (isConfigured && realDb) {
      const docRef = doc(realDb, "almacenes", id);
      await setDoc(docRef, data, { merge: true });
      return;
    }
    const list = getLocalStorageItem<Almacen[]>("almacenes", []);
    const index = list.findIndex(a => a.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...data };
      setLocalStorageItem("almacenes", list);
      notifyListeners("almacenes", list);
    }
  },

  deleteAlmacen: async (id: string): Promise<void> => {
    if (isConfigured && realDb) {
      const docRef = doc(realDb, "almacenes", id);
      await deleteDoc(docRef);
      return;
    }
    const list = getLocalStorageItem<Almacen[]>("almacenes", []);
    const filtered = list.filter(a => a.id !== id);
    setLocalStorageItem("almacenes", filtered);
    notifyListeners("almacenes", filtered);
  },

  normalizeWarehouseId: (rawId: string, almacenesList: Almacen[] = []): string => {
    if (!rawId) return "";
    const clean = rawId.trim();
    const exact = almacenesList.find(a => a.id === clean);
    if (exact) return exact.id;
    const matchName = almacenesList.find(a => a.nombre.toLowerCase().trim() === clean.toLowerCase().trim());
    if (matchName) return matchName.id;
    return clean;
  },

  // --- PRODUCTOS ---
  getProductos: async (): Promise<Producto[]> => {
    if (isConfigured && realDb) {
      const snap = await getDocs(collection(realDb, "productos"));
      const list: Producto[] = [];
      snap.forEach(d => {
        list.push({ sku: d.id, ...d.data() } as Producto);
      });
      return list;
    }
    return getLocalStorageItem<Producto[]>("productos", []);
  },

  getProductosRealtime: (onUpdate: (productos: Producto[]) => void): (() => void) => {
    if (isConfigured && realDb) {
      return onSnapshot(
        collection(realDb, "productos"),
        (snap) => {
          const list: Producto[] = [];
          snap.forEach(d => {
            list.push({ sku: d.id, ...d.data() } as Producto);
          });
          onUpdate(list);
        },
        (error) => {
          console.error("Error en listener de productos:", error);
        }
      );
    }

    const update = () => {
      const list = getLocalStorageItem<Producto[]>("productos", []);
      onUpdate(list);
    };
    update();
    listeners.productos.push(update);
    return () => {
      listeners.productos = listeners.productos.filter(cb => cb !== update);
    };
  },

  checkSkuExists: async (sku: string): Promise<boolean> => {
    const cleanSku = sku.trim().toUpperCase();
    if (!cleanSku) return false;
    if (isConfigured && realDb) {
      const docRef = doc(realDb, "productos", cleanSku);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    }
    const list = getLocalStorageItem<Producto[]>("productos", []);
    return list.some(p => p.sku?.trim().toUpperCase() === cleanSku);
  },

  addProduct: async (producto: Producto): Promise<void> => {
    const cleanSku = producto.sku.trim().toUpperCase();
    if (!cleanSku) throw new Error("El SKU no puede estar vacío.");

    if (isConfigured && realDb) {
      const docRef = doc(realDb, "productos", cleanSku);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        throw new Error(`El producto con SKU "${cleanSku}" ya existe en el catálogo.`);
      }
      await setDoc(docRef, {
        nombre: producto.nombre.trim(),
        categoria: producto.categoria.trim() || "General",
        stock_minimo: Number(producto.stock_minimo) || 5,
        unidad: (producto.unidad || "uds").trim(),
        ...(producto.stock_minimo_almacenes ? { stock_minimo_almacenes: producto.stock_minimo_almacenes } : {})
      });
      return;
    }

    const list = getLocalStorageItem<Producto[]>("productos", []);
    if (list.some(p => p.sku === cleanSku)) {
      throw new Error(`El producto con SKU "${cleanSku}" ya existe.`);
    }
    const newItem: Producto = {
      ...producto,
      sku: cleanSku,
      unidad: (producto.unidad || "uds").trim()
    };
    list.push(newItem);
    setLocalStorageItem("productos", list);
    notifyListeners("productos", list);
  },

  updateProduct: async (sku: string, data: Partial<Omit<Producto, "sku">>): Promise<void> => {
    const cleanSku = sku.trim().toUpperCase();
    if (isConfigured && realDb) {
      const docRef = doc(realDb, "productos", cleanSku);
      await setDoc(docRef, data, { merge: true });
      return;
    }
    const list = getLocalStorageItem<Producto[]>("productos", []);
    const index = list.findIndex(p => p.sku === cleanSku);
    if (index !== -1) {
      list[index] = { ...list[index], ...data };
      setLocalStorageItem("productos", list);
      notifyListeners("productos", list);
    }
  },

  deleteProduct: async (sku: string): Promise<void> => {
    const cleanSku = sku.trim().toUpperCase();
    if (isConfigured && realDb) {
      const docRef = doc(realDb, "productos", cleanSku);
      await deleteDoc(docRef);
      return;
    }
    const list = getLocalStorageItem<Producto[]>("productos", []);
    const filtered = list.filter(p => p.sku !== cleanSku);
    setLocalStorageItem("productos", filtered);
    notifyListeners("productos", filtered);
  },

  ensureProductExists: async (sku: string, nombre: string, categoria = "General", stockMinimo = 5, unidad = "uds"): Promise<Producto> => {
    const cleanSku = sku.trim().toUpperCase();
    const productData: Producto = { sku: cleanSku, nombre, categoria, stock_minimo: stockMinimo, unidad };
    if (isConfigured && realDb) {
      const docRef = doc(realDb, "productos", cleanSku);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, { nombre, categoria, stock_minimo: stockMinimo, unidad });
      }
      return productData;
    }
    const prods = getLocalStorageItem<Producto[]>("productos", []);
    const existing = prods.find(p => p.sku === cleanSku);
    if (!existing) {
      prods.push(productData);
      setLocalStorageItem("productos", prods);
    }
    return existing || productData;
  },

  // --- ATOMIC REAL-TIME STOCK ---
  getStockRealtime: (onUpdate: (stock: StockItem[]) => void): (() => void) => {
    if (isConfigured && realDb) {
      return onSnapshot(
        collection(realDb, "stock"),
        (snap) => {
          const list: StockItem[] = [];
          snap.forEach(d => {
            const data = d.data();
            list.push({
              id: d.id,
              sku: data.sku,
              almacen_id: data.almacen_id,
              cantidad: Number(data.cantidad) || 0,
              actualizado: data.actualizado ? (data.actualizado as Timestamp).toDate() : new Date()
            });
          });
          onUpdate(list);
        },
        (error) => {
          console.error("Error en listener de stock:", error);
        }
      );
    }

    const update = () => {
      const stockMap = getLocalStorageItem<Record<string, StockItem>>("stock", {});
      onUpdate(Object.values(stockMap));
    };

    update();
    listeners.stock.push(update);
    return () => {
      listeners.stock = listeners.stock.filter(cb => cb !== update);
    };
  },

  getFolioPrefix: (tipo: Movimiento["tipo"]): string => {
    switch (tipo) {
      case "entrada":
        return "Entrada-";
      case "salida":
        return "Salida-";
      case "transferencia":
        return "Transferencia-";
      case "ajuste":
        return "Ajuste-";
      default:
        return "Movimiento-";
    }
  },

  getNextLocalFolio: (tipo: Movimiento["tipo"]): string => {
    const prefix = firestoreService.getFolioPrefix(tipo);
    const counters = getLocalStorageItem<Record<string, number>>("contadores_movimientos", {
      entrada: 0,
      salida: 0,
      transferencia: 0,
      ajuste: 0
    });

    const currentCount = counters[tipo] || 0;
    const nextNumber = currentCount + 1;
    counters[tipo] = nextNumber;
    setLocalStorageItem("contadores_movimientos", counters);

    return `${prefix}${nextNumber}`;
  },

  // --- REINICIO TOTAL DE INVENTARIO EN FIRESTORE Y LOCAL STORAGE ---
  runCompleteInventoryReset: async (): Promise<void> => {
    // 1. Eliminar datos antiguos de localStorage cuyo nombre comience con inventario_mvp_
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(STORAGE_PREFIX) || key.startsWith("inventario_mvp_"))) {
          if (key !== STORAGE_PREFIX + "currentUser" && key !== "currentUser") {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.error("Error al limpiar localStorage:", e);
    }

    if (isConfigured && realDb) {
      console.log("Iniciando reinicio total de inventario en Firestore...");
      const collectionsToWipe = [
        "productos",
        "stock",
        "movimientos",
        "resumen_ventas",
        "contadores",
        "migraciones"
      ];

      for (const colName of collectionsToWipe) {
        try {
          const snap = await getDocs(collection(realDb, colName));
          console.log(`Borrando ${snap.size} documentos de la colección '${colName}'...`);
          for (const docSnap of snap.docs) {
            try {
              await deleteDoc(doc(realDb, colName, docSnap.id));
            } catch (err) {
              console.error(`Error borrando ${colName}/${docSnap.id}:`, err);
            }
          }
        } catch (err) {
          console.error(`Error accediendo a colección '${colName}':`, err);
        }
      }

      console.log("Reinicio total de colecciones en Firestore completado con éxito.");
    } else {
      // Limpieza en modo local emulator
      setLocalStorageItem("productos", []);
      setLocalStorageItem("stock", {});
      setLocalStorageItem("movimientos", []);
      setLocalStorageItem("resumen_ventas", {});
      setLocalStorageItem("contadores_movimientos", {
        entrada: 0,
        salida: 0,
        transferencia: 0,
        ajuste: 0
      });
      notifyListeners("productos", []);
      notifyListeners("stock", []);
      notifyListeners("movimientos", []);
    }
  },

  // Compatibility aliases
  runFolioMigrationIfNeeded: async (): Promise<void> => {},
  runResumenVentasMigrationIfNeeded: async (): Promise<void> => {},
  runCleanupTestSkusIfNeeded: async (): Promise<void> => {},

  // --- REGISTRO ATÓMICO DE MOVIMIENTO VÍA RUNTRANSACTION ---
  registerMovimientoTransaction: async (mov: Omit<Movimiento, "fecha" | "usuario">): Promise<{ id: string; folio: string }> => {
    const user = authService.getCurrentUser();
    const usuarioEmail = user ? user.email : "sistema@empresa.com";
    const prefix = firestoreService.getFolioPrefix(mov.tipo);
    const cleanSku = mov.sku.trim().toUpperCase();
    const originAlmId = mov.almacen_id.trim();
    const destAlmId = mov.almacen_destino_id ? mov.almacen_destino_id.trim() : undefined;
    const moveQty = Number(mov.cantidad);

    if (isNaN(moveQty) || moveQty <= 0) {
      throw new Error("La cantidad debe ser un número positivo mayor a cero.");
    }

    if (!cleanSku) {
      throw new Error("El SKU del producto es obligatorio.");
    }

    if (!originAlmId) {
      throw new Error("El almacén de origen es obligatorio.");
    }

    // Fecha local YYYY-MM-DD para resúmenes de ventas
    const now = new Date();
    const todayStr = getLocalDateString(now);

    if (isConfigured && realDb) {
      // EN MODO FIREBASE: Ejecución 100% transaccional en la nube.
      // Si falla, el error se propaga hacia arriba y NUNCA se escribe en localStorage.
      const counterDocRef = doc(realDb, "contadores", mov.tipo);
      const movRef = doc(collection(realDb, "movimientos"));
      const docId = movRef.id;

      const originStockKey = `${cleanSku}_${originAlmId}`;
      const originStockRef = doc(realDb, "stock", originStockKey);

      const destStockKey = destAlmId ? `${cleanSku}_${destAlmId}` : null;
      const destStockRef = destStockKey ? doc(realDb, "stock", destStockKey) : null;

      // Resumen de ventas para salidas
      const summaryKey = `${todayStr}_${cleanSku}_${originAlmId}`;
      const resumenDocRef = mov.tipo === "salida" ? doc(realDb, "resumen_ventas", summaryKey) : null;

      let generatedFolio = "";

      await runTransaction(realDb, async (transaction) => {
        // 1. Lectura del contador de folios
        const counterSnap = await transaction.get(counterDocRef);
        let nextNumber = 1;
        if (counterSnap.exists()) {
          const data = counterSnap.data();
          if (typeof data?.ultimo_consecutivo === "number") {
            nextNumber = data.ultimo_consecutivo + 1;
          }
        }
        generatedFolio = `${prefix}${nextNumber}`;

        // 2. Lectura del stock de origen
        const originStockSnap = await transaction.get(originStockRef);
        const currentOriginQty = originStockSnap.exists() ? (Number(originStockSnap.data()?.cantidad) || 0) : 0;

        let newOriginQty = currentOriginQty;
        let newDestQty = 0;

        // 3. Procesamiento y validación de stock
        if (mov.tipo === "entrada") {
          newOriginQty = currentOriginQty + moveQty;
        } else if (mov.tipo === "salida") {
          if (currentOriginQty < moveQty) {
            throw new Error(`Stock insuficiente en el almacén seleccionado. Stock disponible: ${currentOriginQty} uds, solicitado: ${moveQty} uds.`);
          }
          newOriginQty = currentOriginQty - moveQty;
        } else if (mov.tipo === "transferencia") {
          if (!destStockRef || !destAlmId) {
            throw new Error("El almacén de destino es obligatorio para realizar una transferencia.");
          }
          if (originAlmId === destAlmId) {
            throw new Error("El almacén de origen y destino no pueden ser iguales.");
          }
          if (currentOriginQty < moveQty) {
            throw new Error(`Stock insuficiente en el almacén de origen. Stock disponible: ${currentOriginQty} uds, solicitado: ${moveQty} uds.`);
          }

          const destStockSnap = await transaction.get(destStockRef);
          const currentDestQty = destStockSnap.exists() ? (Number(destStockSnap.data()?.cantidad) || 0) : 0;

          newOriginQty = currentOriginQty - moveQty;
          newDestQty = currentDestQty + moveQty;

          // Escritura de stock en destino
          transaction.set(destStockRef, {
            id: destStockKey,
            sku: cleanSku,
            almacen_id: destAlmId,
            cantidad: newDestQty,
            actualizado: Timestamp.now()
          }, { merge: true });
        }

        // 4. Lectura y actualización de resumen de ventas si es salida
        if (mov.tipo === "salida" && resumenDocRef) {
          const resumenSnap = await transaction.get(resumenDocRef);
          const prevQty = resumenSnap.exists() ? (Number(resumenSnap.data()?.cantidad) || 0) : 0;
          const prevTotal = resumenSnap.exists() ? (Number(resumenSnap.data()?.total_transacciones) || 0) : 0;

          transaction.set(resumenDocRef, {
            id: summaryKey,
            fecha_str: todayStr,
            fecha: Timestamp.now(),
            sku: cleanSku,
            almacen_id: originAlmId,
            cantidad: prevQty + moveQty,
            total_transacciones: prevTotal + 1,
            actualizado: Timestamp.now()
          }, { merge: true });
        }

        // 5. Escritura de stock en origen
        transaction.set(originStockRef, {
          id: originStockKey,
          sku: cleanSku,
          almacen_id: originAlmId,
          cantidad: newOriginQty,
          actualizado: Timestamp.now()
        }, { merge: true });

        // 6. Actualización del contador secuencial
        transaction.set(counterDocRef, {
          tipo: mov.tipo,
          ultimo_consecutivo: nextNumber,
          actualizado: Timestamp.now()
        }, { merge: true });

        // 7. Escritura del documento de movimiento
        transaction.set(movRef, {
          folio: generatedFolio,
          sku: cleanSku,
          almacen_id: originAlmId,
          tipo: mov.tipo,
          cantidad: moveQty,
          referencia: mov.referencia,
          usuario: usuarioEmail,
          fecha: Timestamp.now(),
          estado: "activo",
          ...(destAlmId ? { almacen_destino_id: destAlmId } : {})
        });
      });

      return { id: docId, folio: generatedFolio };
    }

    // --- MODO EMULADOR LOCAL (SOLO CUANDO FIREBASE NO ESTÁ CONFIGURADO) ---
    const stockMap = getLocalStorageItem<Record<string, StockItem>>("stock", {});
    const originKey = `${cleanSku}_${originAlmId}`;
    const currentOrigin = stockMap[originKey]?.cantidad || 0;

    if (mov.tipo === "salida" && currentOrigin < moveQty) {
      throw new Error(`Stock insuficiente en el almacén seleccionado. Stock disponible: ${currentOrigin} uds, solicitado: ${moveQty} uds.`);
    }

    if (mov.tipo === "transferencia") {
      if (!destAlmId) throw new Error("El almacén de destino es obligatorio para transferencias.");
      if (originAlmId === destAlmId) throw new Error("El almacén de origen y destino no pueden ser iguales.");
      if (currentOrigin < moveQty) {
        throw new Error(`Stock insuficiente en el almacén de origen. Stock disponible: ${currentOrigin} uds, solicitado: ${moveQty} uds.`);
      }
    }

    const generatedFolio = firestoreService.getNextLocalFolio(mov.tipo);
    const docId = "mov_" + Math.random().toString(36).substr(2, 9);

    if (mov.tipo === "entrada") {
      stockMap[originKey] = {
        id: originKey,
        sku: cleanSku,
        almacen_id: originAlmId,
        cantidad: currentOrigin + moveQty,
        actualizado: new Date()
      };
    } else if (mov.tipo === "salida") {
      stockMap[originKey] = {
        id: originKey,
        sku: cleanSku,
        almacen_id: originAlmId,
        cantidad: currentOrigin - moveQty,
        actualizado: new Date()
      };

      // Actualizar resumen incremental local
      const summaryMap = getLocalStorageItem<Record<string, ResumenVentaDiaria>>("resumen_ventas", {});
      const summaryKey = `${todayStr}_${cleanSku}_${originAlmId}`;
      const prev = summaryMap[summaryKey];
      summaryMap[summaryKey] = {
        id: summaryKey,
        fecha_str: todayStr,
        fecha: new Date(),
        sku: cleanSku,
        almacen_id: originAlmId,
        cantidad: (prev?.cantidad || 0) + moveQty,
        total_transacciones: (prev?.total_transacciones || 0) + 1,
        actualizado: new Date()
      };
      setLocalStorageItem("resumen_ventas", summaryMap);
    } else if (mov.tipo === "transferencia" && destAlmId) {
      const destKey = `${cleanSku}_${destAlmId}`;
      const currentDest = stockMap[destKey]?.cantidad || 0;

      stockMap[originKey] = {
        id: originKey,
        sku: cleanSku,
        almacen_id: originAlmId,
        cantidad: currentOrigin - moveQty,
        actualizado: new Date()
      };

      stockMap[destKey] = {
        id: destKey,
        sku: cleanSku,
        almacen_id: destAlmId,
        cantidad: currentDest + moveQty,
        actualizado: new Date()
      };
    }

    setLocalStorageItem("stock", stockMap);
    notifyListeners("stock", stockMap);

    const movimientos = getLocalStorageItem<Movimiento[]>("movimientos", []);
    const nuevoMovimiento: Movimiento = {
      id: docId,
      folio: generatedFolio,
      sku: cleanSku,
      almacen_id: originAlmId,
      tipo: mov.tipo,
      cantidad: moveQty,
      referencia: mov.referencia,
      usuario: usuarioEmail,
      fecha: new Date(),
      estado: "activo",
      ...(destAlmId ? { almacen_destino_id: destAlmId } : {})
    };

    movimientos.push(nuevoMovimiento);
    setLocalStorageItem("movimientos", movimientos);
    notifyListeners("movimientos", movimientos);

    return { id: docId, folio: generatedFolio };
  },

  // --- ANULACIÓN ATÓMICA DE MOVIMIENTO VÍA RUNTRANSACTION ---
  anularMovimiento: async (id: string, motivo = "Anulado por el usuario"): Promise<void> => {
    const user = authService.getCurrentUser();
    const usuarioEmail = user ? user.email : "sistema@empresa.com";

    if (isConfigured && realDb) {
      // EN MODO FIREBASE: Si falla o no hay stock para revertir, lanza el error y no toca localStorage
      const movRef = doc(realDb, "movimientos", id);

      await runTransaction(realDb, async (transaction) => {
        // 1. Lectura del movimiento
        const movSnap = await transaction.get(movRef);
        if (!movSnap.exists()) {
          throw new Error("El movimiento que intentas anular no existe en el sistema.");
        }

        const movData = movSnap.data();

        // 2. Validación estricta anti-doble anulación
        if (movData.estado === "anulado") {
          throw new Error("Este movimiento ya ha sido anulado previamente. No se puede anular dos veces.");
        }

        const sku = (movData.sku || "").trim().toUpperCase();
        const originAlmId = movData.almacen_id;
        const destAlmId = movData.almacen_destino_id;
        const qty = Number(movData.cantidad) || 0;
        const tipo = movData.tipo;

        const originStockKey = `${sku}_${originAlmId}`;
        const originStockRef = doc(realDb, "stock", originStockKey);

        // 3. Reversión de stock
        if (tipo === "entrada") {
          const originSnap = await transaction.get(originStockRef);
          const currentOrigin = originSnap.exists() ? (Number(originSnap.data()?.cantidad) || 0) : 0;

          if (currentOrigin < qty) {
            throw new Error(`No se puede anular la entrada: el stock actual (${currentOrigin} uds) en el almacén es menor a la cantidad a revertir (${qty} uds).`);
          }

          transaction.set(originStockRef, {
            id: originStockKey,
            sku,
            almacen_id: originAlmId,
            cantidad: currentOrigin - qty,
            actualizado: Timestamp.now()
          }, { merge: true });
        } else if (tipo === "salida") {
          const originSnap = await transaction.get(originStockRef);
          const currentOrigin = originSnap.exists() ? (Number(originSnap.data()?.cantidad) || 0) : 0;

          transaction.set(originStockRef, {
            id: originStockKey,
            sku,
            almacen_id: originAlmId,
            cantidad: currentOrigin + qty,
            actualizado: Timestamp.now()
          }, { merge: true });

          // Descontar del resumen incremental de ventas
          const dateStr = getLocalDateString(movData.fecha);
          const summaryKey = `${dateStr}_${sku}_${originAlmId}`;
          const resumenDocRef = doc(realDb, "resumen_ventas", summaryKey);
          const resumenSnap = await transaction.get(resumenDocRef);

          if (resumenSnap.exists()) {
            const prevQty = Number(resumenSnap.data()?.cantidad) || 0;
            const prevTotal = Number(resumenSnap.data()?.total_transacciones) || 0;
            transaction.set(resumenDocRef, {
              cantidad: Math.max(0, prevQty - qty),
              total_transacciones: Math.max(0, prevTotal - 1),
              actualizado: Timestamp.now()
            }, { merge: true });
          }
        } else if (tipo === "transferencia") {
          if (!destAlmId) {
            throw new Error("Datos de transferencia incompletos: falta almacén de destino.");
          }

          const destStockKey = `${sku}_${destAlmId}`;
          const destStockRef = doc(realDb, "stock", destStockKey);

          const destSnap = await transaction.get(destStockRef);
          const currentDest = destSnap.exists() ? (Number(destSnap.data()?.cantidad) || 0) : 0;

          if (currentDest < qty) {
            throw new Error(`No se puede anular la transferencia: el almacén de destino no tiene suficiente stock (${currentDest} uds) para devolver las ${qty} uds.`);
          }

          const originSnap = await transaction.get(originStockRef);
          const currentOrigin = originSnap.exists() ? (Number(originSnap.data()?.cantidad) || 0) : 0;

          transaction.set(originStockRef, {
            id: originStockKey,
            sku,
            almacen_id: originAlmId,
            cantidad: currentOrigin + qty,
            actualizado: Timestamp.now()
          }, { merge: true });

          transaction.set(destStockRef, {
            id: destStockKey,
            sku,
            almacen_id: destAlmId,
            cantidad: currentDest - qty,
            actualizado: Timestamp.now()
          }, { merge: true });
        }

        // 4. Marca el documento como anulado
        transaction.update(movRef, {
          estado: "anulado",
          anulado_at: Timestamp.now(),
          anulado_por: usuarioEmail,
          motivo_anulacion: motivo
        });
      });

      return;
    }

    // --- MODO EMULADOR LOCAL ---
    const movimientos = getLocalStorageItem<Movimiento[]>("movimientos", []);
    const movIndex = movimientos.findIndex(m => m.id === id);

    if (movIndex === -1) {
      throw new Error("El movimiento no existe en el sistema.");
    }

    const mov = movimientos[movIndex];
    if (mov.estado === "anulado") {
      throw new Error("Este movimiento ya ha sido anulado previamente. No se puede anular dos veces.");
    }

    const sku = (mov.sku || "").trim().toUpperCase();
    const qty = Number(mov.cantidad) || 0;
    const stockMap = getLocalStorageItem<Record<string, StockItem>>("stock", {});
    const originKey = `${sku}_${mov.almacen_id}`;
    const currentOrigin = stockMap[originKey]?.cantidad || 0;

    if (mov.tipo === "entrada") {
      if (currentOrigin < qty) {
        throw new Error(`No se puede anular la entrada: el stock actual (${currentOrigin} uds) en el almacén es menor a la cantidad a revertir (${qty} uds).`);
      }
      stockMap[originKey] = {
        id: originKey,
        sku,
        almacen_id: mov.almacen_id,
        cantidad: currentOrigin - qty,
        actualizado: new Date()
      };
    } else if (mov.tipo === "salida") {
      stockMap[originKey] = {
        id: originKey,
        sku,
        almacen_id: mov.almacen_id,
        cantidad: currentOrigin + qty,
        actualizado: new Date()
      };

      // Descontar del resumen incremental
      const summaryMap = getLocalStorageItem<Record<string, ResumenVentaDiaria>>("resumen_ventas", {});
      const dateStr = getLocalDateString(mov.fecha);
      const summaryKey = `${dateStr}_${sku}_${mov.almacen_id}`;
      if (summaryMap[summaryKey]) {
        const prev = summaryMap[summaryKey];
        summaryMap[summaryKey] = {
          ...prev,
          cantidad: Math.max(0, prev.cantidad - qty),
          total_transacciones: Math.max(0, prev.total_transacciones - 1),
          actualizado: new Date()
        };
        setLocalStorageItem("resumen_ventas", summaryMap);
      }
    } else if (mov.tipo === "transferencia" && mov.almacen_destino_id) {
      const destKey = `${sku}_${mov.almacen_destino_id}`;
      const currentDest = stockMap[destKey]?.cantidad || 0;

      if (currentDest < qty) {
        throw new Error(`No se puede anular la transferencia: el almacén de destino no tiene suficiente stock (${currentDest} uds) para devolver las ${qty} uds.`);
      }

      stockMap[originKey] = {
        id: originKey,
        sku,
        almacen_id: mov.almacen_id,
        cantidad: currentOrigin + qty,
        actualizado: new Date()
      };

      stockMap[destKey] = {
        id: destKey,
        sku,
        almacen_id: mov.almacen_destino_id,
        cantidad: currentDest - qty,
        actualizado: new Date()
      };
    }

    setLocalStorageItem("stock", stockMap);
    notifyListeners("stock", stockMap);

    movimientos[movIndex] = {
      ...mov,
      estado: "anulado",
      anulado_at: new Date(),
      anulado_por: usuarioEmail,
      motivo_anulacion: motivo
    };

    setLocalStorageItem("movimientos", movimientos);
    notifyListeners("movimientos", movimientos);
  },

  deleteMovimiento: async (id: string): Promise<void> => {
    await firestoreService.anularMovimiento(id, "Anulación directa de registro");
  },

  // --- HISTORIAL PAGINADO DE AUDITORÍA (50 EN 50) ---
  getMovimientosPaginated: async (options: {
    pageSize?: number;
    lastDoc?: any;
    skuFilter?: string;
    warehouseFilter?: string;
    tipoFilter?: string;
    estadoFilter?: string;
  } = {}): Promise<{
    items: Movimiento[];
    lastDoc: any;
    hasMore: boolean;
    totalLoaded: number;
  }> => {
    const pageSize = options.pageSize || 50;

    if (isConfigured && realDb) {
      let qConstraints: any[] = [orderBy("fecha", "desc"), limit(pageSize + 1)];

      if (options.skuFilter) {
        qConstraints.unshift(where("sku", "==", options.skuFilter.trim().toUpperCase()));
      }
      if (options.warehouseFilter && options.warehouseFilter !== "all") {
        qConstraints.unshift(where("almacen_id", "==", options.warehouseFilter));
      }
      if (options.tipoFilter && options.tipoFilter !== "all") {
        qConstraints.unshift(where("tipo", "==", options.tipoFilter));
      }
      if (options.estadoFilter && options.estadoFilter !== "all") {
        qConstraints.unshift(where("estado", "==", options.estadoFilter));
      }

      if (options.lastDoc) {
        qConstraints.push(startAfter(options.lastDoc));
      }

      const q = query(collection(realDb, "movimientos"), ...qConstraints);
      const snap = await getDocs(q);

      const docs = snap.docs;
      const hasMore = docs.length > pageSize;
      const itemsToProcess = hasMore ? docs.slice(0, pageSize) : docs;
      const nextLastDoc = itemsToProcess.length > 0 ? itemsToProcess[itemsToProcess.length - 1] : null;

      const list: Movimiento[] = itemsToProcess.map(d => {
        const data = d.data();
        return {
          id: d.id,
          folio: data.folio,
          sku: data.sku,
          almacen_id: data.almacen_id,
          tipo: data.tipo,
          cantidad: data.cantidad,
          referencia: data.referencia,
          usuario: data.usuario,
          fecha: data.fecha ? (data.fecha as Timestamp).toDate() : new Date(),
          almacen_destino_id: data.almacen_destino_id,
          estado: data.estado || "activo",
          anulado_at: data.anulado_at ? (data.anulado_at as Timestamp).toDate() : undefined,
          anulado_por: data.anulado_por,
          motivo_anulacion: data.motivo_anulacion
        };
      });

      return {
        items: list,
        lastDoc: nextLastDoc,
        hasMore,
        totalLoaded: list.length
      };
    }

    // Modo local
    let movs = getLocalStorageItem<Movimiento[]>("movimientos", []);
    movs = movs.map(m => ({
      ...m,
      fecha: typeof m.fecha === "string" ? new Date(m.fecha) : m.fecha,
      estado: m.estado || "activo",
      anulado_at: m.anulado_at ? (typeof m.anulado_at === "string" ? new Date(m.anulado_at) : m.anulado_at) : undefined
    }));

    movs.sort((a, b) => {
      const timeA = a.fecha instanceof Date ? a.fecha.getTime() : new Date((a.fecha as any).seconds * 1000).getTime();
      const timeB = b.fecha instanceof Date ? b.fecha.getTime() : new Date((b.fecha as any).seconds * 1000).getTime();
      return timeB - timeA;
    });

    if (options.skuFilter) {
      const s = options.skuFilter.trim().toLowerCase();
      movs = movs.filter(m => 
        m.sku.toLowerCase().includes(s) || 
        (m.folio && m.folio.toLowerCase().includes(s)) ||
        (m.referencia && m.referencia.toLowerCase().includes(s))
      );
    }
    if (options.warehouseFilter && options.warehouseFilter !== "all") {
      movs = movs.filter(m => m.almacen_id === options.warehouseFilter || m.almacen_destino_id === options.warehouseFilter);
    }
    if (options.tipoFilter && options.tipoFilter !== "all") {
      movs = movs.filter(m => m.tipo === options.tipoFilter);
    }
    if (options.estadoFilter && options.estadoFilter !== "all") {
      movs = movs.filter(m => (m.estado || "activo") === options.estadoFilter);
    }

    const startIndex = typeof options.lastDoc === "number" ? options.lastDoc : 0;
    const pageItems = movs.slice(startIndex, startIndex + pageSize);
    const nextIndex = startIndex + pageItems.length;
    const hasMore = nextIndex < movs.length;

    return {
      items: pageItems,
      lastDoc: nextIndex,
      hasMore,
      totalLoaded: pageItems.length
    };
  },

  getMovimientos: async (skuFilter?: string): Promise<Movimiento[]> => {
    const res = await firestoreService.getMovimientosPaginated({ pageSize: 100, skuFilter });
    return res.items;
  },

  // --- CONSULTA OPTIMIZADA DE RESÚMENES INCREMENTALES DE VENTAS ---
  getResumenVentasByDateRange: async (startDate: Date, endDate: Date): Promise<ResumenVentaDiaria[]> => {
    const startStr = getLocalDateString(startDate);
    const endStr = getLocalDateString(endDate);

    if (isConfigured && realDb) {
      const q = query(
        collection(realDb, "resumen_ventas"),
        where("fecha_str", ">=", startStr),
        where("fecha_str", "<=", endStr)
      );

      const snap = await getDocs(q);
      const list: ResumenVentaDiaria[] = [];

      snap.forEach(d => {
        const data = d.data();
        if (Number(data.cantidad) > 0) {
          list.push({
            id: d.id,
            fecha_str: data.fecha_str,
            fecha: data.fecha ? (data.fecha as Timestamp).toDate() : new Date(),
            sku: data.sku,
            almacen_id: data.almacen_id,
            cantidad: Number(data.cantidad) || 0,
            total_transacciones: Number(data.total_transacciones) || 1,
            actualizado: data.actualizado ? (data.actualizado as Timestamp).toDate() : undefined
          });
        }
      });

      return list;
    }

    // Modo emulador local
    const summaryMap = getLocalStorageItem<Record<string, ResumenVentaDiaria>>("resumen_ventas", {});
    return Object.values(summaryMap).filter(item => {
      const f = item.fecha_str;
      return f >= startStr && f <= endStr && item.cantidad > 0;
    });
  },

  // Fallback para consultas directas de movimientos de salida si fuera necesario
  getVentasByDateRange: async (startDate: Date, endDate: Date): Promise<Movimiento[]> => {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    if (isConfigured && realDb) {
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      const q = query(
        collection(realDb, "movimientos"),
        where("tipo", "==", "salida"),
        where("fecha", ">=", startTimestamp),
        where("fecha", "<=", endTimestamp),
        orderBy("fecha", "desc")
      );

      const snap = await getDocs(q);
      const list: Movimiento[] = [];

      snap.forEach(d => {
        const data = d.data();
        if (data.estado === "anulado") return;

        list.push({
          id: d.id,
          folio: data.folio,
          sku: data.sku,
          almacen_id: data.almacen_id,
          tipo: "salida",
          cantidad: Number(data.cantidad) || 0,
          referencia: data.referencia,
          usuario: data.usuario,
          fecha: data.fecha ? (data.fecha as Timestamp).toDate() : new Date(),
          estado: data.estado || "activo"
        });
      });

      return list;
    }

    const movs = getLocalStorageItem<Movimiento[]>("movimientos", []);
    return movs.filter(m => {
      if (m.tipo !== "salida" || m.estado === "anulado") return false;
      const mDate = m.fecha instanceof Date ? m.fecha : new Date(typeof m.fecha === "string" ? m.fecha : (m.fecha as any).seconds * 1000);
      const time = mDate.getTime();
      return time >= startMs && time <= endMs;
    }).map(m => ({
      ...m,
      fecha: m.fecha instanceof Date ? m.fecha : new Date(typeof m.fecha === "string" ? m.fecha : (m.fecha as any).seconds * 1000),
      estado: m.estado || "activo"
    }));
  },

  // --- CATÁLOGOS DINÁMICOS ---
  seedAndImportCatalogos: async (): Promise<{ categorias: CategoriaCatalogo[]; unidades: UnidadMedidaCatalogo[] }> => {
    const defaultCategorias: CategoriaCatalogo[] = [
      { id: "cat_tec", nombre: "Tecnología", activa: true },
      { id: "cat_ofi", nombre: "Oficina", activa: true },
      { id: "cat_alim", nombre: "Alimentos y Bebidas", activa: true },
      { id: "cat_limp", nombre: "Limpieza", activa: true },
      { id: "cat_ferr", nombre: "Ferretería", activa: true },
      { id: "cat_pape", nombre: "Papelería", activa: true }
    ];

    const defaultUnidades: UnidadMedidaCatalogo[] = [
      { id: "uni_pza", nombre: "Pieza", abreviatura: "pza", activa: true },
      { id: "uni_uds", nombre: "Unidad", abreviatura: "uds", activa: true },
      { id: "uni_cja", nombre: "Caja", abreviatura: "cja", activa: true },
      { id: "uni_paq", nombre: "Paquete", abreviatura: "paq", activa: true },
      { id: "uni_kg", nombre: "Kilogramo", abreviatura: "kg", activa: true },
      { id: "uni_l", nombre: "Litro", abreviatura: "l", activa: true },
      { id: "uni_m", nombre: "Metro", abreviatura: "m", activa: true },
      { id: "uni_rll", nombre: "Rollo", abreviatura: "rll", activa: true }
    ];

    if (isConfigured && realDb) {
      const catsSnap = await getDocs(collection(realDb, "catalogo_categorias"));
      const unitsSnap = await getDocs(collection(realDb, "catalogo_unidades"));

      if (catsSnap.empty) {
        for (const cat of defaultCategorias) {
          await setDoc(doc(realDb, "catalogo_categorias", cat.id), {
            nombre: cat.nombre,
            activa: cat.activa,
            creado: Timestamp.now()
          });
        }
      }

      if (unitsSnap.empty) {
        for (const unit of defaultUnidades) {
          await setDoc(doc(realDb, "catalogo_unidades", unit.id), {
            nombre: unit.nombre,
            abreviatura: unit.abreviatura,
            activa: unit.activa,
            creado: Timestamp.now()
          });
        }
      }

      const freshCats = await firestoreService.getCategorias();
      const freshUnits = await firestoreService.getUnidades();
      return { categorias: freshCats, unidades: freshUnits };
    }

    let currentCats = getLocalStorageItem<CategoriaCatalogo[]>("categorias", []);
    let currentUnits = getLocalStorageItem<UnidadMedidaCatalogo[]>("unidades", []);

    if (currentCats.length === 0) {
      currentCats = [...defaultCategorias];
    }
    if (currentUnits.length === 0) {
      currentUnits = [...defaultUnidades];
    }

    setLocalStorageItem("categorias", currentCats);
    setLocalStorageItem("unidades", currentUnits);
    return { categorias: currentCats, unidades: currentUnits };
  },

  getCategorias: async (): Promise<CategoriaCatalogo[]> => {
    if (isConfigured && realDb) {
      const snap = await getDocs(collection(realDb, "catalogo_categorias"));
      const list: CategoriaCatalogo[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as CategoriaCatalogo);
      });
      return list;
    }
    const local = getLocalStorageItem<CategoriaCatalogo[]>("categorias", []);
    if (local.length === 0) {
      const res = await firestoreService.seedAndImportCatalogos();
      return res.categorias;
    }
    return local;
  },

  getCategoriasRealtime: (onUpdate: (cats: CategoriaCatalogo[]) => void): (() => void) => {
    if (isConfigured && realDb) {
      return onSnapshot(
        collection(realDb, "catalogo_categorias"),
        (snap) => {
          const list: CategoriaCatalogo[] = [];
          snap.forEach(d => {
            list.push({ id: d.id, ...d.data() } as CategoriaCatalogo);
          });
          onUpdate(list);
        },
        (error) => {
          console.error("Error en listener de categorías:", error);
        }
      );
    }

    const update = () => {
      const list = getLocalStorageItem<CategoriaCatalogo[]>("categorias", []);
      onUpdate(list);
    };
    update();
    listeners.categorias.push(update);
    return () => {
      listeners.categorias = listeners.categorias.filter(cb => cb !== update);
    };
  },

  addCategoria: async (nombre: string): Promise<string> => {
    const cleanNombre = nombre.trim();
    if (!cleanNombre) throw new Error("El nombre de la categoría es obligatorio.");

    const list = await firestoreService.getCategorias();
    const isDuplicate = list.some(c => c.nombre.trim().toLowerCase() === cleanNombre.toLowerCase());
    if (isDuplicate) {
      throw new Error(`La categoría "${cleanNombre}" ya existe en el catálogo.`);
    }

    const newId = "cat_" + Math.random().toString(36).substr(2, 9);
    const newCat: CategoriaCatalogo = {
      id: newId,
      nombre: cleanNombre,
      activa: true,
      creado: new Date()
    };

    if (isConfigured && realDb) {
      const docRef = doc(realDb, "catalogo_categorias", newId);
      await setDoc(docRef, {
        nombre: cleanNombre,
        activa: true,
        creado: Timestamp.now()
      });
      return newId;
    }

    list.push(newCat);
    setLocalStorageItem("categorias", list);
    notifyListeners("categorias", list);
    return newId;
  },

  updateCategoria: async (id: string, data: Partial<Omit<CategoriaCatalogo, "id">>): Promise<void> => {
    if (isConfigured && realDb) {
      const docRef = doc(realDb, "catalogo_categorias", id);
      await setDoc(docRef, data, { merge: true });
      return;
    }
    const list = getLocalStorageItem<CategoriaCatalogo[]>("categorias", []);
    const index = list.findIndex(c => c.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...data };
      setLocalStorageItem("categorias", list);
      notifyListeners("categorias", list);
    }
  },

  renameCategoriaAndSyncProducts: async (id: string, oldNombre: string, newNombre: string): Promise<void> => {
    const cleanOld = oldNombre.trim();
    const cleanNew = newNombre.trim();
    if (!cleanNew) throw new Error("El nuevo nombre no puede estar vacío.");

    const cats = await firestoreService.getCategorias();
    const duplicate = cats.some(c => c.id !== id && c.nombre.trim().toLowerCase() === cleanNew.toLowerCase());
    if (duplicate) {
      throw new Error(`Ya existe otra categoría con el nombre "${cleanNew}".`);
    }

    await firestoreService.updateCategoria(id, { nombre: cleanNew });

    if (isConfigured && realDb) {
      const prodsSnap = await getDocs(collection(realDb, "productos"));
      for (const d of prodsSnap.docs) {
        const p = d.data();
        if (p.categoria && p.categoria.trim().toLowerCase() === cleanOld.toLowerCase()) {
          await setDoc(doc(realDb, "productos", d.id), { categoria: cleanNew }, { merge: true });
        }
      }
      return;
    }

    const productos = getLocalStorageItem<Producto[]>("productos", []);
    let modifiedAny = false;

    productos.forEach(p => {
      if (p.categoria && p.categoria.trim().toLowerCase() === cleanOld.toLowerCase()) {
        p.categoria = cleanNew;
        modifiedAny = true;
      }
    });

    if (modifiedAny) {
      setLocalStorageItem("productos", productos);
      notifyListeners("productos", productos);
    }
  },

  toggleCategoriaStatus: async (id: string, activa: boolean): Promise<void> => {
    await firestoreService.updateCategoria(id, { activa });
  },

  deleteCategoria: async (id: string): Promise<void> => {
    if (isConfigured && realDb) {
      const docRef = doc(realDb, "catalogo_categorias", id);
      await deleteDoc(docRef);
      return;
    }
    const list = getLocalStorageItem<CategoriaCatalogo[]>("categorias", []);
    const updated = list.filter(c => c.id !== id);
    setLocalStorageItem("categorias", updated);
    notifyListeners("categorias", updated);
  },

  // --- UNIDADES DE MEDIDA ---
  getUnidades: async (): Promise<UnidadMedidaCatalogo[]> => {
    if (isConfigured && realDb) {
      const snap = await getDocs(collection(realDb, "catalogo_unidades"));
      const list: UnidadMedidaCatalogo[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as UnidadMedidaCatalogo);
      });
      return list;
    }
    const local = getLocalStorageItem<UnidadMedidaCatalogo[]>("unidades", []);
    if (local.length === 0) {
      const res = await firestoreService.seedAndImportCatalogos();
      return res.unidades;
    }
    return local;
  },

  getUnidadesRealtime: (onUpdate: (units: UnidadMedidaCatalogo[]) => void): (() => void) => {
    if (isConfigured && realDb) {
      return onSnapshot(
        collection(realDb, "catalogo_unidades"),
        (snap) => {
          const list: UnidadMedidaCatalogo[] = [];
          snap.forEach(d => {
            list.push({ id: d.id, ...d.data() } as UnidadMedidaCatalogo);
          });
          onUpdate(list);
        },
        (error) => {
          console.error("Error en listener de unidades:", error);
        }
      );
    }

    const update = () => {
      const list = getLocalStorageItem<UnidadMedidaCatalogo[]>("unidades", []);
      onUpdate(list);
    };
    update();
    listeners.unidades.push(update);
    return () => {
      listeners.unidades = listeners.unidades.filter(cb => cb !== update);
    };
  },

  addUnidad: async (nombre: string, abreviatura: string): Promise<string> => {
    const cleanNombre = nombre.trim();
    const cleanAbrev = abreviatura.trim().toLowerCase();
    if (!cleanNombre) throw new Error("El nombre de la unidad es obligatorio.");
    if (!cleanAbrev) throw new Error("La abreviatura de la unidad es obligatoria.");

    const list = await firestoreService.getUnidades();
    const duplicateNombre = list.some(u => u.nombre.trim().toLowerCase() === cleanNombre.toLowerCase());
    if (duplicateNombre) {
      throw new Error(`La unidad de medida "${cleanNombre}" ya existe.`);
    }

    const duplicateAbrev = list.some(u => u.abreviatura.trim().toLowerCase() === cleanAbrev);
    if (duplicateAbrev) {
      throw new Error(`La abreviatura "${cleanAbrev}" ya está asignada a otra unidad de medida.`);
    }

    const newId = "uni_" + Math.random().toString(36).substr(2, 9);
    const newUnit: UnidadMedidaCatalogo = {
      id: newId,
      nombre: cleanNombre,
      abreviatura: cleanAbrev,
      activa: true,
      creado: new Date()
    };

    if (isConfigured && realDb) {
      const docRef = doc(realDb, "catalogo_unidades", newId);
      await setDoc(docRef, {
        nombre: cleanNombre,
        abreviatura: cleanAbrev,
        activa: true,
        creado: Timestamp.now()
      });
      return newId;
    }

    list.push(newUnit);
    setLocalStorageItem("unidades", list);
    notifyListeners("unidades", list);
    return newId;
  },

  updateUnidad: async (id: string, data: Partial<Omit<UnidadMedidaCatalogo, "id">>): Promise<void> => {
    if (isConfigured && realDb) {
      const docRef = doc(realDb, "catalogo_unidades", id);
      await setDoc(docRef, data, { merge: true });
      return;
    }
    const list = getLocalStorageItem<UnidadMedidaCatalogo[]>("unidades", []);
    const index = list.findIndex(u => u.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...data };
      setLocalStorageItem("unidades", list);
      notifyListeners("unidades", list);
    }
  },

  renameUnidadAndSyncProducts: async (id: string, oldAbreviatura: string, newAbreviatura: string, newNombre: string): Promise<void> => {
    const cleanOldAbrev = oldAbreviatura.trim().toLowerCase();
    const cleanNewAbrev = newAbreviatura.trim().toLowerCase();
    const cleanNewNombre = newNombre.trim();

    if (!cleanNewNombre) throw new Error("El nombre de la unidad no puede estar vacío.");
    if (!cleanNewAbrev) throw new Error("La abreviatura no puede estar vacía.");

    const units = await firestoreService.getUnidades();
    const duplicateNombre = units.some(u => u.id !== id && u.nombre.trim().toLowerCase() === cleanNewNombre.toLowerCase());
    if (duplicateNombre) {
      throw new Error(`Ya existe otra unidad de medida con el nombre "${cleanNewNombre}".`);
    }

    const duplicateAbrev = units.some(u => u.id !== id && u.abreviatura.trim().toLowerCase() === cleanNewAbrev);
    if (duplicateAbrev) {
      throw new Error(`La abreviatura "${cleanNewAbrev}" ya está asignada a otra unidad de medida.`);
    }

    await firestoreService.updateUnidad(id, { nombre: cleanNewNombre, abreviatura: cleanNewAbrev });

    if (isConfigured && realDb) {
      const prodsSnap = await getDocs(collection(realDb, "productos"));
      for (const d of prodsSnap.docs) {
        const p = d.data();
        if ((p.unidad || "").trim().toLowerCase() === cleanOldAbrev) {
          await setDoc(doc(realDb, "productos", d.id), { unidad: cleanNewAbrev }, { merge: true });
        }
      }
      return;
    }

    const productos = getLocalStorageItem<Producto[]>("productos", []);
    let modifiedAny = false;

    productos.forEach(p => {
      const prodUnitLower = (p.unidad || "").trim().toLowerCase();
      if (prodUnitLower === cleanOldAbrev) {
        p.unidad = cleanNewAbrev;
        modifiedAny = true;
      }
    });

    if (modifiedAny) {
      setLocalStorageItem("productos", productos);
      notifyListeners("productos", productos);
    }
  },

  toggleUnidadStatus: async (id: string, activa: boolean): Promise<void> => {
    await firestoreService.updateUnidad(id, { activa });
  },

  deleteUnidad: async (id: string): Promise<void> => {
    if (isConfigured && realDb) {
      const docRef = doc(realDb, "catalogo_unidades", id);
      await deleteDoc(docRef);
      return;
    }
    const list = getLocalStorageItem<UnidadMedidaCatalogo[]>("unidades", []);
    const updated = list.filter(u => u.id !== id);
    setLocalStorageItem("unidades", updated);
    notifyListeners("unidades", updated);
  }
};
