/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { authService, firestoreService } from "./lib/firebase";
import { Usuario, Almacen, Producto, NavigationTab } from "./types";
import Sidebar from "./components/Sidebar";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import MovimientoForm from "./components/MovimientoForm";
import Historial from "./components/Historial";
import GestionAlmacenes from "./components/GestionAlmacenes";
import GestionProductos from "./components/GestionProductos";
import AnalisisVentas from "./components/AnalisisVentas";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<Usuario | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  
  const [activeTab, setActiveTab] = useState<NavigationTab>("movimientos");
  const [preselectedSku, setPreselectedSku] = useState("");
  const [preselectedAlmacenId, setPreselectedAlmacenId] = useState("");

  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);

  // Monitor Auth State Changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to real-time warehouses and products updates globally
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    // Subscribe to warehouses
    const unsubscribeAlmacenes = firestoreService.getAlmacenesRealtime((almList) => {
      setAlmacenes(almList);
    });

    // Subscribe to products
    const unsubscribeProductos = firestoreService.getProductosRealtime((prodList) => {
      setProductos(prodList);
    });

    return () => {
      unsubscribeAlmacenes();
      unsubscribeProductos();
    };
  }, [user?.uid]);

  const handleLogout = async () => {
    try {
      await authService.logout();
      setUser(null);
      // Reset active views
      setActiveTab("movimientos");
      setPreselectedSku("");
      setPreselectedAlmacenId("");
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  const handleNavigateToMovements = (sku?: string, almacenId?: string) => {
    setPreselectedSku(sku || "");
    setPreselectedAlmacenId(almacenId || "");
    setActiveTab("movimientos");
  };

  const handleNavigateToHistory = (sku?: string) => {
    if (sku) {
      setPreselectedSku(sku);
    } else {
      setPreselectedSku("");
    }
    setActiveTab("historial");
  };

  // Render Loading spinner during initial firebase state check
  if (authChecking) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0B1220] flex flex-col items-center justify-center text-[#64748B] dark:text-[#94A3B8] transition-colors">
        <span className="h-9 w-9 border-3 border-[#059669] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-medium text-[#172033] dark:text-[#F8FAFC]">Iniciando entorno de inventario...</p>
      </div>
    );
  }

  // Auth Guard
  if (!user) {
    return (
      <Login 
        onLoginSuccess={(u) => {
          setUser(u);
          setActiveTab("movimientos");
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B1220] text-[#172033] dark:text-[#F8FAFC] flex flex-col md:flex-row font-sans selection:bg-[#ECFDF5] dark:selection:bg-emerald-950/60 selection:text-[#059669] dark:selection:text-emerald-400 transition-colors duration-200">
      {/* Left Minimalist Sidebar (Desktop permanent + Mobile slide-over) */}
      <Sidebar 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          // If manually navigating away from historical search, clear preset
          if (tab !== "historial" && tab !== "movimientos") {
            setPreselectedSku("");
          }
          setActiveTab(tab);
        }} 
        onLogout={handleLogout} 
      />

      {/* Main Content Area: offsets for 224px fixed desktop sidebar */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-[224px]">
        <main className="flex-1 w-full relative min-h-screen overflow-x-hidden">
          <div className="w-full">
            <AnimatePresence mode="wait">
              {activeTab === "dashboard" && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <Dashboard 
                    almacenes={almacenes} 
                    productos={productos} 
                    onNavigateToMovements={handleNavigateToMovements}
                    onNavigateToHistory={handleNavigateToHistory}
                  />
                </motion.div>
              )}

              {activeTab === "ventas" && (
                <motion.div
                  key="ventas"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <AnalisisVentas 
                    almacenes={almacenes} 
                    productos={productos} 
                    onNavigateToHistory={handleNavigateToHistory}
                  />
                </motion.div>
              )}

              {activeTab === "almacenes" && (
                <motion.div
                  key="almacenes"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <GestionAlmacenes 
                    productos={productos} 
                  />
                </motion.div>
              )}

              {activeTab === "catalogo" && (
                <motion.div
                  key="catalogo"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <GestionProductos 
                    almacenes={almacenes}
                    onNavigateToMovimiento={(sku) => {
                      setPreselectedSku(sku);
                      setActiveTab("movimientos");
                    }}
                  />
                </motion.div>
              )}

              {activeTab === "movimientos" && (
                <motion.div
                  key="movimientos"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <MovimientoForm 
                    almacenes={almacenes} 
                    productos={productos} 
                    preselectedSku={preselectedSku}
                    preselectedAlmacenId={preselectedAlmacenId}
                    onSuccess={() => {
                      // Navigate to historial or keep on form with cleared SKU and warehouse
                      setActiveTab("historial");
                      setPreselectedSku("");
                      setPreselectedAlmacenId("");
                    }}
                    onCancel={() => {
                      setPreselectedSku("");
                      setPreselectedAlmacenId("");
                    }}
                  />
                </motion.div>
              )}

              {activeTab === "historial" && (
                <motion.div
                  key="historial"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <Historial 
                    almacenes={almacenes} 
                    productos={productos} 
                    preselectedSku={preselectedSku}
                    onClearPreselectedSku={() => setPreselectedSku("")}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
