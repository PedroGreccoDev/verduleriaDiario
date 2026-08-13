-- §8.2 resuelto: el estado `acreditado` sobra. La verdulería no hace seguimiento
-- de si el proveedor cobró el cheque; para ellos termina en `entregado`. Lo único
-- que puede pasar después es que rebote, y para eso está `rechazado`.
--
-- Postgres no permite quitar un valor de un enum, así que se recrea el tipo.
--
-- Los dos CHECK de `cheque` se borran antes y se recrean después: comparan el
-- estado contra literales que quedan ligados al tipo VIEJO, y sin sacarlos el
-- ALTER falla con "operator does not exist: EstadoCheque_nuevo <> EstadoCheque".
-- Se recrean idénticos a los de la migración inicial.
-- Los DROP van con IF EXISTS porque Postgres NO revierte un CREATE TYPE fallido a
-- mitad de esta migración: si un intento anterior se cortó, el tipo temporal y la
-- ausencia de los constraints ya quedaron en la base. Así se puede volver a correr.
ALTER TABLE "cheque" DROP CONSTRAINT IF EXISTS "cheque_estado_coherente";
ALTER TABLE "cheque" DROP CONSTRAINT IF EXISTS "cheque_rechazo_coherente";

ALTER TABLE "cheque" ALTER COLUMN "estado" DROP DEFAULT;

DROP TYPE IF EXISTS "EstadoCheque_nuevo";
CREATE TYPE "EstadoCheque_nuevo" AS ENUM ('en_cartera', 'entregado', 'rechazado');

-- No hay filas que migrar —el valor nunca se usó— pero el CASE queda explícito por
-- si esta migración corre sobre una base donde alguien lo hubiera escrito a mano:
-- un cheque acreditado es, para este modelo, uno entregado.
ALTER TABLE "cheque"
  ALTER COLUMN "estado" TYPE "EstadoCheque_nuevo"
  USING (
    CASE "estado"::text
      WHEN 'acreditado' THEN 'entregado'
      ELSE "estado"::text
    END
  )::"EstadoCheque_nuevo";

DROP TYPE "EstadoCheque";
ALTER TYPE "EstadoCheque_nuevo" RENAME TO "EstadoCheque";

ALTER TABLE "cheque" ALTER COLUMN "estado" SET DEFAULT 'en_cartera';

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
