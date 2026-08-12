import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],

    // OBLIGATORIO con `prisma dev`, no es un detalle opcional.
    //
    // Prisma necesita una base descartable para calcular el diff de cada migración.
    // Si no se le indica cuál, la crea en el mismo servidor que DATABASE_URL — y un
    // servidor de `prisma dev` sirve UNA SOLA base: el nombre en la URL es decorativo,
    // conectarse a cualquier nombre devuelve la misma base. Resultado: Prisma aplica
    // la migración sobre la base real creyendo que es la shadow.
    //
    // Cada servidor de `prisma dev` levanta un segundo store, vacío y aislado, en el
    // puerto siguiente al de la base. Ese es el que va acá.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
