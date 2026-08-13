-- Los montos pasan de NUMERIC(14,2) a NUMERIC(14,0): la moneda es el peso
-- argentino y no se usan centavos (AGENTS.md). El único campo con decimales que
-- queda es porcentaje_descuento, que no es un monto.
--
-- POR QUÉ trunc() Y NO EL CASTEO POR DEFECTO: Postgres, al castear NUMERIC(14,2)
-- a NUMERIC(14,0), redondea al más cercano. Eso contradice la regla —el resto va
-- siempre a favor de la verdulería, que paga de menos— y además puede subir un
-- monto por encima de un tope que otro CHECK exige respetar.
--
-- Los tres montos del cheque se alteran en UNA sola sentencia a propósito: cada
-- USING se evalúa sobre los valores viejos, así que el ahorro se recalcula desde
-- el nominal y el pagado ya truncados y la identidad del CHECK
-- `ahorro = nominal - monto_pagado` no se rompe en el camino.

ALTER TABLE "cheque"
  ALTER COLUMN "nominal"      TYPE NUMERIC(14,0) USING trunc("nominal"),
  ALTER COLUMN "monto_pagado" TYPE NUMERIC(14,0) USING trunc("monto_pagado"),
  ALTER COLUMN "ahorro"       TYPE NUMERIC(14,0) USING trunc("nominal") - trunc("monto_pagado");

-- Igual que arriba: total y saldo en una sentencia, para que el saldo nunca quede
-- por encima del total mientras Postgres valida `saldo_pendiente <= monto_total`.
ALTER TABLE "factura_proveedor"
  ALTER COLUMN "monto_total"     TYPE NUMERIC(14,0) USING trunc("monto_total"),
  ALTER COLUMN "saldo_pendiente" TYPE NUMERIC(14,0) USING trunc("saldo_pendiente");

ALTER TABLE "movimiento_caja"
  ALTER COLUMN "monto" TYPE NUMERIC(14,0) USING trunc("monto");

ALTER TABLE "imputacion_cheque"
  ALTER COLUMN "monto_imputado" TYPE NUMERIC(14,0) USING trunc("monto_imputado");

ALTER TABLE "imputacion_pago"
  ALTER COLUMN "monto_imputado" TYPE NUMERIC(14,0) USING trunc("monto_imputado");

ALTER TABLE "pago_proveedor"
  ALTER COLUMN "monto" TYPE NUMERIC(14,0) USING trunc("monto");

ALTER TABLE "proveedor"
  ALTER COLUMN "saldo" TYPE NUMERIC(14,0) USING trunc("saldo"),
  ALTER COLUMN "saldo" SET DEFAULT 0;

ALTER TABLE "cliente"
  ALTER COLUMN "limite_credito" TYPE NUMERIC(14,0) USING trunc("limite_credito"),
  ALTER COLUMN "saldo"          TYPE NUMERIC(14,0) USING trunc("saldo"),
  ALTER COLUMN "saldo"          SET DEFAULT 0;

-- El saldo de una cuenta corriente puede ser negativo, y ahí trunc() va hacia
-- CERO, no hacia abajo. Es lo correcto para este caso: el saldo es deuda del
-- cliente, y truncar hacia cero nunca le agranda lo que debe por el redondeo.
ALTER TABLE "movimiento_cuenta_corriente"
  ALTER COLUMN "monto"            TYPE NUMERIC(14,0) USING trunc("monto"),
  ALTER COLUMN "saldo_resultante" TYPE NUMERIC(14,0) USING trunc("saldo_resultante");
