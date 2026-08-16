/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Almacen {
  id: string;
  nombre: string;
  ubicacion: string;
}

export interface Producto {
  sku: string;
  nombre: string;
  categoria: string;
  stock_minimo: number; // Global o fallback legacy
  stock_minimo_almacenes?: Record<string, number>; // Mínimo individual por almacén (0 = alerta desactivada)
  unidad: string;
}

export interface StockItem {
  id: string; // sku_almacenId
  sku: string;
  almacen_id: string;
  cantidad: number;
  actualizado: {
    seconds: number;
    nanoseconds: number;
  } | Date;
}

export interface Movimiento {
  id?: string;
  folio?: string; // Folio consecutivo único: Entrada-1, Salida-1, Transferencia-1
  sku: string;
  almacen_id: string;
  tipo: "entrada" | "salida" | "ajuste" | "transferencia";
  cantidad: number;
  referencia: string;
  usuario: string;
  fecha: {
    seconds: number;
    nanoseconds: number;
  } | Date;
  almacen_destino_id?: string; // Para transferencias
}

export interface Usuario {
  uid: string;
  email: string;
  nombre?: string;
}

export type NavigationTab = "dashboard" | "almacenes" | "catalogo" | "movimientos" | "historial" | "ventas";

export type PeriodoVenta = "esta_semana" | "mes_actual" | "ultimos_30_dias" | "personalizado";

export interface CategoriaCatalogo {
  id: string;
  nombre: string;
  activa: boolean;
  creado?: {
    seconds: number;
    nanoseconds: number;
  } | Date;
}

export interface UnidadMedidaCatalogo {
  id: string;
  nombre: string;
  abreviatura: string;
  activa: boolean;
  creado?: {
    seconds: number;
    nanoseconds: number;
  } | Date;
}

