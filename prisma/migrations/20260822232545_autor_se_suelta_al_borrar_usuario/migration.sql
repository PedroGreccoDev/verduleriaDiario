-- DropForeignKey
ALTER TABLE "movimiento_caja" DROP CONSTRAINT "movimiento_caja_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "movimiento_cuenta_corriente" DROP CONSTRAINT "movimiento_cuenta_corriente_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "turno" DROP CONSTRAINT "turno_usuario_id_fkey";

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_cuenta_corriente" ADD CONSTRAINT "movimiento_cuenta_corriente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
