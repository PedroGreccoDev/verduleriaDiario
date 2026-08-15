/**
 * Errores de dominio.
 *
 * Llevan un `codigo` estable además del mensaje: los tests y (más adelante) la UI
 * dependen del código, no del texto. Así el mensaje se puede reescribir para que
 * sea más claro sin romper nada.
 */

export type CodigoError =
  // Turnos (§4.1)
  | "TURNO_YA_ABIERTO"
  | "TURNO_ANTERIOR_SIN_CERRAR"
  | "TURNO_NO_ENCONTRADO"
  | "TURNO_CERRADO"
  // Caja (§3.1)
  | "MONTO_INVALIDO"
  | "CATEGORIA_NO_ENCONTRADA"
  | "CATEGORIA_NO_CARGABLE"
  // Cheques (§4.2, §4.3, §4.4)
  | "CHEQUE_NO_ENCONTRADO"
  | "CHEQUE_FUERA_DE_CARTERA"
  | "CHEQUE_NO_ENTREGADO"
  | "CHEQUE_YA_RECHAZADO"
  | "CHEQUE_SIN_ENTREGA"
  | "PORCENTAJE_INVALIDO"
  | "IMPUTACION_SUPERA_NOMINAL"
  // Proveedores (§3.3, §4.5)
  | "PROVEEDOR_NO_ENCONTRADO"
  | "PROVEEDOR_INACTIVO"
  | "FACTURA_NO_ENCONTRADA"
  | "FACTURA_DE_OTRO_PROVEEDOR"
  | "FACTURA_YA_PAGADA"
  | "IMPUTACION_SUPERA_SALDO_FACTURA"
  | "IMPUTACION_SUPERA_PAGO"
  | "IMPUTACION_DUPLICADA"
  // Clientes (§3.4)
  | "CLIENTE_NO_ENCONTRADO"
  | "NOMBRE_REQUERIDO";

export class ErrorDominio extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorDominio";
  }
}

export function errorDominio(codigo: CodigoError, mensaje: string): ErrorDominio {
  return new ErrorDominio(codigo, mensaje);
}
