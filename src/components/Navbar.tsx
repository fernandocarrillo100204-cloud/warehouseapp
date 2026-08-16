/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { authService } from "../lib/firebase";
import { Warehouse, LogOut, Boxes, History, Package, TrendingUp } from "lucide-react";
import { Usuario, NavigationTab } from "../types";

interface NavbarProps {
  user: Usuario;
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onLogout: () => void;
}

export default function Navbar({ user, activeTab, setActiveTab, onLogout }: NavbarProps) {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Title */}
          <div className="flex items-center -ml-1 sm:-ml-2">
            <span className="font-bold text-lg tracking-tight text-white">StockMaster</span>
          </div>

          {/* Navigation Items */}
          <nav className="hidden md:flex space-x-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "dashboard"
                  ? "bg-slate-800 text-emerald-400 border border-slate-700"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Boxes className="h-4 w-4" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab("ventas")}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "ventas"
                  ? "bg-slate-800 text-emerald-400 border border-slate-700"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>Análisis de ventas</span>
            </button>
            <button
              onClick={() => setActiveTab("almacenes")}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "almacenes"
                  ? "bg-slate-800 text-emerald-400 border border-slate-700"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Warehouse className="h-4 w-4" />
              <span>Almacenes</span>
            </button>
            <button
              onClick={() => setActiveTab("catalogo")}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "catalogo"
                  ? "bg-slate-800 text-emerald-400 border border-slate-700"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Package className="h-4 w-4" />
              <span>Catálogo</span>
            </button>
            <button
              onClick={() => setActiveTab("movimientos")}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "movimientos"
                  ? "bg-slate-800 text-emerald-400 border border-slate-700"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <PlusCircleIcon className="h-4 w-4" />
              <span>Registrar Movimiento</span>
            </button>
            <button
              onClick={() => setActiveTab("historial")}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "historial"
                  ? "bg-slate-800 text-emerald-400 border border-slate-700"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <History className="h-4 w-4" />
              <span>Historial</span>
            </button>
          </nav>

          {/* User Profile & Connection Info */}
          <div className="flex items-center space-x-4">
            {/* Profile Info */}
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400">Usuario activo</p>
              <p className="text-sm font-semibold text-slate-200">{user.email}</p>
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation rail */}
      <div className="md:hidden flex justify-around border-t border-slate-800 bg-slate-900 py-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center space-y-1 text-xs px-2.5 py-1 rounded-md shrink-0 ${
            activeTab === "dashboard" ? "text-emerald-400" : "text-slate-400"
          }`}
        >
          <Boxes className="h-5 w-5" />
          <span>Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab("ventas")}
          className={`flex flex-col items-center space-y-1 text-xs px-2.5 py-1 rounded-md shrink-0 ${
            activeTab === "ventas" ? "text-emerald-400" : "text-slate-400"
          }`}
        >
          <TrendingUp className="h-5 w-5" />
          <span>Ventas</span>
        </button>
        <button
          onClick={() => setActiveTab("almacenes")}
          className={`flex flex-col items-center space-y-1 text-xs px-2.5 py-1 rounded-md shrink-0 ${
            activeTab === "almacenes" ? "text-emerald-400" : "text-slate-400"
          }`}
        >
          <Warehouse className="h-5 w-5" />
          <span>Almacenes</span>
        </button>
        <button
          onClick={() => setActiveTab("catalogo")}
          className={`flex flex-col items-center space-y-1 text-xs px-2.5 py-1 rounded-md shrink-0 ${
            activeTab === "catalogo" ? "text-emerald-400" : "text-slate-400"
          }`}
        >
          <Package className="h-5 w-5" />
          <span>Catálogo</span>
        </button>
        <button
          onClick={() => setActiveTab("movimientos")}
          className={`flex flex-col items-center space-y-1 text-xs px-2.5 py-1 rounded-md shrink-0 ${
            activeTab === "movimientos" ? "text-emerald-400" : "text-slate-400"
          }`}
        >
          <PlusCircleIcon className="h-5 w-5" />
          <span>Movimiento</span>
        </button>
        <button
          onClick={() => setActiveTab("historial")}
          className={`flex flex-col items-center space-y-1 text-xs px-2.5 py-1 rounded-md shrink-0 ${
            activeTab === "historial" ? "text-emerald-400" : "text-slate-400"
          }`}
        >
          <History className="h-5 w-5" />
          <span>Historial</span>
        </button>
      </div>
    </header>
  );
}

// Inline helper for PlusCircle which was imported incorrectly in some templates
function PlusCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}
