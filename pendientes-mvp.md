# Pendientes para cerrar el MVP

Lo que falta en el código para poder decir que el sistema está entregable, contra
la hoja de alcance —que se lleva aparte, fuera del repo— y la especificación. **No incluye** nada de
alojamiento, empaquetado, instalador ni backup: solo funciones.

Relevado el 21/08/2026. Estado del repo a esa fecha: el dominio de §4 está
completo y las cinco pantallas (caja, cheques, proveedores, clientes, reportes)
existen y funcionan.

## Prioridad 1 — Alta de proveedores y de vendedores de cheques

Hoy solo se crean en `prisma/seed.ts` (`prisma/seed.ts:84` y `prisma/seed.ts:160`).
`proveedoresActivos()` y `vendedoresActivos()` en `src/domain/cheques/consultas.ts`
únicamente leen. Clientes sí tiene alta y sirve de modelo:
`src/domain/clientes/cliente.service.ts:21` con `FormularioCliente`.

El día que la verdulería le compre a un proveedor nuevo o a una financiera nueva,
hay que abrir la base a mano. Es el hueco más corto de tapar y el que desbloquea
el uso real.

## Prioridad 2 — Corrección y anulación de lo mal cargado

La única corrección que existe en todo el sistema es `revertirEntregaCheque`
(§4.3). No hay forma de anular ni editar:

- movimiento de caja o retiro mal tipeado
- factura de proveedor con monto o fecha equivocada
- pago en efectivo a proveedor
- fiado o cobro a cliente
- compra de cheque con nominal o porcentaje errado

Toda entrada es manual (§2.4) y la carga una persona apurada en el mostrador. Un
sistema de carga manual sin "deshacer" no sobrevive la primera semana: el operador
compensa con movimientos falsos y los saldos dejan de ser auditables.

Es el ítem más caro de los tres, porque cada anulación toca saldos en varias
tablas y va en `prisma.$transaction()` igual que el alta. **No está contemplado en el
desglose de días del anexo interno de la hoja de alcance**, que asume que lo
pendiente es la pantalla de clientes y los reportes —ambos ya hechos—. Agregarlo
ahí antes de cerrar el número.

## Prioridad 3 — Carga de saldos iniciales

El punto D de la reunión de definiciones (proveedores, clientes y saldos al
arrancar) no tiene por dónde entrar. Hoy, para que un proveedor arranque debiendo
hay que cargarle una factura inventada, y para que un cliente arranque debiendo
hay que fiarle algo que no se llevó.

Hace falta un movimiento de apertura explícito y marcado como tal, para que el
primer reporte de ingresos y egresos no muestre plata que nunca se movió.

## Después de esos tres — deuda contra la hoja de alcance

No bloquean el uso diario, pero están comprometidos en el entregable 5.

**Reportes de la rama cheques (§5.2).** El dominio ya está en
`src/domain/cheques/cartera.ts`; falta pantalla.

- Estado de cartera: hecho, en `/cheques`.
- Ahorro por cheques: `/cheques/entregas` lista las últimas 50 entregas, **sin
  filtro de período ni total del período**. El entregable dice "por período".
- Rechazos por librador y por vendedor: `historialRechazos()` no tiene pantalla.

**Reportes de cuentas (§5.3).** `/clientes` cubre deudores con antigüedad.
Verificar que `/proveedores` muestre facturas pendientes y vencimientos próximos,
que es la otra mitad del punto.

## Menores anotados, no bloquean

- `reporteIngresosEgresos` trae todos los movimientos del período sin paginar. Con
  preset "Año" y unos meses de uso, es una tabla de miles de filas en la PC del local.
- Falta el filtro por turno en §5.1 (la spec lo lista como sugerido, no obligatorio).
- No hay ABM de categorías de movimiento: solo las de `sembrarCategoriasSistema`.
- `usuario_id` sigue omitido de los modelos, así que ningún movimiento dice quién
  lo cargó. Es correcto —el login está explícitamente fuera del alcance—, pero es
  justo lo que se quiere saber cuando falta plata en la Bolsa Grande. Confirmarlo
  por escrito con el cliente antes de instalar, no después.
