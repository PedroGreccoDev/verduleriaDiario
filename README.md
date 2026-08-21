# Estación Verde — Módulo Diario

Sistema de gestión administrativa para una verdulería. Cubre caja por turno,
cheques de terceros, cuentas de proveedores y cuenta corriente de clientes.

**No es un POS y no registra ventas.** Los reportes hablan de flujo de caja, no de
facturación. Toda entrada de datos es manual. Ver `especificacion-modulo-diario.md`,
que es la fuente de verdad funcional; los `§` que aparecen en los comentarios del
código refieren a sus secciones.

## Estado

Dominio completo de §4 y las cinco pantallas: caja, cheques, proveedores, clientes
y el reporte de ingresos y egresos de §5.1.

Lo que falta para poder entregar está en `pendientes-mvp.md`, por prioridad. Los
tres bloqueantes son: alta de proveedores y de vendedores de cheques (hoy solo se
crean en el seed), corrección o anulación de lo mal cargado (solo existe revertir
una entrega de cheque), y carga de saldos iniciales.

## Puesta en marcha

```bash
npm install

# Postgres local, dos servidores separados (ver "Bases de datos")
npx prisma dev start verduleria-dev --detach
npx prisma dev start verduleria-test --detach

cp .env.example .env      # y ajustar los puertos que haya asignado prisma dev
npm run db:deploy         # aplica migraciones
npm run db:seed           # datos de prueba
npm test
```

Si tras reiniciar la máquina falla la conexión, los servidores están parados:

```bash
npx prisma dev start verduleria-dev --detach
npx prisma dev start verduleria-test --detach
```

## Bases de datos

Son **dos servidores** de `prisma dev`, no dos bases de uno solo. Un servidor de
`prisma dev` sirve una única base: el nombre que va en la URL es decorativo y
conectarse a cualquier nombre devuelve la misma base. Si dev y test compartieran
servidor, la suite de tests —que trunca todas las tablas antes de cada test—
borraría los datos de desarrollo.

`SHADOW_DATABASE_URL` no es opcional. Prisma necesita una base descartable para
calcular el diff de cada migración; si no se le indica cuál, la crea en el mismo
servidor que `DATABASE_URL` y **aplica la migración sobre la base real creyendo que
es descartable**. Cada servidor de `prisma dev` levanta un store shadow vacío en el
puerto siguiente al de la base.

## Estructura

```
prisma/
  schema.prisma          modelo de datos (§3)
  migrations/            incluye CHECKs y triggers escritos a mano
  seed.ts                datos de prueba, vía servicios de dominio
src/
  lib/                   prisma, decimal, fechas, errores
  domain/
    caja/                turnos, retiros, movimientos de la Bolsa Grande (§4.1)
                         y los rangos y totales del reporte (§5.1)
    cheques/             compra, entrega, rechazo, cartera y ahorro (§4.2–4.4)
    proveedores/         facturas, pagos en efectivo, imputación (§4.5)
    clientes/            cuenta corriente / fiado
  app/
    caja/                apertura, retiros y cierre del turno
    cheques/             cartera, compra, entrega e historial
    proveedores/         cuentas, alta de factura y pago en efectivo
    reportes/            ingresos y egresos (§5.1)
tests/
  invariantes-base.test.ts  que las restricciones de la migración muerden
  domain/                   los cinco flujos de §4, más períodos y reporte
```

Las Server Actions viven en el `actions.ts` de cada sección y son una capa fina:
parsean el formulario, llaman al dominio y traducen el error. Ninguna validación de
negocio vive ahí.

## Las reglas que no se rompen

Están en los comentarios del código, pero conviene tenerlas juntas:

**Bolsa Grande y cartera de cheques son saldos separados.** Efectivo y valor
nominal. Nunca se suman en un mismo total.

**Comprar un cheque no genera ahorro.** Genera egreso de efectivo por lo pagado e
ingreso de nominal a la cartera. Nominal $1.000 al 10% → salen $900 de la caja.

**El ahorro se realiza en la entrega, y nunca es un movimiento de caja.** Es un
menor egreso: se cancelan $1.000 de deuda habiendo gastado $900. Por eso no existe
como registro — se deriva de `cheque.ahorro` sobre los entregados, agrupado por
`fecha_entrega`. Al no tener tabla propia, no puede colarse en el reporte de caja.

**Un cheque rechazado no revierte nada.** Lo levanta el vendedor. No se reabre la
deuda, no hay egreso, no se revierte el ahorro. Solo queda el registro.

**El saldo de proveedor puede ser negativo.** Es saldo a favor y se descuenta solo
de la próxima factura. No hay rama especial para el excedente.

**Todos los montos son `Decimal`.** Nunca `Float`. Para construirlos, `dec("1234.56")`
con string, no con number.

**Todo lo que mueve saldo en más de una tabla va en `prisma.$transaction()`.**

## Despliegue

Railway, desde GitHub. `railway.json` ya trae `prisma migrate deploy` como
pre-deploy command, para que las migraciones corran antes de que la versión nueva
reciba tráfico. Variables a cargar: las de `.env.example`.

Usar entornos separados para staging y producción, con base propia cada uno.

## Pendientes de §8: resueltos

Los cinco quedaron cerrados el 13/08/2026. El detalle y el porqué de cada uno
están en §8 de la especificación.

1. **Vencimiento en cartera:** no se modela; los cheques nunca llegan a vencer sin entregarse.
2. **Estado `acreditado`:** eliminado. El cheque termina en `entregado`.
3. **Límite de crédito:** no hay. La columna `limite_credito` se eliminó.
4. **Turnos:** dos por día, uno solo los domingos y feriados. El sistema lo sugiere, no lo impone.
5. **Moneda y redondeo:** pesos enteros, sin centavos, y el monto pagado redondea **hacia abajo** — el resto queda a favor de la verdulería. En `src/lib/decimal.ts` y `AGENTS.md`.

### Rebote ≠ reversión de entrega

Se parecen y no lo son. **Revertir** (§4.3) es para una entrega que se cargó mal:
nunca ocurrió, así que la deuda vuelve. **Rechazar** (§4.4) es para un cheque que
rebotó: la entrega ocurrió de verdad, lo levanta quien vendió el cheque y no se
toca ningún saldo. Son mutuamente excluyentes por diseño. Ver §8.1.

Además, `usuario_id` está omitido de los modelos hasta que exista Better Auth. La
migración que lo agregue tiene que ir nullable → backfill → NOT NULL + FK.
