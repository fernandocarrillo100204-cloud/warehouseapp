/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { authService, firestoreService } from "./lib/firebase";
import { Usuario, Almacen, Producto } from "./types";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import MovimientoForm from "./components/MovimientoForm";
import Historial from "./components/Historial";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<Usuario | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"dashboard" | "movimientos" | "historial">("dashboard");
  const [preselectedSku, setPreselectedSku] = useState("");

  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Monitor Auth State Changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch static warehouses and product list when user logs in
  const loadStaticData = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const [almList, prodList] = await Promise.all([
        firestoreService.getAlmacenes(),
        firestoreService.getProductos()
      ]);
      setAlmacenes(almList);
      setProductos(prodList);
    } catch (err) {
      console.error("Failed to load warehouses or products data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadStaticData();
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await authService.logout();
      setUser(null);
      // Reset active views
      setActiveTab("dashboard");
      setPreselectedSku("");
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  const handleNavigateToMovements = (sku?: string) => {
    if (sku) {
      setPreselectedSku(sku);
    } else {
      setPreselectedSku("");
    }
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <span className="h-10 w-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Iniciando entorno de inventario...</p>
      </div>
    );
  }

  // Auth Guard
  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Shared Navbar */}
      <Navbar 
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

      {/* Main Panel Content Area with motion transitions */}
      <main className="flex-1 w-full relative">
        {loadingData ? (
          <div className="py-24 text-center text-slate-400">
            <span className="h-8 w-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block mb-3" />
            <p className="text-sm">Sincronizando información de catálogo con Firestore...</p>
          </div>
        ) : (
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
                    onSuccess={() => {
                      // Refresh product list in case they added a brand new custom product
                      loadStaticData();
                      // Back to dashboard
                      setActiveTab("dashboard");
                      setPreselectedSku("");
                    }}
                    onCancel={() => {
                      setActiveTab("dashboard");
                      setPreselectedSku("");
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
        )}
      </main>
    </div>
  );
}
