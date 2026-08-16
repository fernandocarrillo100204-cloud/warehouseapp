/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { authService, isRealFirebase } from "../lib/firebase";
import { LogIn, Database, Key, Mail, Lock, AlertCircle, Warehouse } from "lucide-react";
import { motion } from "motion/react";

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await authService.login(email, password);
      onLoginSuccess(user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al iniciar sesión. Verifica tus credenciales.");
    } finally {
      setLoading(false);
    }
  };

  const loadDemoCredentials = () => {
    setEmail("admin@empresa.com");
    setPassword("admin123");
    setError(null);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await authService.loginWithGoogle();
      onLoginSuccess(user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al iniciar sesión con Google. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-8"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-emerald-500 p-3 rounded-2xl text-slate-950 shadow-lg shadow-emerald-500/10 mb-3">
            <Warehouse className="h-8 w-8" id="login-brand-icon" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">StockMaster</h1>
          <p className="text-xs font-medium text-slate-400 mt-0.5 tracking-wide">
            Metálicos y Plásticos Polo
          </p>
          <p className="text-xs text-slate-500 mt-1 text-center">
            Control de Inventario Multialmacén en Tiempo Real
          </p>
        </div>

        {/* Demo Warning / Guide */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Database className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-semibold text-slate-200">
                {isRealFirebase ? "Conexión Firebase Nube Activa" : "Modo Demostración / Emulador"}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {isRealFirebase 
                  ? "Puedes ingresar con cualquier cuenta Firebase registrada de tu proyecto." 
                  : "Usa las siguientes credenciales preestablecidas para acceder al sistema:"}
              </p>
              {!isRealFirebase && (
                <button
                  type="button"
                  onClick={loadDemoCredentials}
                  className="mt-2.5 inline-flex items-center text-xs text-emerald-400 hover:text-emerald-300 font-medium underline transition-all"
                >
                  <Key className="h-3 w-3 mr-1" />
                  Autocompletar credenciales de Demo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Form Error */}
        {error && (
          <div className="space-y-4 mb-6">
            {error.toLowerCase().includes("unauthorized-domain") || error.toLowerCase().includes("unauthorized domain") ? (
              <div className="bg-amber-950/40 border border-amber-800 text-amber-300 p-5 rounded-xl text-sm space-y-3">
                <div className="flex items-start space-x-2.5">
                  <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="font-semibold text-slate-200">Dominio no autorizado en Firebase Auth</div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Firebase Authentication requiere que autorices el dominio de esta aplicación para habilitar el inicio de sesión con Google o redirecciones seguras.
                </p>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 break-all select-all">
                  {window.location.hostname}
                </div>
                <div className="text-xs text-slate-300 space-y-1 pt-1">
                  <p className="font-semibold text-slate-200">¿Cómo solucionarlo?</p>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>Ve a tu <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Consola de Firebase</a>.</li>
                    <li>Selecciona tu proyecto e ingresa a <strong>Authentication</strong>.</li>
                    <li>Haz clic en la pestaña <strong>Ajustes (Settings)</strong> &gt; <strong>Dominios autorizados (Authorized domains)</strong>.</li>
                    <li>Haz clic en <strong>Agregar dominio (Add domain)</strong> y pega el dominio de arriba.</li>
                  </ol>
                </div>
                <div className="pt-2 text-[11px] text-slate-400">
                  Mientras tanto, puedes seguir probando todas las funciones usando el <strong>Modo Demostración / Emulador local</strong> arriba con las credenciales autocompletadas.
                </div>
              </div>
            ) : (
              <div className="bg-rose-950/40 border border-rose-800 text-rose-300 px-4 py-3 rounded-xl flex items-start space-x-2.5 text-sm">
                <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Correo Electrónico
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <Mail className="h-4 w-4 text-slate-500" />
              </span>
              <input
                type="email"
                required
                placeholder="usuario@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <Lock className="h-4 w-4 text-slate-500" />
              </span>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl py-3.5 px-4 transition-all hover:shadow-lg hover:shadow-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? (
              <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Ingresar al Sistema</span>
              </>
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900 px-3 text-slate-500">O también</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center space-x-2.5 bg-slate-950 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-slate-700 font-semibold rounded-xl py-3.5 px-4 transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm"
        >
          <svg className="h-5 w-5 mr-1" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span>Iniciar sesión con Google</span>
        </button>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} StockMaster Corp. Todos los derechos reservados.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
