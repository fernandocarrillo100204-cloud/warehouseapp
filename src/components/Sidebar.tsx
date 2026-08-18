/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  PlusCircle, 
  History, 
  LayoutDashboard, 
  TrendingUp, 
  Warehouse, 
  Package, 
  LogOut, 
  Menu, 
  X,
  User as UserIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Usuario, NavigationTab } from "../types";

interface SidebarProps {
  user: Usuario;
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onLogout: () => void;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "movimientos", label: "Registrar movimiento", icon: PlusCircle },
  { id: "historial", label: "Historial", icon: History },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "ventas", label: "Análisis de ventas", icon: TrendingUp },
  { id: "almacenes", label: "Almacenes", icon: Warehouse },
  { id: "catalogo", label: "Productos", icon: Package },
];

export default function Sidebar({ user, activeTab, setActiveTab, onLogout }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelectTab = (tab: NavigationTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  // Shared navigation items component
  const NavContent = () => (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Top Branding & Navigation */}
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="px-3.5 py-3 border-b border-[#E2E8F0]">
          <h1 className="text-base font-bold tracking-tight text-[#172033] leading-tight">
            StockMaster
          </h1>
          <p className="text-[11px] text-[#64748B] font-medium leading-tight mt-0.5">
            Metálicos y Plásticos Polo
          </p>
        </div>

        {/* Navigation Links (14px text) */}
        <nav className="p-2 space-y-1" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                id={`nav-item-${item.id}`}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-all text-left ${
                  isActive
                    ? "bg-[#ECFDF5] text-[#059669] font-semibold border-l-2 border-[#059669] pl-2"
                    : "text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] font-normal"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#059669]" : "text-[#64748B]"}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Profile & Logout */}
      <div className="p-3 border-t border-[#E2E8F0] bg-white/80">
        <div className="flex items-center space-x-2 mb-2 px-1">
          <div className="h-7 w-7 rounded-md bg-[#ECFDF5] border border-emerald-200/80 flex items-center justify-center text-[#059669] shrink-0">
            <UserIcon className="h-3.5 w-3.5 text-[#059669]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-[#64748B] font-medium leading-none">Usuario</p>
            <p 
              className="text-xs font-semibold text-[#172033] truncate mt-0.5" 
              title={user.email}
            >
              {user.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          id="sidebar-logout-btn"
          onClick={() => {
            setMobileOpen(false);
            onLogout();
          }}
          className="w-full flex items-center justify-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium text-[#64748B] hover:text-rose-600 hover:bg-rose-50 border border-[#E2E8F0] hover:border-rose-200 rounded-lg transition-all"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ---------------------------------------------------- */}
      {/* DESKTOP PERMANENT SIDEBAR (~224px) */}
      {/* ---------------------------------------------------- */}
      <aside 
        className="hidden md:flex fixed inset-y-0 left-0 z-40 w-[224px] bg-[#F8FAFC] border-r border-[#E2E8F0] flex-col justify-between"
        id="desktop-sidebar"
      >
        <NavContent />
      </aside>

      {/* ---------------------------------------------------- */}
      {/* MOBILE TOP BAR WITH MENU TOGGLE */}
      {/* ---------------------------------------------------- */}
      <header 
        className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-3.5 py-2.5 flex items-center justify-between"
        id="mobile-top-header"
      >
        <div>
          <span className="font-bold text-base text-[#172033] tracking-tight">StockMaster</span>
          <p className="text-[10px] text-[#64748B] font-medium -mt-0.5">Metálicos y Plásticos Polo</p>
        </div>

        <button
          type="button"
          id="mobile-menu-toggle-btn"
          onClick={() => setMobileOpen(true)}
          className="p-1.5 text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] rounded-lg transition-colors focus:outline-none"
          aria-label="Abrir menú de navegación"
          title="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* ---------------------------------------------------- */}
      {/* MOBILE SLIDE-OVER DRAWER */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Slide-out Sidebar Panel */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 260 }}
              className="relative w-[224px] max-w-[80vw] bg-[#F8FAFC] border-r border-[#E2E8F0] flex flex-col justify-between shadow-xl z-10"
              id="mobile-drawer-sidebar"
            >
              {/* Close Button Inside Drawer */}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute top-3 right-3 p-1 text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] rounded-lg transition-colors z-20"
                aria-label="Cerrar menú"
                title="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>

              <NavContent />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
