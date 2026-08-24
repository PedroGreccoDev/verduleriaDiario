-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('dueno', 'admin', 'empleado');

-- AlterTable
ALTER TABLE "movimiento_caja" ADD COLUMN     "usuario_id" TEXT;

-- AlterTable
ALTER TABLE "movimiento_cuenta_corriente" ADD COLUMN     "usuario_id" TEXT;

-- AlterTable
ALTER TABLE "turno" ADD COLUMN     "usuario_id" TEXT;

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "hash_contrasena" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "debe_cambiar_contrasena" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permiso_usuario" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "permiso" TEXT NOT NULL,

    CONSTRAINT "permiso_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion_usuario" (
    "id" TEXT NOT NULL,
    "hash_token" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_acceso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesion_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_usuario_key" ON "usuario"("usuario");

-- CreateIndex
CREATE INDEX "usuario_activo_idx" ON "usuario"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_usuario_usuario_id_permiso_key" ON "permiso_usuario"("usuario_id", "permiso");

-- CreateIndex
CREATE UNIQUE INDEX "sesion_usuario_hash_token_key" ON "sesion_usuario"("hash_token");

-- CreateIndex
CREATE INDEX "sesion_usuario_usuario_id_idx" ON "sesion_usuario"("usuario_id");

-- CreateIndex
CREATE INDEX "movimiento_caja_usuario_id_idx" ON "movimiento_caja"("usuario_id");

-- CreateIndex
CREATE INDEX "movimiento_cuenta_corriente_usuario_id_idx" ON "movimiento_cuenta_corriente"("usuario_id");

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_cuenta_corriente" ADD CONSTRAINT "movimiento_cuenta_corriente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permiso_usuario" ADD CONSTRAINT "permiso_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion_usuario" ADD CONSTRAINT "sesion_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
