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
import { Almacen, Producto, StockItem, Movimiento, Usuario } from "../types";

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
  if (seededVersion === "v2_auditoria_cuadrada") return;

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

  // 3. Movimientos de Auditoría (El origen fidedigno de todo el stock)
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const movimientos: Movimiento[] = [
    // --- SKU-1001 (Laptop Pro 15") -> Stock final: alm_1=8, alm_2=4, alm_3=8 | Global=20
    {
      id: "mov_101",
      sku: "SKU-1001",
      almacen_id: "alm_1",
      tipo: "entrada",
      cantidad: 15,
      referencia: "Recepción de Compra Lote Tech #101",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 5 * day)
    },
    {
      id: "mov_102",
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
      id: "mov_103",
      sku: "SKU-1001",
      almacen_id: "alm_3",
      tipo: "entrada",
      cantidad: 8,
      referencia: "Recepción directa Distribuidor Sur",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 3 * day)
    },
    {
      id: "mov_104",
      sku: "SKU-1001",
      almacen_id: "alm_1",
      tipo: "salida",
      cantidad: 3,
      referencia: "Factura Venta Cliente Corporativo F-9901",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 1 * day)
    },

    // --- SKU-1002 (Monitor UltraWide 34") -> Stock final: alm_1=3, alm_2=1, alm_3=5 | Global=9
    {
      id: "mov_201",
      sku: "SKU-1002",
      almacen_id: "alm_1",
      tipo: "entrada",
      cantidad: 10,
      referencia: "Importación Lote Displays M-201",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 6 * day)
    },
    {
      id: "mov_202",
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
      id: "mov_203",
      sku: "SKU-1002",
      almacen_id: "alm_2",
      tipo: "entrada",
      cantidad: 3,
      referencia: "Compra local Bilbao",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 3 * day)
    },
    {
      id: "mov_204",
      sku: "SKU-1002",
      almacen_id: "alm_1",
      tipo: "salida",
      cantidad: 2,
      referencia: "Despacho Orden Online #4012",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 2 * day)
    },
    {
      id: "mov_205",
      sku: "SKU-1002",
      almacen_id: "alm_2",
      tipo: "salida",
      cantidad: 2,
      referencia: "Nota de Entrega N-4501",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 1 * day)
    },

    // --- SKU-1003 (Silla Ergonómica Premium) -> Stock final: alm_1=5, alm_2=15, alm_3=6 | Global=26
    {
      id: "mov_301",
      sku: "SKU-1003",
      almacen_id: "alm_1",
      tipo: "entrada",
      cantidad: 25,
      referencia: "Contenedor Mobiliario Ergo #88",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 7 * day)
    },
    {
      id: "mov_302",
      sku: "SKU-1003",
      almacen_id: "alm_1",
      tipo: "transferencia",
      cantidad: 15,
      referencia: "Carga de reabastecimiento Norte",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 5 * day),
      almacen_destino_id: "alm_2"
    },
    {
      id: "mov_303",
      sku: "SKU-1003",
      almacen_id: "alm_3",
      tipo: "entrada",
      cantidad: 6,
      referencia: "Recepción de Mercancía R-102",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 2 * day)
    },
    {
      id: "mov_304",
      sku: "SKU-1003",
      almacen_id: "alm_1",
      tipo: "salida",
      cantidad: 5,
      referencia: "Dotación Sede Central Fac-441",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 1 * day)
    },

    // --- SKU-1004 (Teclado Mecánico Inalámbrico) -> Stock final: alm_1=30, alm_2=22, alm_3=14 | Global=66
    {
      id: "mov_401",
      sku: "SKU-1004",
      almacen_id: "alm_1",
      tipo: "entrada",
      cantidad: 35,
      referencia: "Factura Importación Keyboards #991",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 6 * day)
    },
    {
      id: "mov_402",
      sku: "SKU-1004",
      almacen_id: "alm_2",
      tipo: "entrada",
      cantidad: 22,
      referencia: "Recepción Sucursal Norte",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 4 * day)
    },
    {
      id: "mov_403",
      sku: "SKU-1004",
      almacen_id: "alm_3",
      tipo: "entrada",
      cantidad: 14,
      referencia: "Recepción Sucursal Sur",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 3 * day)
    },
    {
      id: "mov_404",
      sku: "SKU-1004",
      almacen_id: "alm_1",
      tipo: "salida",
      cantidad: 5,
      referencia: "Venta Mayorista Tech-Dist #312",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 1 * day)
    },

    // --- SKU-1005 (Escritorio Elevable Eléctrico) -> Stock final: alm_1=5, alm_2=0, alm_3=3 | Global=8
    {
      id: "mov_501",
      sku: "SKU-1005",
      almacen_id: "alm_1",
      tipo: "entrada",
      cantidad: 6,
      referencia: "Inventario Inicial Fábrica Mobel",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 8 * day)
    },
    {
      id: "mov_502",
      sku: "SKU-1005",
      almacen_id: "alm_3",
      tipo: "entrada",
      cantidad: 3,
      referencia: "Recepción Fábrica Lote Sevilla",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 4 * day)
    },
    {
      id: "mov_503",
      sku: "SKU-1005",
      almacen_id: "alm_1",
      tipo: "salida",
      cantidad: 1,
      referencia: "Venta Showroom Madrid NV-109",
      usuario: "admin@empresa.com",
      fecha: new Date(now - 2 * day)
    }
  ];
  setLocalStorageItem("movimientos", movimientos);

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

  localStorage.setItem(STORAGE_PREFIX + "seeded_version", "v2_auditoria_cuadrada");
};

// Execute seeding
seedData();

// List of listeners for mock real-time updates
const listeners: Record<string, ((data: any) => void)[]> = {
  stock: [],
  movimientos: [],
  almacenes: [],
  productos: []
};

const notifyListeners = (channel: "stock" | "movimientos" | "almacenes" | "productos", data: any) => {
  listeners[channel].forEach(callback => callback(data));
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
        return adminUser;
      } else if (email && password.length >= 6) {
        // Allow dynamic creation/sign-in for easy testing
        const newUser: Usuario = {
          uid: "usr_" + Math.random().toString(36).substr(2, 9),
          email: email,
          nombre: email.split("@")[0]
        };
        setLocalStorageItem("currentUser", newUser);
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
      return googleUser;
    }
  },

  logout: async (): Promise<void> => {
    if (isConfigured && realAuth) {
      await signOut(realAuth);
    } else {
      localStorage.removeItem(STORAGE_PREFIX + "currentUser");
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
      // Emulator state trigger
      const checkUser = () => {
        const user = getLocalStorageItem<Usuario | null>("currentUser", null);
        callback(user);
      };
      checkUser();
      
      // Return simple unregister trigger
      const interval = setInterval(checkUser, 1000);
      return () => clearInterval(interval);
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

  registerMovimientoTransaction: async (mov: Omit<Movimiento, "fecha" | "usuario">): Promise<void> => {
    const user = authService.getCurrentUser();
    const usuarioEmail = user ? user.email : "sistema@empresa.com";
    
    // 1. Guardar en Firestore si está conectado
    if (isConfigured && realDb) {
      try {
        const movRef = doc(collection(realDb, "movimientos"));
        await setDoc(movRef, {
          sku: mov.sku.trim().toUpperCase(),
          almacen_id: mov.almacen_id,
          tipo: mov.tipo,
          cantidad: Number(mov.cantidad),
          referencia: mov.referencia,
          usuario: usuarioEmail,
          fecha: Timestamp.now(),
          ...(mov.almacen_destino_id ? { almacen_destino_id: mov.almacen_destino_id } : {})
        });
      } catch (err) {
        console.warn("Firestore save movement failed, using local fallback:", err);
      }
    }

    // 2. Guardar en almacenamiento local
    const movimientos = getLocalStorageItem<Movimiento[]>("movimientos", []);
    const nuevoMovimiento: Movimiento = {
      id: "mov_" + Math.random().toString(36).substr(2, 9),
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

    // 3. Cuadrar y sincronizar stock automáticamente según todas las auditorías
    await firestoreService.recalculateAndSyncStock(movimientos);
  }
};
