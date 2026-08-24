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
- ~~`usuario_id` sigue omitido de los modelos~~. **Resuelto el 22/08/2026**: ver
  "Usuarios y permisos" más abajo. Los movimientos de caja, los de cuenta
  corriente y los turnos guardan quién los cargó.


## Usuarios y permisos — hecho el 22/08/2026

Fuera de la especificación original y del alcance firmado: se agregó porque el
local pasa a trabajar con empleados. Da vuelta dos decisiones que estaban
documentadas como cerradas —"un único usuario compartido entre los dos socios" y
"el login está fuera del alcance"—, así que **hay que llevarlo a la hoja de
alcance y al número antes de facturar**.

Qué quedó andando:

- Ingreso con usuario y contraseña. Sin cuentas de fábrica: la primera la crea
  quien instala, en la pantalla de primer arranque, y elige él la contraseña.
- Permisos por sección y acción (ver / cargar / anular), más "abrir y cerrar
  turno", "configurar usuarios" y "administrar". Los roles —dueño, administrador,
  empleado— son plantillas que marcan los checkboxes al crear; después manda la
  lista de permisos de cada persona.
- **El administrador es la cuenta técnica y el dueño no sabe que existe.** Sin
  `usuarios.administrar` no se listan las cuentas con rol admin, el rol no
  aparece en ningún selector, el permiso no se dibuja en la grilla, y abrir esa
  ficha por URL da el mismo 404 que una cuenta inexistente —un "no tenés permiso"
  confirmaría que ahí hay algo—. El dueño crea, edita, restablece contraseñas y da
  de baja; **borrar** es solo del administrador.
- **Baja y borrado son cosas distintas.** La baja conserva la cuenta y la
  autoría; el borrado la elimina y deja sus movimientos sin autor, con el mismo
  guion que lo anterior a los usuarios (`onDelete: SetNull`). El borrado pide
  escribir el nombre de ingreso para confirmar.
- No se puede quedar sin la última cuenta activa con `usuarios.configurar` ni sin
  la última con `usuarios.administrar`. La segunda es la grave: sin ella nadie
  puede recrear la cuenta técnica desde adentro, porque quien queda no ve ni el
  rol ni el permiso.

**Límite conocido de la discreción del rol admin.** Ocultarlo no lo hace
indetectable: si una cuenta de administrador carga un movimiento, su nombre
aparece en la columna "cargó" de la caja como el de cualquiera. Lo que se esconde
son las pantallas de usuarios, no el rastro de lo que hizo. Falsearlo sería
mentir en el registro contable, que es lo único que este sistema no puede hacer.
- Las sesiones viven en la base y **no expiran**: es una decisión tomada, para no
  interrumpir el mostrador. La contrapartida es que el autor de un movimiento
  dice quién estaba logueado, no necesariamente quién tipeó. Por eso el nombre
  está siempre visible en la barra lateral con "Salir" al lado.
- Las cuentas no se borran, se dan de baja.

Lo que falta de este módulo:

- **Ocultar los formularios de carga según permiso en cheques, proveedores y
  clientes.** Hoy solo está hecho en caja. En las otras tres, alguien sin permiso
  de cargar ve el formulario y recibe el error al enviarlo. No es un agujero de
  seguridad —la Server Action lo rechaza igual— pero es un botón que siempre
  falla.
- **Columna "cargó" en las demás pantallas.** Solo la tabla de movimientos del
  turno muestra el autor.
- Sin registro de auditoría aparte: se sabe quién cargó cada cosa, no quién la
  miró ni quién cambió permisos.

## Prioridad 2 (anulación): cómo cambia con los usuarios

El permiso `<seccion>.anular` ya existe y ya se exige — hoy lo usa una sola
acción, `revertirEntregaCheque`, que es la única corrección que hay en el
sistema. Cuando se implemente la anulación del resto (movimiento de caja, retiro,
factura, pago en efectivo, fiado, cobro, compra de cheque), cada una entra por
`exigirPermiso("<seccion>.anular")` y ya queda restringida a quien corresponda,
sin tocar el módulo de usuarios.
