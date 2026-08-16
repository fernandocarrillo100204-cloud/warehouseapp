/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
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
import { Almacen, Producto, StockItem, Movimiento, Usuario, CategoriaCatalogo, UnidadMedidaCatalogo } from "../types";

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
    realDb = getFirestore(realApp);
    realAuth = getAuth(realApp);
    console.log("Firebase initialized successfully with real configuration.");
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
  if (seededVersion !== "v3_folios_consecutivos") {
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

    // 3. Movimientos de Auditoría con Folios Únicos Consecutivos (El origen fidedigno de todo el stock)
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const movimientos: Movimiento[] = [
      // --- SKU-1005
      {
        id: "mov_501",
        folio: "Entrada-1",
        sku: "SKU-1005",
        almacen_id: "alm_1",
        tipo: "entrada",
        cantidad: 6,
        referencia: "Inventario Inicial Fábrica Mobel",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 8 * day)
      },
      // --- SKU-1003
      {
        id: "mov_301",
        folio: "Entrada-2",
        sku: "SKU-1003",
        almacen_id: "alm_1",
        tipo: "entrada",
        cantidad: 25,
        referencia: "Contenedor Mobiliario Ergo #88",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 7 * day)
      },
      // --- SKU-1002 & SKU-1004
      {
        id: "mov_201",
        folio: "Entrada-3",
        sku: "SKU-1002",
        almacen_id: "alm_1",
        tipo: "entrada",
        cantidad: 10,
        referencia: "Importación Lote Displays M-201",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 6 * day)
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
        fecha: new Date(now - 6 * day)
      },
      // --- SKU-1001 & SKU-1003
      {
        id: "mov_101",
        folio: "Entrada-5",
        sku: "SKU-1001",
        almacen_id: "alm_1",
        tipo: "entrada",
        cantidad: 15,
        referencia: "Recepción de Compra Lote Tech #101",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 5 * day)
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
        almacen_destino_id: "alm_2"
      },
      // --- SKU-1001 & SKU-1002 & SKU-1004 & SKU-1005
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
        almacen_destino_id: "alm_2"
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
        almacen_destino_id: "alm_3"
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
        fecha: new Date(now - 4 * day)
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
        fecha: new Date(now - 4 * day)
      },
      // --- SKU-1001 & SKU-1002 & SKU-1004
      {
        id: "mov_103",
        folio: "Entrada-8",
        sku: "SKU-1001",
        almacen_id: "alm_3",
        tipo: "entrada",
        cantidad: 8,
        referencia: "Recepción directa Distribuidor Sur",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 3 * day)
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
        fecha: new Date(now - 3 * day)
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
        fecha: new Date(now - 3 * day)
      },
      // --- SKU-1003 & SKU-1002 & SKU-1005
      {
        id: "mov_303",
        folio: "Entrada-11",
        sku: "SKU-1003",
        almacen_id: "alm_3",
        tipo: "entrada",
        cantidad: 6,
        referencia: "Recepción de Mercancía R-102",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 2 * day)
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
        fecha: new Date(now - 2 * day)
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
        fecha: new Date(now - 2 * day)
      },
      // --- SKU-1001 & SKU-1002 & SKU-1003 & SKU-1004
      {
        id: "mov_104",
        folio: "Salida-3",
        sku: "SKU-1001",
        almacen_id: "alm_1",
        tipo: "salida",
        cantidad: 3,
        referencia: "Factura Venta Cliente Corporativo F-9901",
        usuario: "admin@empresa.com",
        fecha: new Date(now - 1 * day)
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
        fecha: new Date(now - 1 * day)
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
        fecha: new Date(now - 1 * day)
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
        fecha: new Date(now - 1 * day)
      }
    ];
    setLocalStorageItem("movimientos", movimientos);

    // Contadores consecutivos iniciales para modo demostración
    setLocalStorageItem("contadores_movimientos", {
      entrada: 11,
      salida: 6,
      transferencia: 3,
      ajuste: 0
    });

    // 4. Calcular el stock derivado exactamente de los movimientos de auditoría
    const stockMap: Record<string, StockItem> = {};
    productos.forEach(p => {
      almacenes.forEach(a => {
        const id = `${p.sku}_${a.id}`;
        stockMap[id] = { id, sku: p.sku, almacen_id: a.id, cantidad: 0, actualizado: new Date() };
      });
    });

    movimientos.forEach(m => {
      const sku = m.sku?.trim().toUpperCase();
      if (!sku) return;

      if (m.tipo === "entrada") {
        const key = `${sku}_${m.almacen_id}`;
        if (stockMap[key]) {
          stockMap[key].cantidad += Number(m.cantidad);
        } else {
          stockMap[key] = { id: key, sku, almacen_id: m.almacen_id, cantidad: Number(m.cantidad), actualizado: new Date() };
        }
      } else if (m.tipo === "salida") {
        const key = `${sku}_${m.almacen_id}`;
        if (stockMap[key]) {
          stockMap[key].cantidad = Math.max(0, stockMap[key].cantidad - Number(m.cantidad));
        }
      } else if (m.tipo === "transferencia" && m.almacen_destino_id) {
        const originKey = `${sku}_${m.almacen_id}`;
        const destKey = `${sku}_${m.almacen_destino_id}`;
        if (stockMap[originKey]) {
          stockMap[originKey].cantidad = Math.max(0, stockMap[originKey].cantidad - Number(m.cantidad));
        }
        if (stockMap[destKey]) {
          stockMap[destKey].cantidad += Number(m.cantidad);
        } else {
          stockMap[destKey] = { id: destKey, sku, almacen_id: m.almacen_destino_id, cantidad: Number(m.cantidad), actualizado: new Date() };
        }
      }
    });

    setLocalStorageItem("stock", stockMap);

    // 5. Usuario por defecto
    setLocalStorageItem("currentUser", {
      uid: "usr_admin",
      email: "admin@empresa.com",
      nombre: "Administrador de Inventario"
    });

    localStorage.setItem(STORAGE_PREFIX + "seeded_version", "v3_folios_consecutivos");
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
      // Local Emulator Authentication
      // Validates any username that matches a format, but accepts admin@empresa.com with admin123
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
        // Allow dynamic creation/sign-in for easy testing
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
      // High-Fidelity Local Emulator mock Google auth
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
      // Initial user check
      const initialUser = getLocalStorageItem<Usuario | null>("currentUser", null);
      callback(initialUser);

      // Event listener for auth changes
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
        console.warn("Firestore deleteDoc failed, using local storage:", err);
      }
    }
    const list = getLocalStorageItem<Producto[]>("productos", []);
    const filtered = list.filter(p => p.sku !== sku);
    setLocalStorageItem("productos", filtered);
    notifyListeners("productos", filtered);
  },

  // Helper to ensure product exists in emulator or real database for scanning demonstration
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

  // Helper to normalize warehouse reference (handles ID, case, and name matching)
  normalizeWarehouseId: (rawAlm: string, almacenesList: Almacen[]): string => {
    if (!rawAlm) return "";
    const clean = rawAlm.trim();
    // 1. Direct ID match
    const byId = almacenesList.find(a => a.id.toLowerCase() === clean.toLowerCase());
    if (byId) return byId.id;
    // 2. Name match
    const byName = almacenesList.find(a => a.nombre.trim().toLowerCase() === clean.toLowerCase());
    if (byName) return byName.id;
    return clean;
  },

  // Pure function to calculate exact stock strictly and mathematically from audit movements
  computeCanonicalStock: (
    movimientosList: Movimiento[], 
    almacenesList: Almacen[] = [], 
    productosList: Producto[] = []
  ): StockItem[] => {
    // 1. Collect all known SKUs
    const skuSet = new Set<string>();
    productosList.forEach(p => {
      if (p.sku) skuSet.add(p.sku.trim().toUpperCase());
    });
    movimientosList.forEach(m => {
      if (m.sku) skuSet.add(m.sku.trim().toUpperCase());
    });

    // 2. Map of `${sku}_${almacenId}` -> StockItem
    const stockMap: Record<string, StockItem> = {};

    // Initialize zeros for all known (SKU, warehouse) combinations
    skuSet.forEach(sku => {
      almacenesList.forEach(alm => {
        const key = `${sku}_${alm.id}`;
        stockMap[key] = {
          id: key,
          sku,
          almacen_id: alm.id,
          cantidad: 0,
          actualizado: new Date()
        };
      });
    });

    // 3. Sort movements chronologically (oldest first) to replay the audit ledger accurately
    const toDateSafe = (val: any): Date => {
      if (!val) return new Date();
      if (val instanceof Date) return val;
      if (typeof val?.toDate === "function") return val.toDate();
      if (typeof val?.seconds === "number") return new Date(val.seconds * 1000);
      if (typeof val === "string" || typeof val === "number") return new Date(val);
      return new Date();
    };

    const sortedMovs = [...movimientosList].sort((a, b) => {
      const timeA = toDateSafe(a.fecha).getTime();
      const timeB = toDateSafe(b.fecha).getTime();
      return timeA - timeB;
    });

    // 4. Replay transactions
    sortedMovs.forEach(m => {
      const sku = m.sku?.trim().toUpperCase();
      if (!sku) return;

      const qty = Number(m.cantidad) || 0;
      const almId = firestoreService.normalizeWarehouseId(m.almacen_id, almacenesList);
      const destAlmId = m.almacen_destino_id ? firestoreService.normalizeWarehouseId(m.almacen_destino_id, almacenesList) : undefined;
      const movDate = toDateSafe(m.fecha);

      if (m.tipo === "entrada" && almId) {
        const key = `${sku}_${almId}`;
        if (!stockMap[key]) {
          stockMap[key] = { id: key, sku, almacen_id: almId, cantidad: 0, actualizado: movDate };
        }
        stockMap[key].cantidad += qty;
        stockMap[key].actualizado = movDate;
      } else if (m.tipo === "salida" && almId) {
        const key = `${sku}_${almId}`;
        if (!stockMap[key]) {
          stockMap[key] = { id: key, sku, almacen_id: almId, cantidad: 0, actualizado: movDate };
        }
        // Deduct from audit ledger (cannot fall below 0)
        stockMap[key].cantidad = Math.max(0, stockMap[key].cantidad - qty);
        stockMap[key].actualizado = movDate;
      } else if (m.tipo === "transferencia" && almId && destAlmId) {
        const originKey = `${sku}_${almId}`;
        const destKey = `${sku}_${destAlmId}`;

        if (!stockMap[originKey]) {
          stockMap[originKey] = { id: originKey, sku, almacen_id: almId, cantidad: 0, actualizado: movDate };
        }
        if (!stockMap[destKey]) {
          stockMap[destKey] = { id: destKey, sku, almacen_id: destAlmId, cantidad: 0, actualizado: movDate };
        }

        stockMap[originKey].cantidad = Math.max(0, stockMap[originKey].cantidad - qty);
        stockMap[destKey].cantidad += qty;
        stockMap[originKey].actualizado = movDate;
        stockMap[destKey].actualizado = movDate;
      }
    });

    return Object.values(stockMap);
  },

  getStockRealtime: (onUpdate: (stock: StockItem[]) => void): (() => void) => {
    // Recompute live stock directly from audit movements and warehouses
    const computeAndEmit = async () => {
      const movs = await firestoreService.getMovimientos();
      const almacenes = await firestoreService.getAlmacenes();
      const productos = await firestoreService.getProductos();
      const computedStock = firestoreService.computeCanonicalStock(movs, almacenes, productos);
      
      // Update local storage representation
      const stockMap: Record<string, StockItem> = {};
      computedStock.forEach(s => {
        stockMap[s.id] = s;
      });
      setLocalStorageItem("stock", stockMap);
      
      onUpdate(computedStock);
    };

    if (isConfigured && realDb) {
      try {
        const unsubscribe = onSnapshot(
          collection(realDb, "movimientos"),
          (snap) => {
            const list: Movimiento[] = [];
            snap.forEach(d => {
              const data = d.data();
              list.push({
                id: d.id,
                folio: data.folio,
                sku: data.sku,
                almacen_id: data.almacen_id,
                tipo: data.tipo,
                cantidad: data.cantidad,
                referencia: data.referencia,
                usuario: data.usuario,
                fecha: data.fecha ? (data.fecha as Timestamp).toDate() : new Date(),
                almacen_destino_id: data.almacen_destino_id
              });
            });
            
            const almacenes = getLocalStorageItem<Almacen[]>("almacenes", []);
            const productos = getLocalStorageItem<Producto[]>("productos", []);
            const computedStock = firestoreService.computeCanonicalStock(list, almacenes, productos);
            
            const stockMap: Record<string, StockItem> = {};
            computedStock.forEach(s => {
              stockMap[s.id] = s;
            });
            setLocalStorageItem("stock", stockMap);
            onUpdate(computedStock);
          },
          (error) => {
            console.warn("Firestore onSnapshot (movimientos) error, recalculating locally:", error.message);
            computeAndEmit();
          }
        );
        return unsubscribe;
      } catch (err) {
        console.warn("Could not attach onSnapshot to movimientos, using local fallback:", err);
      }
    }

    // Local emulator live subscription to movements
    const update = () => {
      computeAndEmit();
    };
    
    update();
    listeners.movimientos.push(update);
    listeners.almacenes.push(update);
    listeners.productos.push(update);
    
    return () => {
      listeners.movimientos = listeners.movimientos.filter(cb => cb !== update);
      listeners.almacenes = listeners.almacenes.filter(cb => cb !== update);
      listeners.productos = listeners.productos.filter(cb => cb !== update);
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

    const movimientos = getLocalStorageItem<Movimiento[]>("movimientos", []);
    let currentHighest = counters[tipo] || 0;

    movimientos.forEach(m => {
      if (m.tipo === tipo && m.folio && m.folio.startsWith(prefix)) {
        const num = parseInt(m.folio.replace(prefix, ""), 10);
        if (!isNaN(num) && num > currentHighest) {
          currentHighest = num;
        }
      }
    });

    const nextNumber = currentHighest + 1;
    counters[tipo] = nextNumber;
    setLocalStorageItem("contadores_movimientos", counters);

    return `${prefix}${nextNumber}`;
  },

  getMovimientos: async (skuFilter?: string): Promise<Movimiento[]> => {
    if (isConfigured && realDb) {
      try {
        let q = query(collection(realDb, "movimientos"), orderBy("fecha", "desc"));
        if (skuFilter) {
          q = query(collection(realDb, "movimientos"), where("sku", "==", skuFilter), orderBy("fecha", "desc"));
        }
        const snap = await getDocs(q);
        const list: Movimiento[] = [];
        snap.forEach(d => {
          const data = d.data();
          list.push({
            id: d.id,
            folio: data.folio,
            sku: data.sku,
            almacen_id: data.almacen_id,
            tipo: data.tipo,
            cantidad: data.cantidad,
            referencia: data.referencia,
            usuario: data.usuario,
            fecha: data.fecha ? (data.fecha as Timestamp).toDate() : new Date(),
            almacen_destino_id: data.almacen_destino_id
          });
        });
        if (list.length > 0) {
          return list;
        }
      } catch (err) {
        console.warn("Firestore getMovimientos failed, using local storage:", err);
      }
    }
    let movs = getLocalStorageItem<Movimiento[]>("movimientos", []);
    // Parse dates
    movs = movs.map(m => ({
      ...m,
      fecha: typeof m.fecha === "string" ? new Date(m.fecha) : m.fecha
    }));
    // Sort desc
    movs.sort((a, b) => {
      const timeA = a.fecha instanceof Date ? a.fecha.getTime() : new Date((a.fecha as any).seconds * 1000).getTime();
      const timeB = b.fecha instanceof Date ? b.fecha.getTime() : new Date((b.fecha as any).seconds * 1000).getTime();
      return timeB - timeA;
    });

    if (skuFilter) {
      return movs.filter(m => m.sku.toLowerCase() === skuFilter.toLowerCase());
    }
    return movs;
  },

  getMovimientosRealtime: (onUpdate: (movs: Movimiento[]) => void, skuFilter?: string): (() => void) => {
    const fetchAndEmit = async () => {
      const movs = await firestoreService.getMovimientos(skuFilter);
      onUpdate(movs);
    };

    fetchAndEmit();

    if (isConfigured && realDb) {
      try {
        const unsubscribe = onSnapshot(
          collection(realDb, "movimientos"),
          (snap) => {
            const list: Movimiento[] = [];
            snap.forEach(d => {
              const data = d.data();
              list.push({
                id: d.id,
                folio: data.folio,
                sku: data.sku,
                almacen_id: data.almacen_id,
                tipo: data.tipo,
                cantidad: data.cantidad,
                referencia: data.referencia,
                usuario: data.usuario,
                fecha: data.fecha ? (data.fecha as Timestamp).toDate() : new Date(),
                almacen_destino_id: data.almacen_destino_id
              });
            });
            list.sort((a, b) => {
              const timeA = a.fecha instanceof Date ? a.fecha.getTime() : new Date((a.fecha as any).seconds * 1000).getTime();
              const timeB = b.fecha instanceof Date ? b.fecha.getTime() : new Date((b.fecha as any).seconds * 1000).getTime();
              return timeB - timeA;
            });
            if (skuFilter) {
              onUpdate(list.filter(m => m.sku.toLowerCase() === skuFilter.toLowerCase()));
            } else {
              onUpdate(list);
            }
          },
          (err) => {
            console.warn("Firestore realtime getMovimientosRealtime error:", err);
            fetchAndEmit();
          }
        );
        return unsubscribe;
      } catch (err) {
        console.warn("Could not attach onSnapshot to movimientos:", err);
      }
    }

    const update = () => {
      fetchAndEmit();
    };

    listeners.movimientos.push(update);
    return () => {
      listeners.movimientos = listeners.movimientos.filter(cb => cb !== update);
    };
  },

  deleteMovimiento: async (id: string): Promise<void> => {
    if (isConfigured && realDb) {
      try {
        const docRef = doc(realDb, "movimientos", id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn("Firestore deleteDoc (movimientos) failed, using local storage:", err);
      }
    }
    const list = getLocalStorageItem<Movimiento[]>("movimientos", []);
    const filtered = list.filter(m => m.id !== id);
    setLocalStorageItem("movimientos", filtered);
    notifyListeners("movimientos", filtered);

    // Recalcular y cuadrar el stock inmediatamente tras la eliminación
    // NOTA: El contador no se decrementa ni se reutiliza el folio eliminado
    await firestoreService.recalculateAndSyncStock(filtered);
  },

  recalculateAndSyncStock: async (customMovs?: Movimiento[]): Promise<Record<string, StockItem>> => {
    const movs = customMovs || (await firestoreService.getMovimientos());
    const almacenes = await firestoreService.getAlmacenes();
    const productos = await firestoreService.getProductos();

    const canonicalList = firestoreService.computeCanonicalStock(movs, almacenes, productos);
    const stockMap: Record<string, StockItem> = {};
    canonicalList.forEach(s => {
      stockMap[s.id] = s;
    });

    // 3. Persistir en almacenamiento local
    setLocalStorageItem("stock", stockMap);

    // 4. Si Firestore está conectado, persistir también
    if (isConfigured && realDb) {
      try {
        for (const [id, item] of Object.entries(stockMap)) {
          const docRef = doc(realDb, "stock", id);
          await setDoc(docRef, {
            sku: item.sku,
            almacen_id: item.almacen_id,
            cantidad: item.cantidad,
            actualizado: Timestamp.now()
          }, { merge: true });
        }
      } catch (err) {
        console.warn("Error sincronizando stock cuadrado con Firestore:", err);
      }
    }

    // 5. Notificar a componentes en tiempo real
    notifyListeners("stock", stockMap);
    return stockMap;
  },

  registerMovimientoTransaction: async (mov: Omit<Movimiento, "fecha" | "usuario">): Promise<{ id: string; folio: string }> => {
    const user = authService.getCurrentUser();
    const usuarioEmail = user ? user.email : "sistema@empresa.com";
    const prefix = firestoreService.getFolioPrefix(mov.tipo);

    let generatedFolio = "";
    let docId = "mov_" + Math.random().toString(36).substr(2, 9);

    // 1. Guardar en Firestore mediante Transacción Atómica para garantizar consecutivos únicos
    if (isConfigured && realDb) {
      try {
        const counterDocRef = doc(realDb, "contadores", mov.tipo);
        const movRef = doc(collection(realDb, "movimientos"));
        docId = movRef.id;

        await runTransaction(realDb, async (transaction) => {
          const counterDoc = await transaction.get(counterDocRef);
          let nextNumber = 1;
          if (counterDoc.exists()) {
            const data = counterDoc.data();
            const currentCount = data?.ultimo_consecutivo;
            if (typeof currentCount === "number") {
              nextNumber = currentCount + 1;
            }
          }

          generatedFolio = `${prefix}${nextNumber}`;

          // Actualizar contador atómicamente
          transaction.set(counterDocRef, {
            tipo: mov.tipo,
            ultimo_consecutivo: nextNumber,
            actualizado: Timestamp.now()
          }, { merge: true });

          // Registrar movimiento con folio asignado atómicamente
          transaction.set(movRef, {
            folio: generatedFolio,
            sku: mov.sku.trim().toUpperCase(),
            almacen_id: mov.almacen_id,
            tipo: mov.tipo,
            cantidad: Number(mov.cantidad),
            referencia: mov.referencia,
            usuario: usuarioEmail,
            fecha: Timestamp.now(),
            ...(mov.almacen_destino_id ? { almacen_destino_id: mov.almacen_destino_id } : {})
          });
        });
      } catch (err) {
        console.warn("Firestore runTransaction para folio atómico falló, usando emulador local:", err);
      }
    }

    // 2. Si no se generó vía Firestore (modo demostración / local), generar con contador local consecutivo
    if (!generatedFolio) {
      generatedFolio = firestoreService.getNextLocalFolio(mov.tipo);
    }

    // 3. Guardar en almacenamiento local
    const movimientos = getLocalStorageItem<Movimiento[]>("movimientos", []);
    const nuevoMovimiento: Movimiento = {
      id: docId,
      folio: generatedFolio,
      sku: mov.sku.trim().toUpperCase(),
      almacen_id: mov.almacen_id,
      tipo: mov.tipo,
      cantidad: Number(mov.cantidad),
      referencia: mov.referencia,
      usuario: usuarioEmail,
      fecha: new Date(),
      ...(mov.almacen_destino_id ? { almacen_destino_id: mov.almacen_destino_id } : {})
    };

    movimientos.push(nuevoMovimiento);
    setLocalStorageItem("movimientos", movimientos);
    notifyListeners("movimientos", movimientos);

    // 4. Cuadrar y sincronizar stock automáticamente según todas las auditorías
    await firestoreService.recalculateAndSyncStock(movimientos);

    return { id: docId, folio: generatedFolio };
  },

  // ==========================================
  // --- GESTIÓN DE CATÁLOGOS DINÁMICOS ---
  // ==========================================

  // Auto-import and seed categories & units merging existing products
  seedAndImportCatalogos: async (): Promise<{ categorias: CategoriaCatalogo[]; unidades: UnidadMedidaCatalogo[] }> => {
    // 1. Initial Standard Defaults
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

    // Scan existing products to import any custom category or unit already in use
    const productos = getLocalStorageItem<Producto[]>("productos", []);
    
    productos.forEach(p => {
      // Check category
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

      // Check unit
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

  // --- CATEGORÍAS ---
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

    // 1. Update category
    await firestoreService.updateCategoria(id, { nombre: cleanNew });

    // 2. Cascade rename to all products using old category
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

    // 1. Update unit
    await firestoreService.updateUnidad(id, { nombre: cleanNewNombre, abreviatura: cleanNewAbrev });

    // 2. Cascade rename in products
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

