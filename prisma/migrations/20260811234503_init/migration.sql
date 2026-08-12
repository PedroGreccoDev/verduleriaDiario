-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('abierto', 'cerrado');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('ingreso', 'egreso');

-- CreateEnum
CREATE TYPE "ReferenciaMovimientoCaja" AS ENUM ('retiro_turno', 'compra_cheque', 'pago_proveedor', 'cobro_cliente', 'gasto', 'retiro_socio', 'manual');

-- CreateEnum
CREATE TYPE "EstadoCheque" AS ENUM ('en_cartera', 'entregado', 'acreditado', 'rechazado');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('pendiente', 'parcial', 'pagada');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('efectivo', 'cheque', 'transferencia');

-- CreateEnum
CREATE TYPE "TipoMovimientoCuentaCorriente" AS ENUM ('cargo', 'pago');

-- CreateEnum
CREATE TYPE "ReferenciaCuentaCorriente" AS ENUM ('manual', 'pago', 'ajuste', 'venta');

-- CreateTable
CREATE TABLE "turno" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" "EstadoTurno" NOT NULL DEFAULT 'abierto',
    "fecha_apertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" TIMESTAMP(3),
    "observacion" TEXT,

    CONSTRAINT "turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria_movimiento" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "slug" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categoria_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_caja" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "turno_id" TEXT,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "referencia_tipo" "ReferenciaMovimientoCaja" NOT NULL,
    "referencia_id" TEXT,
    "observacion" TEXT,

    CONSTRAINT "movimiento_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendedor_cheque" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contacto" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vendedor_cheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheque" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "librador" TEXT NOT NULL,
    "nominal" DECIMAL(14,2) NOT NULL,
    "porcentaje_descuento" DECIMAL(5,2) NOT NULL,
    "monto_pagado" DECIMAL(14,2) NOT NULL,
    "ahorro" DECIMAL(14,2) NOT NULL,
    "fecha_compra" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" DATE NOT NULL,
    "vendedor_cheque_id" TEXT NOT NULL,
    "estado" "EstadoCheque" NOT NULL DEFAULT 'en_cartera',
    "fecha_entrega" TIMESTAMP(3),
    "proveedor_destino_id" TEXT,
    "fecha_rechazo" TIMESTAMP(3),
    "motivo_rechazo" TEXT,
    "observacion" TEXT,

    CONSTRAINT "cheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imputacion_cheque" (
    "id" TEXT NOT NULL,
    "cheque_id" TEXT NOT NULL,
    "factura_proveedor_id" TEXT NOT NULL,
    "monto_imputado" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "imputacion_cheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contacto" TEXT,
    "saldo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factura_proveedor" (
    "id" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "fecha_vencimiento" DATE,
    "monto_total" DECIMAL(14,2) NOT NULL,
    "saldo_pendiente" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'pendiente',

    CONSTRAINT "factura_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago_proveedor" (
    "id" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "medio" "MedioPago" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "cheque_id" TEXT,
    "observacion" TEXT,

    CONSTRAINT "pago_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imputacion_pago" (
    "id" TEXT NOT NULL,
    "pago_proveedor_id" TEXT NOT NULL,
    "factura_proveedor_id" TEXT NOT NULL,
    "monto_imputado" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "imputacion_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "limite_credito" DECIMAL(14,2),
    "saldo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_cuenta_corriente" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoMovimientoCuentaCorriente" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "saldo_resultante" DECIMAL(14,2) NOT NULL,
    "referencia_tipo" "ReferenciaCuentaCorriente" NOT NULL DEFAULT 'manual',
    "referencia_id" TEXT,
    "observacion" TEXT,

    CONSTRAINT "movimiento_cuenta_corriente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "turno_fecha_idx" ON "turno"("fecha");

-- CreateIndex
CREATE INDEX "turno_estado_idx" ON "turno"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_movimiento_nombre_key" ON "categoria_movimiento"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_movimiento_slug_key" ON "categoria_movimiento"("slug");

-- CreateIndex
CREATE INDEX "movimiento_caja_fecha_tipo_idx" ON "movimiento_caja"("fecha", "tipo");

-- CreateIndex
CREATE INDEX "movimiento_caja_turno_id_idx" ON "movimiento_caja"("turno_id");

-- CreateIndex
CREATE INDEX "movimiento_caja_categoria_id_idx" ON "movimiento_caja"("categoria_id");

-- CreateIndex
CREATE INDEX "movimiento_caja_referencia_tipo_referencia_id_idx" ON "movimiento_caja"("referencia_tipo", "referencia_id");

-- CreateIndex
CREATE INDEX "cheque_estado_fecha_vencimiento_idx" ON "cheque"("estado", "fecha_vencimiento");

-- CreateIndex
CREATE INDEX "cheque_fecha_entrega_idx" ON "cheque"("fecha_entrega");

-- CreateIndex
CREATE INDEX "cheque_librador_idx" ON "cheque"("librador");

-- CreateIndex
CREATE INDEX "cheque_vendedor_cheque_id_idx" ON "cheque"("vendedor_cheque_id");

-- CreateIndex
CREATE UNIQUE INDEX "cheque_banco_numero_librador_key" ON "cheque"("banco", "numero", "librador");

-- CreateIndex
CREATE INDEX "imputacion_cheque_factura_proveedor_id_idx" ON "imputacion_cheque"("factura_proveedor_id");

-- CreateIndex
CREATE UNIQUE INDEX "imputacion_cheque_cheque_id_factura_proveedor_id_key" ON "imputacion_cheque"("cheque_id", "factura_proveedor_id");

-- CreateIndex
CREATE INDEX "proveedor_activo_idx" ON "proveedor"("activo");

-- CreateIndex
CREATE INDEX "factura_proveedor_proveedor_id_estado_idx" ON "factura_proveedor"("proveedor_id", "estado");

-- CreateIndex
CREATE INDEX "factura_proveedor_fecha_vencimiento_idx" ON "factura_proveedor"("fecha_vencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "factura_proveedor_proveedor_id_numero_key" ON "factura_proveedor"("proveedor_id", "numero");

-- CreateIndex
CREATE INDEX "pago_proveedor_proveedor_id_fecha_idx" ON "pago_proveedor"("proveedor_id", "fecha");

-- CreateIndex
CREATE INDEX "pago_proveedor_cheque_id_idx" ON "pago_proveedor"("cheque_id");

-- CreateIndex
CREATE INDEX "imputacion_pago_factura_proveedor_id_idx" ON "imputacion_pago"("factura_proveedor_id");

-- CreateIndex
CREATE UNIQUE INDEX "imputacion_pago_pago_proveedor_id_factura_proveedor_id_key" ON "imputacion_pago"("pago_proveedor_id", "factura_proveedor_id");

-- CreateIndex
CREATE INDEX "cliente_nombre_idx" ON "cliente"("nombre");

-- CreateIndex
CREATE INDEX "cliente_activo_idx" ON "cliente"("activo");

-- CreateIndex
CREATE INDEX "movimiento_cuenta_corriente_cliente_id_fecha_idx" ON "movimiento_cuenta_corriente"("cliente_id", "fecha");

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria_movimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheque" ADD CONSTRAINT "cheque_vendedor_cheque_id_fkey" FOREIGN KEY ("vendedor_cheque_id") REFERENCES "vendedor_cheque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheque" ADD CONSTRAINT "cheque_proveedor_destino_id_fkey" FOREIGN KEY ("proveedor_destino_id") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputacion_cheque" ADD CONSTRAINT "imputacion_cheque_cheque_id_fkey" FOREIGN KEY ("cheque_id") REFERENCES "cheque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputacion_cheque" ADD CONSTRAINT "imputacion_cheque_factura_proveedor_id_fkey" FOREIGN KEY ("factura_proveedor_id") REFERENCES "factura_proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_proveedor" ADD CONSTRAINT "factura_proveedor_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_proveedor" ADD CONSTRAINT "pago_proveedor_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_proveedor" ADD CONSTRAINT "pago_proveedor_cheque_id_fkey" FOREIGN KEY ("cheque_id") REFERENCES "cheque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputacion_pago" ADD CONSTRAINT "imputacion_pago_pago_proveedor_id_fkey" FOREIGN KEY ("pago_proveedor_id") REFERENCES "pago_proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputacion_pago" ADD CONSTRAINT "imputacion_pago_factura_proveedor_id_fkey" FOREIGN KEY ("factura_proveedor_id") REFERENCES "factura_proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_cuenta_corriente" ADD CONSTRAINT "movimiento_cuenta_corriente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Invariantes escritas a mano: Prisma no las expresa en el schema.
-- Son la última línea de defensa. La capa de dominio valida antes y da mensajes
-- útiles; estas garantizan que ningún camino (seed, script, consola) las rompa.
-- ---------------------------------------------------------------------------

-- §4.1 "No permitir dos turnos abiertos en simultáneo".
-- Índice único parcial: solo puede existir una fila con estado = 'abierto'.
CREATE UNIQUE INDEX "turno_unico_abierto" ON "turno" ("estado") WHERE "estado" = 'abierto';

-- Un turno cerrado tiene que tener fecha de cierre.
ALTER TABLE "turno" ADD CONSTRAINT "turno_cierre_coherente"
  CHECK ("estado" <> 'cerrado' OR "fecha_cierre" IS NOT NULL);

-- §3.1 El monto de un movimiento de caja es siempre positivo; el signo lo da `tipo`.
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_monto_positivo"
  CHECK ("monto" > 0);

-- La categoría tiene que ser del mismo tipo que el movimiento: un egreso no puede
-- llevar una categoría de ingreso. Postgres no permite subconsultas en un CHECK,
-- así que va como trigger.
CREATE OR REPLACE FUNCTION "movimiento_caja_valida_categoria"() RETURNS TRIGGER AS $$
DECLARE
  tipo_categoria "TipoMovimientoCaja";
BEGIN
  SELECT "tipo" INTO tipo_categoria FROM "categoria_movimiento" WHERE "id" = NEW."categoria_id";
  IF tipo_categoria IS DISTINCT FROM NEW."tipo" THEN
    RAISE EXCEPTION 'La categoría % es de tipo %, no coincide con el movimiento de tipo %',
      NEW."categoria_id", tipo_categoria, NEW."tipo";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "movimiento_caja_valida_categoria_trg"
  BEFORE INSERT OR UPDATE OF "tipo", "categoria_id" ON "movimiento_caja"
  FOR EACH ROW EXECUTE FUNCTION "movimiento_caja_valida_categoria"();

-- §3.2 Coherencia del cheque.
-- El ahorro es exactamente la diferencia: si esto falla, un reporte de ahorro miente.
ALTER TABLE "cheque" ADD CONSTRAINT "cheque_montos_coherentes"
  CHECK (
    "nominal" > 0
    AND "porcentaje_descuento" >= 0 AND "porcentaje_descuento" < 100
    AND "monto_pagado" > 0 AND "monto_pagado" <= "nominal"
    AND "ahorro" = "nominal" - "monto_pagado"
  );

-- La entrega es atómica: o están la fecha y el proveedor destino, o no está ninguno.
ALTER TABLE "cheque" ADD CONSTRAINT "cheque_entrega_atomica"
  CHECK (("fecha_entrega" IS NULL) = ("proveedor_destino_id" IS NULL));

-- Un cheque en cartera no fue entregado; uno entregado sí.
-- 'rechazado' queda libre a propósito: el rechazo puede llegar en cualquier momento.
ALTER TABLE "cheque" ADD CONSTRAINT "cheque_estado_coherente"
  CHECK (
    ("estado" <> 'en_cartera' OR "fecha_entrega" IS NULL)
    AND ("estado" <> 'entregado' OR "fecha_entrega" IS NOT NULL)
  );

-- Un rechazo registrado tiene fecha (§4.4).
ALTER TABLE "cheque" ADD CONSTRAINT "cheque_rechazo_coherente"
  CHECK ("estado" <> 'rechazado' OR "fecha_rechazo" IS NOT NULL);

-- §3.3 Facturas. El saldo pendiente nunca es negativo: el excedente de un pago
-- va a proveedor.saldo, no acá.
ALTER TABLE "factura_proveedor" ADD CONSTRAINT "factura_saldo_coherente"
  CHECK (
    "monto_total" > 0
    AND "saldo_pendiente" >= 0
    AND "saldo_pendiente" <= "monto_total"
  );

-- El estado se deduce del saldo pendiente y no puede contradecirlo.
ALTER TABLE "factura_proveedor" ADD CONSTRAINT "factura_estado_coherente"
  CHECK (
    ("estado" = 'pagada' AND "saldo_pendiente" = 0)
    OR ("estado" = 'pendiente' AND "saldo_pendiente" = "monto_total")
    OR ("estado" = 'parcial' AND "saldo_pendiente" > 0 AND "saldo_pendiente" < "monto_total")
  );

-- §3.3 cheque_id está presente si y solo si el medio es cheque.
ALTER TABLE "pago_proveedor" ADD CONSTRAINT "pago_medio_coherente"
  CHECK ("monto" > 0 AND (("medio" = 'cheque') = ("cheque_id" IS NOT NULL)));

-- Imputar cero o negativo no tiene sentido en ninguno de los dos flujos.
ALTER TABLE "imputacion_cheque" ADD CONSTRAINT "imputacion_cheque_monto_positivo"
  CHECK ("monto_imputado" > 0);

ALTER TABLE "imputacion_pago" ADD CONSTRAINT "imputacion_pago_monto_positivo"
  CHECK ("monto_imputado" > 0);

-- §3.4 Cuenta corriente.
ALTER TABLE "movimiento_cuenta_corriente" ADD CONSTRAINT "movimiento_cc_monto_positivo"
  CHECK ("monto" > 0);

ALTER TABLE "cliente" ADD CONSTRAINT "cliente_limite_credito_no_negativo"
  CHECK ("limite_credito" IS NULL OR "limite_credito" >= 0);

-- NOTA: la invariante `Σ imputaciones ≤ cheque.nominal` (§4.3) es una restricción
-- entre filas y no se puede expresar con un CHECK. Vive en la capa de dominio,
-- dentro de la $transaction de la entrega. Ver src/domain/cheques/entrega.service.ts
