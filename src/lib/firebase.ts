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
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData
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
import { Almacen, Producto, StockItem, Movimiento, Usuario, CategoriaCatalogo, UnidadMedidaCatalogo } from "../types";

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
    console.log("Firebase initialized successfully with auto-detect long polling and resilient offline fallback.");
  } catch (error) {
    console.error("Failed to initialize Firebase with real config, falling back to local emulator:", error);
  }
} else {
  console.log("Firebase configuration is missing or default. Operating in high-fidelity Local Emulator mode.");
}

// --- LOCAL STORAGE HIGH-FIDELITY EMULATOR ---
const STORAGE_PREFIX = "inventario_mvp_";

const getLocalStorageItem = <T>(key: string, defaultValue: T): T => {
  const value = localStorage.getItem(STORAGE_PREFIX + key);
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
};

const setLocalStorageItem = <T>(key: string, value: T): void => {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
};

// Seed initial data if first time running
const seedData = () => {
  const seededVersion = localStorage.getItem(STORAGE_PREFIX + "seeded_version");
  if (seededVersion !== "v4_atomic_inventory_engine") {
    // 1. Almacenes
    const almacenes: Almacen[] = [
      { id: "alm_1", nombre: "Almacén Central", ubicacion: "Madrid, España" },
      { id: "alm_2", nombre: "Almacén Norte", ubicacion: "Bilbao, España" },
      { id: "alm_3", nombre: "Almacén Sur", ubicacion: "Sevilla, España" }
    ];
    setLocalStorageItem("almacenes", almacenes);

    // 2. Productos
    const productos: Producto[] = [
      { sku: "SKU-1001", nombre: "Laptop Pro 15 pulgadas", categoria: "Tecnología", stock_minimo: 5, unidad: "uds" },
      { sku: "SKU-1002", nombre: "Monitor UltraWide 34\"", categoria: "Tecnología", stock_minimo: 3, unidad: "uds" },
      { sku: "SKU-1003", nombre: "Silla Ergonómica Premium", categoria: "Oficina", stock_minimo: 10, unidad: "uds" },
      { sku: "SKU-1004", nombre: "Teclado Mecánico Inalámbrico", categoria: "Tecnología", stock_minimo: 8, unidad: "uds" },
      { sku: "SKU-1005", nombre: "Escritorio Elevable Eléctrico", categoria: "Oficina", stock_minimo: 2, unidad: "uds" }
    ];
    setLocalStorageItem("productos", productos);

    // 3. Movimientos de Auditoría con Folios Únicos Consecutivos y estado "activo"
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const movimientos: Movimiento[] = [
      {
        id: "mov_501",
        folio: "Entrada-1",
        sku: "SKU-1005",
        almacen_id: "alm_1",
        tipo: "entrada",
        cantidad: 6,
        referencia: "Inventario Inicial Fábrica Mobel",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 8 * day),
        estado: "activo"
      },
      {
        id: "mov_301",
        folio: "Entrada-2",
        sku: "SKU-1003",
        almacen_id: "alm_1",
        tipo: "entrada",
        cantidad: 25,
        referencia: "Contenedor Mobiliario Ergo #88",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 7 * day),
        estado: "activo"
      },
      {
        id: "mov_201",
        folio: "Entrada-3",
        sku: "SKU-1002",
        almacen_id: "alm_1",
        tipo: "entrada",
        cantidad: 10,
        referencia: "Importación Lote Displays M-201",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 6 * day),
        estado: "activo"
      },
      {
        id: "mov_401",
        folio: "Entrada-4",
        sku: "SKU-1004",
        almacen_id: "alm_1",
        tipo: "entrada",
        cantidad: 35,
        referencia: "Factura Importación Keyboards #991",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 6 * day),
        estado: "activo"
      },
      {
        id: "mov_101",
        folio: "Entrada-5",
        sku: "SKU-1001",
        almacen_id: "alm_1",
        tipo: "entrada",
        cantidad: 15,
        referencia: "Recepción de Compra Lote Tech #101",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 5 * day),
        estado: "activo"
      },
      {
        id: "mov_302",
        folio: "Transferencia-1",
        sku: "SKU-1003",
        almacen_id: "alm_1",
        tipo: "transferencia",
        cantidad: 15,
        referencia: "Carga de reabastecimiento Norte",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 5 * day),
        almacen_destino_id: "alm_2",
        estado: "activo"
      },
      {
        id: "mov_102",
        folio: "Transferencia-2",
        sku: "SKU-1001",
        almacen_id: "alm_1",
        tipo: "transferencia",
        cantidad: 4,
        referencia: "Abastecimiento Sucursal Norte",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 4 * day),
        almacen_destino_id: "alm_2",
        estado: "activo"
      },
      {
        id: "mov_202",
        folio: "Transferencia-3",
        sku: "SKU-1002",
        almacen_id: "alm_1",
        tipo: "transferencia",
        cantidad: 5,
        referencia: "Transferencia de stock a Almacén Sur",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 4 * day),
        almacen_destino_id: "alm_3",
        estado: "activo"
      },
      {
        id: "mov_402",
        folio: "Entrada-6",
        sku: "SKU-1004",
        almacen_id: "alm_2",
        tipo: "entrada",
        cantidad: 22,
        referencia: "Recepción Sucursal Norte",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 4 * day),
        estado: "activo"
      },
      {
        id: "mov_502",
        folio: "Entrada-7",
        sku: "SKU-1005",
        almacen_id: "alm_3",
        tipo: "entrada",
        cantidad: 3,
        referencia: "Recepción Fábrica Lote Sevilla",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 4 * day),
        estado: "activo"
      },
      {
        id: "mov_103",
        folio: "Entrada-8",
        sku: "SKU-1001",
        almacen_id: "alm_3",
        tipo: "entrada",
        cantidad: 8,
        referencia: "Recepción directa Distribuidor Sur",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 3 * day),
        estado: "activo"
      },
      {
        id: "mov_203",
        folio: "Entrada-9",
        sku: "SKU-1002",
        almacen_id: "alm_2",
        tipo: "entrada",
        cantidad: 3,
        referencia: "Compra local Bilbao",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 3 * day),
        estado: "activo"
      },
      {
        id: "mov_403",
        folio: "Entrada-10",
        sku: "SKU-1004",
        almacen_id: "alm_3",
        tipo: "entrada",
        cantidad: 14,
        referencia: "Recepción Sucursal Sur",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 3 * day),
        estado: "activo"
      },
      {
        id: "mov_303",
        folio: "Entrada-11",
        sku: "SKU-1003",
        almacen_id: "alm_3",
        tipo: "entrada",
        cantidad: 6,
        referencia: "Recepción de Mercancía R-102",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 2 * day),
        estado: "activo"
      },
      {
        id: "mov_204",
        folio: "Salida-1",
        sku: "SKU-1002",
        almacen_id: "alm_1",
        tipo: "salida",
        cantidad: 2,
        referencia: "Despacho Orden Online #4012",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 2 * day),
        estado: "activo"
      },
      {
        id: "mov_503",
        folio: "Salida-2",
        sku: "SKU-1005",
        almacen_id: "alm_1",
        tipo: "salida",
        cantidad: 1,
        referencia: "Venta Showroom Madrid NV-109",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 2 * day),
        estado: "activo"
      },
      {
        id: "mov_104",
        folio: "Salida-3",
        sku: "SKU-1001",
        almacen_id: "alm_1",
        tipo: "salida",
        cantidad: 3,
        referencia: "Factura Venta Cliente Corporativo F-9901",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 1 * day),
        estado: "activo"
      },
      {
        id: "mov_205",
        folio: "Salida-4",
        sku: "SKU-1002",
        almacen_id: "alm_2",
        tipo: "salida",
        cantidad: 2,
        referencia: "Nota de Entrega N-4501",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 1 * day),
        estado: "activo"
      },
      {
        id: "mov_304",
        folio: "Salida-5",
        sku: "SKU-1003",
        almacen_id: "alm_1",
        tipo: "salida",
        cantidad: 5,
        referencia: "Dotación Sede Central Fac-441",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 1 * day),
        estado: "activo"
      },
      {
        id: "mov_404",
        folio: "Salida-6",
        sku: "SKU-1004",
        almacen_id: "alm_1",
        tipo: "salida",
        cantidad: 5,
        referencia: "Venta Mayorista Tech-Dist #312",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 1 * day),
        estado: "activo"
      }
    ];
    setLocalStorageItem("movimientos", movimientos);

    // Contadores consecutivos iniciales
    setLocalStorageItem("contadores_movimientos", {
      entrada: 11,
      salida: 6,
      transferencia: 3,
      ajuste: 0
    });

    // 4. Initial atomic stock balance
    const initialStockMap: Record<string, StockItem> = {
      "SKU-1001_alm_1": { id: "SKU-1001_alm_1", sku: "SKU-1001", almacen_id: "alm_1", cantidad: 8, actualizado: new Date() },
      "SKU-1001_alm_2": { id: "SKU-1001_alm_2", sku: "SKU-1001", almacen_id: "alm_2", cantidad: 4, actualizado: new Date() },
      "SKU-1001_alm_3": { id: "SKU-1001_alm_3", sku: "SKU-1001", almacen_id: "alm_3", cantidad: 8, actualizado: new Date() },
      "SKU-1002_alm_1": { id: "SKU-1002_alm_1", sku: "SKU-1002", almacen_id: "alm_1", cantidad: 3, actualizado: new Date() },
      "SKU-1002_alm_2": { id: "SKU-1002_alm_2", sku: "SKU-1002", almacen_id: "alm_2", cantidad: 1, actualizado: new Date() },
      "SKU-1002_alm_3": { id: "SKU-1002_alm_3", sku: "SKU-1002", almacen_id: "alm_3", cantidad: 5, actualizado: new Date() },
      "SKU-1003_alm_1": { id: "SKU-1003_alm_1", sku: "SKU-1003", almacen_id: "alm_1", cantidad: 5, actualizado: new Date() },
      "SKU-1003_alm_2": { id: "SKU-1003_alm_2", sku: "SKU-1003", almacen_id: "alm_2", cantidad: 15, actualizado: new Date() },
      "SKU-1003_alm_3": { id: "SKU-1003_alm_3", sku: "SKU-1003", almacen_id: "alm_3", cantidad: 6, actualizado: new Date() },
      "SKU-1004_alm_1": { id: "SKU-1004_alm_1", sku: "SKU-1004", almacen_id: "alm_1", cantidad: 30, actualizado: new Date() },
      "SKU-1004_alm_2": { id: "SKU-1004_alm_2", sku: "SKU-1004", almacen_id: "alm_2", cantidad: 22, actualizado: new Date() },
      "SKU-1004_alm_3": { id: "SKU-1004_alm_3", sku: "SKU-1004", almacen_id: "alm_3", cantidad: 14, actualizado: new Date() },
      "SKU-1005_alm_1": { id: "SKU-1005_alm_1", sku: "SKU-1005", almacen_id: "alm_1", cantidad: 5, actualizado: new Date() },
      "SKU-1005_alm_2": { id: "SKU-1005_alm_2", sku: "SKU-1005", almacen_id: "alm_2", cantidad: 0, actualizado: new Date() },
      "SKU-1005_alm_3": { id: "SKU-1005_alm_3", sku: "SKU-1005", almacen_id: "alm_3", cantidad: 3, actualizado: new Date() }
    };
    setLocalStorageItem("stock", initialStockMap);

    // 5. Usuario por defecto
    setLocalStorageItem("currentUser", {
      uid: "usr_admin",
      email: "admin@empresa.com",
      nombre: "Administrador de Inventario"
    });

    localStorage.setItem(STORAGE_PREFIX + "seeded_version", "v4_atomic_inventory_engine");
  }
};

// Execute seeding
seedData();

// List of listeners for mock real-time updates
const listeners: Record<string, ((data: any) => void)[]> = {
  auth: [],
  stock: [],
  movimientos: [],
  almacenes: [],
  productos: [],
  categorias: [],
  unidades: []
};

const notifyListeners = (channel: "auth" | "stock" | "movimientos" | "almacenes" | "productos" | "categorias" | "unidades", data: any) => {
  if (listeners[channel]) {
    listeners[channel].forEach(callback => callback(data));
  }
};

// --- CORE EXPORTED SERVICE ---
export const isRealFirebase = isConfigured;

export const authService = {
  login: async (email: string, password: string): Promise<Usuario> => {
    if (isConfigured && realAuth) {
      const userCredential = await signInWithEmailAndPassword(realAuth, email, password);
      const user = userCredential.user;
      return {
        uid: user.uid,
        email: user.email || ""
      };
    } else {
      if (email === "admin@empresa.com" && password === "admin123") {
        const adminUser: Usuario = {
          uid: "usr_admin",
          email: "admin@empresa.com",
          nombre: "Administrador"
        };
        setLocalStorageItem("currentUser", adminUser);
        notifyListeners("auth", adminUser);
        return adminUser;
      } else if (email && password.length >= 6) {
        const newUser: Usuario = {
          uid: "usr_" + Math.random().toString(36).substr(2, 9),
          email: email,
          nombre: email.split("@")[0]
        };
        setLocalStorageItem("currentUser", newUser);
        notifyListeners("auth", newUser);
        return newUser;
      } else {
        throw new Error("Credenciales inválidas. Usa admin@empresa.com con admin123 o ingresa una contraseña de al menos 6 caracteres.");
      }
    }
  },

  loginWithGoogle: async (): Promise<Usuario> => {
    if (isConfigured && realAuth) {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(realAuth, provider);
      const user = userCredential.user;
      return {
        uid: user.uid,
        email: user.email || "",
        nombre: user.displayName || undefined
      };
    } else {
      const googleUser: Usuario = {
        uid: "usr_google_demo",
        email: "google.demo@empresa.com",
        nombre: "Usuario Demo Google"
      };
      setLocalStorageItem("currentUser", googleUser);
      notifyListeners("auth", googleUser);
      return googleUser;
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

export const firestoreService = {
  // --- ALMACENES ---
  getAlmacenes: async (): Promise<Almacen[]> => {
    if (isConfigured && realDb) {
      try {
        const snap = await getDocs(collection(realDb, "almacenes"));
        const list: Almacen[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as Almacen);
        });
        if (list.length > 0) {
          setLocalStorageItem("almacenes", list);
          return list;
        }
      } catch (err) {
        console.warn("Firestore getAlmacenes unavailable, using local cache:", err);
      }
    }
    return getLocalStorageItem<Almacen[]>("almacenes", []);
  },

  getAlmacenesRealtime: (onUpdate: (almacenes: Almacen[]) => void): (() => void) => {
    if (isConfigured && realDb) {
      try {
        const unsubscribe = onSnapshot(
          collection(realDb, "almacenes"),
          (snap) => {
            const list: Almacen[] = [];
            snap.forEach(d => {
              list.push({ id: d.id, ...d.data() } as Almacen);
            });
            if (list.length > 0) {
              setLocalStorageItem("almacenes", list);
              onUpdate(list);
            } else {
              const localList = getLocalStorageItem<Almacen[]>("almacenes", []);
              onUpdate(localList);
            }
          },
          (error) => {
            console.warn("Firestore onSnapshot (almacenes) error, falling back to local state:", error.message);
            const localList = getLocalStorageItem<Almacen[]>("almacenes", []);
            onUpdate(localList);
          }
        );
        return unsubscribe;
      } catch (err) {
        console.warn("Could not attach onSnapshot to almacenes, falling back to local listener:", err);
      }
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
      try {
        const docRef = await addDoc(collection(realDb, "almacenes"), almacen);
        return docRef.id;
      } catch (err) {
        console.warn("Firestore addDoc failed, using local storage:", err);
      }
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
      try {
        const docRef = doc(realDb, "almacenes", id);
        await setDoc(docRef, data, { merge: true });
      } catch (err) {
        console.warn("Firestore updateAlmacen failed, using local storage:", err);
      }
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
      try {
        const docRef = doc(realDb, "almacenes", id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn("Firestore deleteDoc failed, using local storage:", err);
      }
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
      try {
        const snap = await getDocs(collection(realDb, "productos"));
        const list: Producto[] = [];
        snap.forEach(d => {
          list.push({ sku: d.id, ...d.data() } as Producto);
        });
        if (list.length > 0) {
          setLocalStorageItem("productos", list);
          return list;
        }
      } catch (err) {
        console.warn("Firestore getProductos failed, using local storage:", err);
      }
    }
    return getLocalStorageItem<Producto[]>("productos", []);
  },

  getProductosRealtime: (onUpdate: (productos: Producto[]) => void): (() => void) => {
    if (isConfigured && realDb) {
      try {
        const unsubscribe = onSnapshot(
          collection(realDb, "productos"),
          (snap) => {
            const list: Producto[] = [];
            snap.forEach(d => {
              list.push({ sku: d.id, ...d.data() } as Producto);
            });
            if (list.length > 0) {
              setLocalStorageItem("productos", list);
              onUpdate(list);
            } else {
              const localList = getLocalStorageItem<Producto[]>("productos", []);
              onUpdate(localList);
            }
          },
          (error) => {
            console.warn("Firestore onSnapshot (productos) error, falling back to local state:", error.message);
            const localList = getLocalStorageItem<Producto[]>("productos", []);
            onUpdate(localList);
          }
        );
        return unsubscribe;
      } catch (err) {
        console.warn("Could not attach onSnapshot to productos, falling back to local listener:", err);
      }
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
      try {
        const docRef = doc(realDb, "productos", cleanSku);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return true;
      } catch (err) {
        console.warn("Firestore checkSkuExists failed, checking local cache:", err);
      }
    }
    const list = getLocalStorageItem<Producto[]>("productos", []);
    return list.some(p => p.sku?.trim().toUpperCase() === cleanSku);
  },

  addProduct: async (producto: Producto): Promise<void> => {
    if (isConfigured && realDb) {
      try {
        const docRef = doc(realDb, "productos", producto.sku);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          throw new Error("El SKU ya existe en la base de datos.");
        }
        const { sku, ...data } = producto;
        await setDoc(docRef, data);
      } catch (err: any) {
        if (err?.message?.includes("ya existe")) {
          throw err;
        }
        console.warn("Firestore addProduct failed, using local storage:", err);
      }
    }
    const list = getLocalStorageItem<Producto[]>("productos", []);
    const existing = list.find(p => p.sku.toLowerCase() === producto.sku.toLowerCase());
    if (existing) {
      throw new Error("El SKU ya existe.");
    }
    list.push(producto);
    setLocalStorageItem("productos", list);
    notifyListeners("productos", list);
  },

  updateProduct: async (sku: string, data: Partial<Omit<Producto, "sku">>): Promise<void> => {
    if (isConfigured && realDb) {
      try {
        const docRef = doc(realDb, "productos", sku);
        await setDoc(docRef, data, { merge: true });
      } catch (err) {
        console.warn("Firestore updateProduct failed, using local storage:", err);
      }
    }
    const list = getLocalStorageItem<Producto[]>("productos", []);
    const index = list.findIndex(p => p.sku === sku);
    if (index !== -1) {
      list[index] = { ...list[index], ...data };
      setLocalStorageItem("productos", list);
      notifyListeners("productos", list);
    }
  },

  deleteProduct: async (sku: string): Promise<void> => {
    if (isConfigured && realDb) {
      try {
        const docRef = doc(realDb, "productos", sku);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn("Firestore deleteProduct failed, using local storage:", err);
      }
    }
    const list = getLocalStorageItem<Producto[]>("productos", []);
    const filtered = list.filter(p => p.sku !== sku);
    setLocalStorageItem("productos", filtered);
    notifyListeners("productos", filtered);
  },

  ensureProductExists: async (sku: string, nombre: string, categoria = "General", stockMinimo = 5, unidad = "uds"): Promise<Producto> => {
    const productData: Producto = { sku, nombre, categoria, stock_minimo: stockMinimo, unidad };
    if (isConfigured && realDb) {
      try {
        const docRef = doc(realDb, "productos", sku);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          await setDoc(docRef, { nombre, categoria, stock_minimo: stockMinimo, unidad });
        }
        return productData;
      } catch (err) {
        console.warn("Firestore ensureProductExists failed, using local fallback:", err);
      }
    }
    const prods = getLocalStorageItem<Producto[]>("productos", []);
    const existing = prods.find(p => p.sku === sku);
    if (!existing) {
      prods.push(productData);
      setLocalStorageItem("productos", prods);
    }
    return existing || productData;
  },

  // --- ATOMIC REAL-TIME STOCK (LISTENS DIRECTLY TO 'stock' COLLECTION) ---
  getStockRealtime: (onUpdate: (stock: StockItem[]) => void): (() => void) => {
    if (isConfigured && realDb) {
      try {
        const unsubscribe = onSnapshot(
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

            // Cache locally for instantaneous offline fallback
            const stockMap: Record<string, StockItem> = {};
            list.forEach(s => {
              stockMap[s.id] = s;
            });
            setLocalStorageItem("stock", stockMap);
            onUpdate(list);
          },
          (error) => {
            console.warn("Firestore onSnapshot (stock) error, falling back to local stock table:", error.message);
            const stockMap = getLocalStorageItem<Record<string, StockItem>>("stock", {});
            onUpdate(Object.values(stockMap));
          }
        );
        return unsubscribe;
      } catch (err) {
        console.warn("Could not attach onSnapshot to stock collection:", err);
      }
    }

    // Local Emulator Stock Listener (Updates only affected items, no full history scan)
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

  // --- ATOMIC MOVEMENT REGISTRATION VIA FIRESTORE TRANSACTION ---
  // Updates ONLY affected stock document(s) and validates stock availability without traversing full history
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

    let generatedFolio = "";
    let docId = "mov_" + Math.random().toString(36).substr(2, 9);

    if (isConfigured && realDb) {
      try {
        const counterDocRef = doc(realDb, "contadores", mov.tipo);
        const movRef = doc(collection(realDb, "movimientos"));
        docId = movRef.id;

        const originStockKey = `${cleanSku}_${originAlmId}`;
        const originStockRef = doc(realDb, "stock", originStockKey);

        const destStockKey = destAlmId ? `${cleanSku}_${destAlmId}` : null;
        const destStockRef = destStockKey ? doc(realDb, "stock", destStockKey) : null;

        await runTransaction(realDb, async (transaction) => {
          // 1. Read Counter
          const counterSnap = await transaction.get(counterDocRef);
          let nextNumber = 1;
          if (counterSnap.exists()) {
            const data = counterSnap.data();
            if (typeof data?.ultimo_consecutivo === "number") {
              nextNumber = data.ultimo_consecutivo + 1;
            }
          }
          generatedFolio = `${prefix}${nextNumber}`;

          // 2. Read Origin Stock
          const originStockSnap = await transaction.get(originStockRef);
          const currentOriginQty = originStockSnap.exists() ? (Number(originStockSnap.data()?.cantidad) || 0) : 0;

          let newOriginQty = currentOriginQty;
          let newDestQty = 0;

          // 3. Process Transaction Type & Validate Availability
          if (mov.tipo === "entrada") {
            newOriginQty = currentOriginQty + moveQty;
          } else if (mov.tipo === "salida") {
            if (currentOriginQty < moveQty) {
              throw new Error(`Stock insuficiente en el almacén seleccionado. Stock actual disponible: ${currentOriginQty} uds, solicitado: ${moveQty} uds.`);
            }
            newOriginQty = currentOriginQty - moveQty;
          } else if (mov.tipo === "transferencia") {
            if (!destStockRef || !destAlmId) {
              throw new Error("El almacén de destino es requerido para transferencias.");
            }
            if (currentOriginQty < moveQty) {
              throw new Error(`Stock insuficiente en el almacén de origen. Stock actual disponible: ${currentOriginQty} uds, solicitado: ${moveQty} uds.`);
            }

            // Read Destination Stock inside transaction
            const destStockSnap = await transaction.get(destStockRef);
            const currentDestQty = destStockSnap.exists() ? (Number(destStockSnap.data()?.cantidad) || 0) : 0;

            newOriginQty = currentOriginQty - moveQty;
            newDestQty = currentDestQty + moveQty;

            // Write Destination Stock
            transaction.set(destStockRef, {
              id: destStockKey,
              sku: cleanSku,
              almacen_id: destAlmId,
              cantidad: newDestQty,
              actualizado: Timestamp.now()
            }, { merge: true });
          }

          // 4. Write Origin Stock
          transaction.set(originStockRef, {
            id: originStockKey,
            sku: cleanSku,
            almacen_id: originAlmId,
            cantidad: newOriginQty,
            actualizado: Timestamp.now()
          }, { merge: true });

          // 5. Update Sequential Counter
          transaction.set(counterDocRef, {
            tipo: mov.tipo,
            ultimo_consecutivo: nextNumber,
            actualizado: Timestamp.now()
          }, { merge: true });

          // 6. Write Movement Document (estado: "activo")
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
      } catch (err: any) {
        if (err.message && err.message.includes("Stock insuficiente")) {
          throw err;
        }
        console.warn("Firestore runTransaction falló, aplicando lógica atómica en almacenamiento local:", err);
      }
    }

    // --- LOCAL EMULATOR ATOMIC TRANSACTION LOGIC ---
    const stockMap = getLocalStorageItem<Record<string, StockItem>>("stock", {});
    const originKey = `${cleanSku}_${originAlmId}`;
    const currentOrigin = stockMap[originKey]?.cantidad || 0;

    if (mov.tipo === "salida" && currentOrigin < moveQty) {
      throw new Error(`Stock insuficiente en el almacén seleccionado. Stock actual disponible: ${currentOrigin} uds, solicitado: ${moveQty} uds.`);
    }

    if (mov.tipo === "transferencia") {
      if (!destAlmId) throw new Error("El almacén de destino es requerido para transferencias.");
      if (currentOrigin < moveQty) {
        throw new Error(`Stock insuficiente en el almacén de origen. Stock actual disponible: ${currentOrigin} uds, solicitado: ${moveQty} uds.`);
      }
    }

    if (!generatedFolio) {
      generatedFolio = firestoreService.getNextLocalFolio(mov.tipo);
    }

    // Update ONLY affected stock item(s)
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

    // Save stock directly
    setLocalStorageItem("stock", stockMap);
    notifyListeners("stock", stockMap);

    // Save movement with estado "activo"
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

  // --- ATOMIC ANULACIÓN (VOIDING) OF MOVEMENT ---
  // Reverts the exact stock effect once, preserves audit doc with status "anulado", and blocks double-voiding
  anularMovimiento: async (id: string, motivo = "Anulado por el usuario"): Promise<void> => {
    const user = authService.getCurrentUser();
    const usuarioEmail = user ? user.email : "sistema@empresa.com";

    if (isConfigured && realDb) {
      try {
        const movRef = doc(realDb, "movimientos", id);

        await runTransaction(realDb, async (transaction) => {
          // 1. Read Movement Document
          const movSnap = await transaction.get(movRef);
          if (!movSnap.exists()) {
            throw new Error("El movimiento que intentas anular no existe en el sistema.");
          }

          const movData = movSnap.data();

          // 2. Strict Check: Double voiding prevention
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

          // 3. Revert Atomic Stock Effects
          if (tipo === "entrada") {
            // Reversing an entrada means subtracting stock from origin warehouse
            const originSnap = await transaction.get(originStockRef);
            const currentOrigin = originSnap.exists() ? (Number(originSnap.data()?.cantidad) || 0) : 0;

            if (currentOrigin < qty) {
              throw new Error(`No se puede anular la entrada: el stock actual (${currentOrigin} uds) en el almacén es inferior a la cantidad a revertir (${qty} uds).`);
            }

            transaction.set(originStockRef, {
              id: originStockKey,
              sku,
              almacen_id: originAlmId,
              cantidad: currentOrigin - qty,
              actualizado: Timestamp.now()
            }, { merge: true });
          } else if (tipo === "salida") {
            // Reversing a salida means adding stock back to origin warehouse
            const originSnap = await transaction.get(originStockRef);
            const currentOrigin = originSnap.exists() ? (Number(originSnap.data()?.cantidad) || 0) : 0;

            transaction.set(originStockRef, {
              id: originStockKey,
              sku,
              almacen_id: originAlmId,
              cantidad: currentOrigin + qty,
              actualizado: Timestamp.now()
            }, { merge: true });
          } else if (tipo === "transferencia") {
            // Reversing a transfer means adding stock back to origin and subtracting from destination
            if (!destAlmId) {
              throw new Error("Error en datos de transferencia: falta almacén de destino.");
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

          // 4. Mark movement document as Anulado (preserving audit history)
          transaction.update(movRef, {
            estado: "anulado",
            anulado_at: Timestamp.now(),
            anulado_por: usuarioEmail,
            motivo_anulacion: motivo
          });
        });

        return;
      } catch (err: any) {
        if (err.message && (err.message.includes("anulado") || err.message.includes("stock"))) {
          throw err;
        }
        console.warn("Firestore runTransaction anulación falló, ejecutando en local:", err);
      }
    }

    // --- LOCAL EMULATOR ANULACIÓN ---
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
        throw new Error(`No se puede anular la entrada: el stock actual (${currentOrigin} uds) en el almacén es inferior a la cantidad a revertir (${qty} uds).`);
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

    // Save reverted stock
    setLocalStorageItem("stock", stockMap);
    notifyListeners("stock", stockMap);

    // Mark movement as anulado
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

  // Legacy delete fallback (aliases to anular for safety)
  deleteMovimiento: async (id: string): Promise<void> => {
    await firestoreService.anularMovimiento(id, "Anulación directa de registro");
  },

  // --- PAGINATED AUDIT HISTORY (50 BY 50) ---
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
      try {
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
      } catch (err) {
        console.warn("Firestore getMovimientosPaginated failed, using local storage pagination:", err);
      }
    }

    // Local Storage Pagination
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

    // Apply filters
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

  // Single page fetch for non-paginated small components (returns up to 100 items by default)
  getMovimientos: async (skuFilter?: string): Promise<Movimiento[]> => {
    const res = await firestoreService.getMovimientosPaginated({ pageSize: 100, skuFilter });
    return res.items;
  },

  // --- OPTIMIZED SALES ANALYSIS: QUERY ONLY SALES MOVEMENTS IN DATE RANGE ---
  getVentasByDateRange: async (startDate: Date, endDate: Date): Promise<Movimiento[]> => {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    if (isConfigured && realDb) {
      try {
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
          // STRICT RULE: Exclude voided movements
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
      } catch (err) {
        console.warn("Firestore getVentasByDateRange failed, falling back to local filter:", err);
      }
    }

    // Local Storage sales query
    let movs = getLocalStorageItem<Movimiento[]>("movimientos", []);
    return movs.filter(m => {
      if (m.tipo !== "salida") return false;
      if (m.estado === "anulado") return false; // Ignored voided sales

      const mDate = m.fecha instanceof Date ? m.fecha : new Date(typeof m.fecha === "string" ? m.fecha : (m.fecha as any).seconds * 1000);
      const time = mDate.getTime();
      return time >= startMs && time <= endMs;
    }).map(m => ({
      ...m,
      fecha: m.fecha instanceof Date ? m.fecha : new Date(typeof m.fecha === "string" ? m.fecha : (m.fecha as any).seconds * 1000),
      estado: m.estado || "activo"
    }));
  },

  // ==========================================
  // --- GESTIÓN DE CATÁLOGOS DINÁMICOS ---
  // ==========================================

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

    let currentCats = getLocalStorageItem<CategoriaCatalogo[]>("categorias", []);
    let currentUnits = getLocalStorageItem<UnidadMedidaCatalogo[]>("unidades", []);

    if (currentCats.length === 0) {
      currentCats = [...defaultCategorias];
    }
    if (currentUnits.length === 0) {
      currentUnits = [...defaultUnidades];
    }

    const productos = getLocalStorageItem<Producto[]>("productos", []);
    
    productos.forEach(p => {
      if (p.categoria && p.categoria.trim()) {
        const cleanCat = p.categoria.trim();
        const exists = currentCats.some(c => c.nombre.trim().toLowerCase() === cleanCat.toLowerCase());
        if (!exists) {
          currentCats.push({
            id: "cat_" + Math.random().toString(36).substr(2, 9),
            nombre: cleanCat,
            activa: true
          });
        }
      }

      if (p.unidad && p.unidad.trim()) {
        const cleanUnit = p.unidad.trim();
        const exists = currentUnits.some(u => 
          u.abreviatura.trim().toLowerCase() === cleanUnit.toLowerCase() ||
          u.nombre.trim().toLowerCase() === cleanUnit.toLowerCase()
        );
        if (!exists) {
          const capitalizedName = cleanUnit.charAt(0).toUpperCase() + cleanUnit.slice(1);
          currentUnits.push({
            id: "uni_" + Math.random().toString(36).substr(2, 9),
            nombre: capitalizedName,
            abreviatura: cleanUnit.toLowerCase(),
            activa: true
          });
        }
      }
    });

    setLocalStorageItem("categorias", currentCats);
    setLocalStorageItem("unidades", currentUnits);

    notifyListeners("categorias", currentCats);
    notifyListeners("unidades", currentUnits);

    return { categorias: currentCats, unidades: currentUnits };
  },

  getCategorias: async (): Promise<CategoriaCatalogo[]> => {
    if (isConfigured && realDb) {
      try {
        const snap = await getDocs(collection(realDb, "catalogo_categorias"));
        const list: CategoriaCatalogo[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as CategoriaCatalogo);
        });
        if (list.length > 0) {
          setLocalStorageItem("categorias", list);
          return list;
        }
      } catch (err) {
        console.warn("Firestore getCategorias failed, using local storage:", err);
      }
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
      try {
        const unsubscribe = onSnapshot(
          collection(realDb, "catalogo_categorias"),
          (snap) => {
            const list: CategoriaCatalogo[] = [];
            snap.forEach(d => {
              list.push({ id: d.id, ...d.data() } as CategoriaCatalogo);
            });
            if (list.length > 0) {
              setLocalStorageItem("categorias", list);
              onUpdate(list);
            } else {
              const localList = getLocalStorageItem<CategoriaCatalogo[]>("categorias", []);
              onUpdate(localList);
            }
          },
          (error) => {
            console.warn("Firestore onSnapshot (categorias) error:", error.message);
            const localList = getLocalStorageItem<CategoriaCatalogo[]>("categorias", []);
            onUpdate(localList);
          }
        );
        return unsubscribe;
      } catch (err) {
        console.warn("Could not attach onSnapshot to catalogo_categorias:", err);
      }
    }

    const update = () => {
      const list = getLocalStorageItem<CategoriaCatalogo[]>("categorias", []);
      if (list.length === 0) {
        firestoreService.seedAndImportCatalogos().then(res => onUpdate(res.categorias));
      } else {
        onUpdate(list);
      }
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
      try {
        const docRef = doc(realDb, "catalogo_categorias", newId);
        await setDoc(docRef, {
          nombre: cleanNombre,
          activa: true,
          creado: Timestamp.now()
        });
      } catch (err) {
        console.warn("Firestore addCategoria failed, using local storage:", err);
      }
    }

    list.push(newCat);
    setLocalStorageItem("categorias", list);
    notifyListeners("categorias", list);
    return newId;
  },

  updateCategoria: async (id: string, data: Partial<Omit<CategoriaCatalogo, "id">>): Promise<void> => {
    if (isConfigured && realDb) {
      try {
        const docRef = doc(realDb, "catalogo_categorias", id);
        await setDoc(docRef, data, { merge: true });
      } catch (err) {
        console.warn("Firestore updateCategoria failed, using local storage:", err);
      }
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

    const productos = getLocalStorageItem<Producto[]>("productos", []);
    let modifiedAny = false;

    productos.forEach(p => {
      if (p.categoria && p.categoria.trim().toLowerCase() === cleanOld.toLowerCase()) {
        p.categoria = cleanNew;
        modifiedAny = true;
        if (isConfigured && realDb) {
          try {
            const prodDoc = doc(realDb, "productos", p.sku);
            setDoc(prodDoc, { categoria: cleanNew }, { merge: true });
          } catch (e) {
            console.warn("Error updating product category in Firestore:", e);
          }
        }
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
      try {
        const docRef = doc(realDb, "catalogo_categorias", id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn("Firestore deleteCategoria failed, updating local storage:", err);
      }
    }
    const list = getLocalStorageItem<CategoriaCatalogo[]>("categorias", []);
    const updated = list.filter(c => c.id !== id);
    setLocalStorageItem("categorias", updated);
    notifyListeners("categorias", updated);
  },

  // --- UNIDADES DE MEDIDA ---
  getUnidades: async (): Promise<UnidadMedidaCatalogo[]> => {
    if (isConfigured && realDb) {
      try {
        const snap = await getDocs(collection(realDb, "catalogo_unidades"));
        const list: UnidadMedidaCatalogo[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as UnidadMedidaCatalogo);
        });
        if (list.length > 0) {
          setLocalStorageItem("unidades", list);
          return list;
        }
      } catch (err) {
        console.warn("Firestore getUnidades failed, using local storage:", err);
      }
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
      try {
        const unsubscribe = onSnapshot(
          collection(realDb, "catalogo_unidades"),
          (snap) => {
            const list: UnidadMedidaCatalogo[] = [];
            snap.forEach(d => {
              list.push({ id: d.id, ...d.data() } as UnidadMedidaCatalogo);
            });
            if (list.length > 0) {
              setLocalStorageItem("unidades", list);
              onUpdate(list);
            } else {
              const localList = getLocalStorageItem<UnidadMedidaCatalogo[]>("unidades", []);
              onUpdate(localList);
            }
          },
          (error) => {
            console.warn("Firestore onSnapshot (unidades) error:", error.message);
            const localList = getLocalStorageItem<UnidadMedidaCatalogo[]>("unidades", []);
            onUpdate(localList);
          }
        );
        return unsubscribe;
      } catch (err) {
        console.warn("Could not attach onSnapshot to catalogo_unidades:", err);
      }
    }

    const update = () => {
      const list = getLocalStorageItem<UnidadMedidaCatalogo[]>("unidades", []);
      if (list.length === 0) {
        firestoreService.seedAndImportCatalogos().then(res => onUpdate(res.unidades));
      } else {
        onUpdate(list);
      }
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
      try {
        const docRef = doc(realDb, "catalogo_unidades", newId);
        await setDoc(docRef, {
          nombre: cleanNombre,
          abreviatura: cleanAbrev,
          activa: true,
          creado: Timestamp.now()
        });
      } catch (err) {
        console.warn("Firestore addUnidad failed, using local storage:", err);
      }
    }

    list.push(newUnit);
    setLocalStorageItem("unidades", list);
    notifyListeners("unidades", list);
    return newId;
  },

  updateUnidad: async (id: string, data: Partial<Omit<UnidadMedidaCatalogo, "id">>): Promise<void> => {
    if (isConfigured && realDb) {
      try {
        const docRef = doc(realDb, "catalogo_unidades", id);
        await setDoc(docRef, data, { merge: true });
      } catch (err) {
        console.warn("Firestore updateUnidad failed, using local storage:", err);
      }
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

    const productos = getLocalStorageItem<Producto[]>("productos", []);
    let modifiedAny = false;

    productos.forEach(p => {
      const prodUnitLower = (p.unidad || "").trim().toLowerCase();
      if (prodUnitLower === cleanOldAbrev) {
        p.unidad = cleanNewAbrev;
        modifiedAny = true;
        if (isConfigured && realDb) {
          try {
            const prodDoc = doc(realDb, "productos", p.sku);
            setDoc(prodDoc, { unidad: cleanNewAbrev }, { merge: true });
          } catch (e) {
            console.warn("Error updating product unit in Firestore:", e);
          }
        }
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
      try {
        const docRef = doc(realDb, "catalogo_unidades", id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn("Firestore deleteUnidad failed, updating local storage:", err);
      }
    }
    const list = getLocalStorageItem<UnidadMedidaCatalogo[]>("unidades", []);
    const updated = list.filter(u => u.id !== id);
    setLocalStorageItem("unidades", updated);
    notifyListeners("unidades", updated);
  }
};
