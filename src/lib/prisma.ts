import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@/generated/prisma/client";

/**
 * Prisma 7 no lee DATABASE_URL por su cuenta: hay que pasarle un driver adapter
 * con la connection string. Por eso la URL se resuelve acá y no en el schema
 * (el bloque `datasource` de schema.prisma ya no lleva `url`).
 */
export function crearPrismaClient(connectionString?: string): PrismaClient {
  const url = connectionString ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. Si el Postgres local está parado: npx prisma dev start -n verduleria-dev",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * Cliente global como singleton.
 *
 * En desarrollo Next.js recarga los módulos en caliente; sin el singleton cada
 * recarga abriría un pool nuevo y Postgres terminaría rechazando conexiones.
 *
 * La construcción es perezosa, y no es un detalle de estilo: si el cliente se
 * creara al evaluar el módulo, leería DATABASE_URL antes de que nadie haya podido
 * cargarla. Los tests importan `crearPrismaClient` desde acá y recién después
 * llaman a dotenv; con inicialización ansiosa, ese import solo revienta.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function obtenerClienteGlobal(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = crearPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(obtenerClienteGlobal(), prop, receiver);
  },
});

/**
 * Cliente dentro de una transacción.
 *
 * Los servicios de dominio reciben esto en lugar del cliente completo, para poder
 * componerse: un flujo que ya abrió su `$transaction` le pasa el `tx` a los
 * servicios que llama, en vez de abrir transacciones anidadas — que en Postgres
 * no serían atómicas entre sí.
 */
export type PrismaTx = Prisma.TransactionClient;
