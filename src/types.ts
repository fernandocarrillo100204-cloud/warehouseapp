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
  stock_minimo: number;
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
