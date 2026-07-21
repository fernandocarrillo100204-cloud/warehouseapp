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
  apiKey: metaEnv.VITE_FIREBASE_API_KEY,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: metaEnv.VITE_FIREBASE_APP_ID
};

const isConfigured = !!(
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  firebaseConfig.apiKey !== "MY_FIREBASE_API_KEY"
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
  const seeded = localStorage.getItem(STORAGE_PREFIX + "seeded");
  if (seeded) return;

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

  // 3. Stock inicial ({sku}_{almacenId})
  const stock: Record<string, StockItem> = {
    "SKU-1001_alm_1": { id: "SKU-1001_alm_1", sku: "SKU-1001", almacen_id: "alm_1", cantidad: 12, actualizado: new Date() },
    "SKU-1001_alm_2": { id: "SKU-1001_alm_2", sku: "SKU-1001", almacen_id: "alm_2", cantidad: 4, actualizado: new Date() }, // Bajo stock
    "SKU-1001_alm_3": { id: "SKU-1001_alm_3", sku: "SKU-1001", almacen_id: "alm_3", cantidad: 8, actualizado: new Date() },
    
    "SKU-1002_alm_1": { id: "SKU-1002_alm_1", sku: "SKU-1002", almacen_id: "alm_1", cantidad: 8, actualizado: new Date() },
    "SKU-1002_alm_2": { id: "SKU-1002_alm_2", sku: "SKU-1002", almacen_id: "alm_2", cantidad: 1, actualizado: new Date() }, // Bajo stock
    "SKU-1002_alm_3": { id: "SKU-1002_alm_3", sku: "SKU-1002", almacen_id: "alm_3", cantidad: 5, actualizado: new Date() },

    "SKU-1003_alm_1": { id: "SKU-1003_alm_1", sku: "SKU-1003", almacen_id: "alm_1", cantidad: 20, actualizado: new Date() },
    "SKU-1003_alm_2": { id: "SKU-1003_alm_2", sku: "SKU-1003", almacen_id: "alm_2", cantidad: 15, actualizado: new Date() },
    "SKU-1003_alm_3": { id: "SKU-1003_alm_3", sku: "SKU-1003", almacen_id: "alm_3", cantidad: 6, actualizado: new Date() }, // Bajo stock

    "SKU-1004_alm_1": { id: "SKU-1004_alm_1", sku: "SKU-1004", almacen_id: "alm_1", cantidad: 30, actualizado: new Date() },
    "SKU-1004_alm_2": { id: "SKU-1004_alm_2", sku: "SKU-1004", almacen_id: "alm_2", cantidad: 22, actualizado: new Date() },
    "SKU-1004_alm_3": { id: "SKU-1004_alm_3", sku: "SKU-1004", almacen_id: "alm_3", cantidad: 14, actualizado: new Date() },

    "SKU-1005_alm_1": { id: "SKU-1005_alm_1", sku: "SKU-1005", almacen_id: "alm_1", cantidad: 5, actualizado: new Date() },
    "SKU-1005_alm_2": { id: "SKU-1005_alm_2", sku: "SKU-1005", almacen_id: "alm_2", cantidad: 0, actualizado: new Date() }, // Sin stock
    "SKU-1005_alm_3": { id: "SKU-1005_alm_3", sku: "SKU-1005", almacen_id: "alm_3", cantidad: 3, actualizado: new Date() }
  };
  setLocalStorageItem("stock", stock);

  // 4. Movimientos iniciales
  const movimientos: Movimiento[] = [
    {
      id: "mov_1",
      sku: "SKU-1001",
      almacen_id: "alm_1",
      tipo: "entrada",
      cantidad: 15,
      referencia: "Factura Compra F-9901",
      usuario: "admin@empresa.com",
      fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 días atrás
    },
    {
      id: "mov_2",
      sku: "SKU-1002",
      almacen_id: "alm_2",
      tipo: "salida",
      cantidad: 2,
      referencia: "Nota de Entrega N-4501",
      usuario: "admin@empresa.com",
      fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 días atrás
    },
    {
      id: "mov_3",
      sku: "SKU-1003",
      almacen_id: "alm_3",
      tipo: "ajuste",
      cantidad: 6,
      referencia: "Inventario Mensual Julio",
      usuario: "admin@empresa.com",
      fecha: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 día atrás
    }
  ];
  setLocalStorageItem("movimientos", movimientos);

  // 5. Usuario por defecto
  setLocalStorageItem("currentUser", {
    uid: "usr_admin",
    email: "admin@empresa.com",
    nombre: "Administrador de Inventario"
  });

  localStorage.setItem(STORAGE_PREFIX + "seeded", "true");
};

// Execute seeding
seedData();

// List of listeners for mock real-time updates
const listeners: Record<string, ((data: any) => void)[]> = {
  stock: [],
  movimientos: []
};

const notifyListeners = (channel: "stock" | "movimientos", data: any) => {
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
      const snap = await getDocs(collection(realDb, "almacenes"));
      const list: Almacen[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as Almacen);
      });
      return list;
    } else {
      return getLocalStorageItem<Almacen[]>("almacenes", []);
    }
  },

  getProductos: async (): Promise<Producto[]> => {
    if (isConfigured && realDb) {
      const snap = await getDocs(collection(realDb, "productos"));
      const list: Producto[] = [];
      snap.forEach(d => {
        list.push({ sku: d.id, ...d.data() } as Producto);
      });
      return list;
    } else {
      return getLocalStorageItem<Producto[]>("productos", []);
    }
  },

  // Helper to ensure product exists in emulator or real database for scanning demonstration
  ensureProductExists: async (sku: string, nombre: string, categoria = "General", stockMinimo = 5, unidad = "uds"): Promise<Producto> => {
    const productData: Producto = { sku, nombre, categoria, stock_minimo: stockMinimo, unidad };
    if (isConfigured && realDb) {
      const docRef = doc(realDb, "productos", sku);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, { nombre, categoria, stock_minimo: stockMinimo, unidad });
      }
      return productData;
    } else {
      const prods = getLocalStorageItem<Producto[]>("productos", []);
      const existing = prods.find(p => p.sku === sku);
      if (!existing) {
        prods.push(productData);
        setLocalStorageItem("productos", prods);
      }
      return existing || productData;
    }
  },

  getStockRealtime: (onUpdate: (stock: StockItem[]) => void): (() => void) => {
    if (isConfigured && realDb) {
      return onSnapshot(collection(realDb, "stock"), (snap) => {
        const list: StockItem[] = [];
        snap.forEach(d => {
          const data = d.data();
          list.push({
            id: d.id,
            sku: data.sku,
            almacen_id: data.almacen_id,
            cantidad: data.cantidad,
            actualizado: data.actualizado ? (data.actualizado as Timestamp).toDate() : new Date()
          });
        });
        onUpdate(list);
      });
    } else {
      // Local emulator live subscription
      const update = () => {
        const stockRecord = getLocalStorageItem<Record<string, StockItem>>("stock", {});
        const list = Object.values(stockRecord).map(item => ({
          ...item,
          actualizado: typeof item.actualizado === "string" ? new Date(item.actualizado) : item.actualizado
        }));
        onUpdate(list);
      };
      
      update();
      listeners.stock.push(update);
      
      return () => {
        listeners.stock = listeners.stock.filter(cb => cb !== update);
      };
    }
  },

  getMovimientos: async (skuFilter?: string): Promise<Movimiento[]> => {
    if (isConfigured && realDb) {
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
      return list;
    } else {
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
    }
  },

  registerMovimientoTransaction: async (mov: Omit<Movimiento, "fecha" | "usuario">): Promise<void> => {
    const user = authService.getCurrentUser();
    const usuarioEmail = user ? user.email : "sistema@empresa.com";
    
    if (isConfigured && realDb) {
      // Real Firestore Transaction
      await runTransaction(realDb, async (transaction) => {
        // Read current stock
        const stockId = `${mov.sku}_${mov.almacen_id}`;
        const stockRef = doc(realDb, "stock", stockId);
        const stockSnap = await transaction.get(stockRef);
        
        let currentQty = 0;
        if (stockSnap.exists()) {
          currentQty = stockSnap.data().cantidad || 0;
        }

        let newQty = currentQty;
        if (mov.tipo === "entrada") {
          newQty += mov.cantidad;
        } else if (mov.tipo === "salida") {
          newQty -= mov.cantidad;
        } else if (mov.tipo === "ajuste") {
          newQty = mov.cantidad;
        } else if (mov.tipo === "transferencia" && mov.almacen_destino_id) {
          // Dest warehouse transaction
          newQty -= mov.cantidad;
          
          const destStockId = `${mov.sku}_${mov.almacen_destino_id}`;
          const destStockRef = doc(realDb, "stock", destStockId);
          const destStockSnap = await transaction.get(destStockRef);
          
          let destQty = 0;
          if (destStockSnap.exists()) {
            destQty = destStockSnap.data().cantidad || 0;
          }
          
          transaction.set(destStockRef, {
            sku: mov.sku,
            almacen_id: mov.almacen_destino_id,
            cantidad: destQty + mov.cantidad,
            actualizado: Timestamp.now()
          });
        }

        // Apply changes to origin stock
        transaction.set(stockRef, {
          sku: mov.sku,
          almacen_id: mov.almacen_id,
          cantidad: newQty,
          actualizado: Timestamp.now()
        });

        // Add movement record
        const movRef = doc(collection(realDb, "movimientos"));
        transaction.set(movRef, {
          sku: mov.sku,
          almacen_id: mov.almacen_id,
          tipo: mov.tipo,
          cantidad: mov.cantidad,
          referencia: mov.referencia,
          usuario: usuarioEmail,
          fecha: Timestamp.now(),
          ...(mov.almacen_destino_id ? { almacen_destino_id: mov.almacen_destino_id } : {})
        });
      });
    } else {
      // High-Fidelity Local Emulator Transaction Simulation
      const stocks = getLocalStorageItem<Record<string, StockItem>>("stock", {});
      const movimientos = getLocalStorageItem<Movimiento[]>("movimientos", []);

      const stockId = `${mov.sku}_${mov.almacen_id}`;
      const currentStockItem = stocks[stockId] || {
        id: stockId,
        sku: mov.sku,
        almacen_id: mov.almacen_id,
        cantidad: 0,
        actualizado: new Date()
      };

      let currentQty = currentStockItem.cantidad;
      let newQty = currentQty;

      if (mov.tipo === "entrada") {
        newQty += mov.cantidad;
      } else if (mov.tipo === "salida") {
        newQty -= mov.cantidad;
      } else if (mov.tipo === "ajuste") {
        newQty = mov.cantidad;
      } else if (mov.tipo === "transferencia" && mov.almacen_destino_id) {
        newQty -= mov.cantidad;
        
        // Handle destination warehouse
        const destStockId = `${mov.sku}_${mov.almacen_destino_id}`;
        const destStockItem = stocks[destStockId] || {
          id: destStockId,
          sku: mov.sku,
          almacen_id: mov.almacen_destino_id,
          cantidad: 0,
          actualizado: new Date()
        };
        
        destStockItem.cantidad += mov.cantidad;
        destStockItem.actualizado = new Date();
        stocks[destStockId] = destStockItem;
      }

      // Prevent negative stocks if not adjustment or forced
      if (newQty < 0 && (mov.tipo === "salida" || mov.tipo === "transferencia")) {
        throw new Error(`Inconsistencia: Stock insuficiente en el almacén de origen. Stock actual: ${currentQty}, cantidad solicitada: ${mov.cantidad}.`);
      }

      // Save origin stock change
      currentStockItem.cantidad = newQty;
      currentStockItem.actualizado = new Date();
      stocks[stockId] = currentStockItem;

      // Save stock state
      setLocalStorageItem("stock", stocks);

      // Create and save movement record
      const nuevoMovimiento: Movimiento = {
        id: "mov_" + Math.random().toString(36).substr(2, 9),
        sku: mov.sku,
        almacen_id: mov.almacen_id,
        tipo: mov.tipo,
        cantidad: mov.cantidad,
        referencia: mov.referencia,
        usuario: usuarioEmail,
        fecha: new Date(),
        ...(mov.almacen_destino_id ? { almacen_destino_id: mov.almacen_destino_id } : {})
      };

      movimientos.push(nuevoMovimiento);
      setLocalStorageItem("movimientos", movimientos);

      // Notify live snapshot listeners
      notifyListeners("stock", stocks);
      notifyListeners("movimientos", movimientos);
    }
  }
};
