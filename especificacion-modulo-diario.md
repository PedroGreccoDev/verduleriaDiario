# Estación Verde — Módulo Diario

**Especificación funcional y técnica para desarrollo**
Versión 1.0 — Agosto 2026

---

## 1. Alcance

Este documento cubre la rama **Diario** del sistema, compuesta por cuatro secciones:

| Sección | Función |
|---|---|
| Reportes con filtros | Reportes de ingresos y egresos por período |
| Cuentas corrientes / proveedores | Deuda de clientes hacia la verdulería y de la verdulería hacia proveedores |
| Caja x turno | Control de la Bolsa Grande, con apertura y cierre por turno |
| Gestión de cheques | Compra, cartera, entrega y cálculo de ahorro de cheques de terceros |

**Fuera de alcance en esta etapa:** inventario, precios, permisos, configuración avanzada. Tampoco se modela la caja registradora (ver §2.2).

**El POS queda fuera del proyecto.** El sistema es de **gestión administrativa**, no de venta: la venta al mostrador se sigue haciendo con la caja registradora y el sistema no la registra. Es posible que se incorpore más adelante como escalabilidad, pero no forma parte de este desarrollo. Ver §2.4 para las consecuencias de diseño.

---

## 2. Conceptos base

Antes del modelo de datos hay tres conceptos que atraviesan todo el módulo. Si estos quedan claros, el resto se deduce solo.

### 2.1 Dos saldos paralelos

El sistema lleva **dos depósitos de valor independientes**:

- **Bolsa Grande** — efectivo real. Se mide en pesos.
- **Cartera de cheques** — cheques de terceros en poder de la verdulería. Se mide en **valor nominal**, no en lo que se pagó por ellos.

No son intercambiables ni se suman en un mismo total. Un reporte de caja habla de la Bolsa Grande; el estado de la cartera es una vista aparte.

### 2.2 La caja controlada es la Bolsa Grande, no la registradora

Durante el turno el efectivo se acumula en la caja registradora, que **el sistema no conoce**. Cuando el turno cierra (o cuando hay demasiado efectivo acumulado), se emite un **retiro** y ese dinero se carga como **ingreso a la Bolsa Grande**.

Consecuencia a tener presente: el sistema no puede hacer arqueo de la registradora ni detectar faltantes de mostrador. Es una decisión consciente para esta etapa. Si más adelante se quiere incorporar, el retiro pasa de ser un ingreso a ser una transferencia entre dos cajas, y el modelo actual lo soporta sin rehacerse.

### 2.3 Comprar un cheque es una conversión, no un gasto

Al comprar un cheque de terceros:

- **Sale** efectivo de la Bolsa Grande por el monto pagado.
- **Entra** valor nominal a la cartera — un monto **mayor** al que salió.

Esa diferencia queda **latente**. No es ganancia todavía: es un cheque que puede rebotar, vencer o no llegar a usarse. El ahorro se **realiza recién en la entrega** al proveedor, porque ahí el nominal se convierte efectivamente en cancelación de deuda.

Punto crítico para reportes: **el ahorro nunca aparece como movimiento de la Bolsa Grande.** No es plata que entra. Es un menor egreso futuro. Va en un reporte propio, separado del de ingresos/egresos.

### 2.4 Sin POS: toda entrada de datos es manual

El sistema no registra ventas. Eso tiene tres consecuencias que conviene tener presentes desde el diseño:

- **La Bolsa Grande se alimenta de retiros cargados a mano.** El sistema no sabe cuánto se vendió, solo cuánto efectivo se depositó. La confiabilidad del reporte depende enteramente de que carguen los retiros.
- **La cuenta corriente de clientes se carga a mano.** No hay venta que dispare el cargo automático: alguien tiene que registrar el fiado cuando ocurre. La carga tiene que ser rápida — pocos campos, cliente buscable por nombre — o no la van a usar.
- **Ninguna cifra del sistema representa facturación.** Los reportes hablan de flujo de caja, no de ventas. Importante para no malinterpretar los números en la reunión con el socio.

Como el POS es una posible extensión futura, la tabla `movimiento_cuenta_corriente` ya prevé `referencia_tipo = 'venta'`. Hoy ese valor no se usa, pero deja la puerta abierta sin costo.

---

## 3. Modelo de datos

### 3.1 Caja / Bolsa Grande

```
turno
  id
  fecha
  nombre              -- 'mañana' | 'tarde'
  estado              -- 'abierto' | 'cerrado'
  fecha_apertura
  fecha_cierre
  usuario_id
  observacion

movimiento_caja
  id
  fecha
  turno_id            -- FK turno (nullable: puede haber movimientos fuera de turno)
  tipo                -- 'ingreso' | 'egreso'
  categoria           -- ver tabla de categorías abajo
  monto               -- siempre positivo; el signo lo da 'tipo'
  referencia_tipo     -- 'retiro_turno' | 'compra_cheque' | 'pago_proveedor' | 'cobro_cliente' | 'gasto' | 'retiro_socio' | 'manual'
  referencia_id       -- FK polimórfica al registro que originó el movimiento
  usuario_id
  observacion
```

**Categorías de movimiento (valores iniciales):**

| Tipo | Categoría | Origen |
|---|---|---|
| Ingreso | Retiro de turno | Cierre de turno / retiro parcial |
| Ingreso | Cobro cuenta corriente | Cliente paga su fiado |
| Ingreso | Aporte de socio | Manual |
| Egreso | Compra de cheques | Compra a vendedor de cheques |
| Egreso | Pago a proveedor en efectivo | Pago sin cheque |
| Egreso | Gasto operativo | Manual |
| Egreso | Retiro de socio | Manual |

> Conviene que las categorías sean una tabla y no un `enum` en código: van a querer agregar más sin tocar el sistema.

### 3.2 Cheques

```
vendedor_cheque
  id
  nombre
  contacto
  activo

cheque
  id
  numero
  banco
  librador
  nominal                    -- valor de cara del cheque
  porcentaje_descuento       -- lo que tipea el operador
  monto_pagado               -- CALCULADO: nominal * (1 - porcentaje_descuento/100)
  fecha_compra
  fecha_vencimiento
  vendedor_cheque_id         -- FK vendedor_cheque
  estado                     -- 'en_cartera' | 'entregado' | 'acreditado' | 'rechazado'
  fecha_entrega              -- null hasta la entrega
  proveedor_destino_id       -- FK proveedor, null hasta la entrega
  ahorro                     -- CALCULADO: nominal - monto_pagado
  observacion

imputacion_cheque
  id
  cheque_id                  -- FK cheque
  factura_proveedor_id       -- FK factura_proveedor
  monto_imputado
```

**Sobre `monto_pagado` y `ahorro`:** el operador tipea **nominal + porcentaje**. El sistema calcula y **muestra en pantalla** el monto pagado antes de confirmar, para que pueda verificarlo. Guardar los tres campos (no solo dos) evita problemas de redondeo al recalcular históricos.

**Sobre `imputacion_cheque`:** es la tabla que resuelve que un cheque cubra varias facturas. No poner un campo `factura_id` en `cheque` — no alcanza.

### 3.3 Proveedores

```
proveedor
  id
  nombre
  contacto
  saldo                      -- positivo = se le debe; NEGATIVO = saldo a favor
  activo

factura_proveedor
  id
  proveedor_id
  numero
  fecha
  fecha_vencimiento
  monto_total
  saldo_pendiente
  estado                     -- 'pendiente' | 'parcial' | 'pagada'

pago_proveedor
  id
  proveedor_id
  fecha
  medio                      -- 'efectivo' | 'cheque' | 'transferencia'
  monto
  cheque_id                  -- FK cheque, si medio = 'cheque'
```

**El campo `saldo` admite valores negativos por diseño.** Cuando un cheque tiene nominal mayor a la deuda imputada, el excedente queda como saldo a favor y debe descontarse automáticamente de la próxima factura. Tratar el sobrante como un caso aparte complica el código sin necesidad.

### 3.4 Clientes (cuenta corriente / fiado)

```
cliente
  id
  nombre
  telefono
  limite_credito             -- 0 o null = sin límite
  saldo                      -- positivo = debe
  activo

movimiento_cuenta_corriente
  id
  cliente_id
  fecha
  tipo                       -- 'cargo' | 'pago'
  monto
  saldo_resultante           -- snapshot para auditoría
  referencia_tipo            -- 'manual' | 'pago' | 'ajuste' | 'venta' (reservado, sin uso hoy)
  referencia_id
  usuario_id
```

Guardar `saldo_resultante` en cada movimiento permite reconstruir el estado de cuenta a cualquier fecha sin recalcular toda la historia.

---

## 4. Flujos

### 4.1 Apertura y cierre de turno

1. Se abre turno (mañana o tarde), con usuario responsable.
2. Durante el turno se registran movimientos de la Bolsa Grande.
3. Al cerrar, si hay efectivo acumulado en la registradora, se emite un **retiro** → genera `movimiento_caja` tipo `ingreso`, categoría *Retiro de turno*.
4. Puede haber más de un retiro por turno (retiro parcial por seguridad, sin cerrar).

**Validaciones:**
- No permitir dos turnos abiertos en simultáneo.
- No permitir movimientos sobre un turno cerrado.
- Advertir si se abre un turno con otro sin cerrar del día anterior.

### 4.2 Compra de cheque

1. Se elige vendedor, se tipea nominal + % de descuento, número, banco, librador, vencimiento.
2. El sistema muestra el **monto pagado calculado** para confirmación.
3. Al confirmar:
   - `movimiento_caja` tipo `egreso`, categoría *Compra de cheques*, por `monto_pagado`.
   - Cheque entra a cartera con estado `en_cartera`.
   - **No se registra ahorro todavía.**

### 4.3 Entrega de cheque a proveedor

1. Se selecciona el cheque (de los `en_cartera`) y el proveedor.
2. Se seleccionan una o más facturas pendientes de ese proveedor y se imputa monto a cada una → registros en `imputacion_cheque`.
3. Al confirmar:
   - Cheque pasa a `entregado`, se completan `fecha_entrega` y `proveedor_destino_id`.
   - Se descuenta el nominal de la cartera.
   - Se actualiza `saldo_pendiente` de cada factura y `saldo` del proveedor.
   - Si `nominal > Σ montos imputados`, el excedente queda como **saldo a favor** (saldo del proveedor va a negativo).
   - **Se realiza el ahorro**, imputado a la fecha de entrega.
   - **No genera movimiento en la Bolsa Grande** — no hay efectivo involucrado.

**Validación clave:** `Σ imputaciones ≤ nominal`. Nunca puede imputarse más que el valor del cheque.

### 4.4 Cheque rechazado

1. Se marca el cheque como `rechazado` con fecha y motivo.
2. **Quien vendió el cheque debe levantarlo**, pagándole directamente al proveedor que lo recibió.
3. **La verdulería no repone dinero.** No se reabre la deuda con el proveedor, no hay egreso de caja, no se revierte el ahorro.
4. Queda registrado para historial: qué librador rebotó y a qué vendedor se le había comprado.

> El registro es **solo informativo**, pero es la base para dos reportes útiles: libradores con rechazos y vendedores con rechazos. Vale la pena dejarlo bien guardado desde el principio.

### 4.5 Pago a proveedor en efectivo

Mismo flujo de imputación a facturas, pero:
- Genera `movimiento_caja` tipo `egreso`, categoría *Pago a proveedor en efectivo*.
- No hay ahorro.

---

## 5. Reportes

### 5.1 Reporte de ingresos y egresos (principal)

**Alcance: exclusivamente movimientos de la Bolsa Grande.** No incluye ventas: el sistema no las registra (§2.4). Lo que se reporta es flujo de caja, no facturación.

**Filtros de período:**

| Preset | Rango |
|---|---|
| Día | Fecha seleccionada |
| Semana | Semana en curso o seleccionada |
| Mes | Mes en curso o seleccionado |
| Año | Año en curso o seleccionado |
| Personalizado | Desde / hasta a elección del operador |

**Filtros adicionales sugeridos:** por tipo (ingreso/egreso), por categoría, por turno, por usuario.

**Salida:** listado de movimientos + totales de ingreso, egreso y saldo neto del período.

### 5.2 Reportes de la rama cheques

Separados del anterior, porque miden otra cosa:

- **Estado de cartera** — cheques `en_cartera`, total nominal disponible, próximos vencimientos.
- **Ahorro por cheques** — cheques entregados en el período, con nominal, pagado y ahorro. Total del período.
- **Rechazos** — histórico por librador y por vendedor.

### 5.3 Reportes de cuentas

- **Deudores** — clientes con saldo, antigüedad de la deuda.
- **Cuentas proveedores** — saldo por proveedor, facturas pendientes, vencimientos próximos.

---

## 6. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Caja registradora | Fuera de alcance. Solo se modela la Bolsa Grande. |
| Cuenta corriente vs. fiado | Son el mismo concepto. Un solo módulo. |
| Carga del descuento | El operador tipea el %; el sistema calcula y exhibe el monto pagado. |
| Imputación del ahorro | A la fecha de **entrega**, no de compra. |
| Cheque rechazado | Lo levanta el vendedor. La verdulería no repone ni reabre deuda. Se registra. |
| Un cheque / varias facturas | Soportado vía tabla de imputación. |
| Saldo a favor de proveedor | Soportado como saldo negativo en la cuenta. |
| POS | Fuera del proyecto. El sistema es administrativo, no de venta. Posible extensión futura. |
| Carga de datos | Manual. Retiros y fiado los ingresa el operador. |
| Alcance de reportes | Solo Bolsa Grande. Flujo de caja, no facturación. |
| Stack | Next.js + TypeScript + PostgreSQL + Prisma sobre Railway. Detalle en §7. |

---

## 7. Stack técnico

Elegido pensando en un solo desarrollador, despliegue en Railway desde GitHub, y un sistema interno de bajo tráfico.

| Capa | Elección | Motivo |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Fullstack en un solo repo. Sin API desacoplada: no hay otros clientes que la consuman. |
| Base de datos | PostgreSQL | Transacciones reales y buen soporte de agregaciones para reportes. |
| ORM | Prisma | Migraciones versionadas y tipado. |
| UI | Tailwind + shadcn/ui | Componentes que viven en el repo, sin dependencia externa. |
| Auth | Better Auth | Base para el módulo de permisos de fase 3. |
| Tests | Vitest | Para los flujos de dominio de §4. |
| Hosting | Railway (app + Postgres) | Deploy automático desde GitHub. |

### 7.1 Dos reglas técnicas no negociables

**Montos en `Decimal`, nunca `Float`.** Prisma `Decimal` mapea a `NUMERIC` en Postgres. Con punto flotante, el cálculo de descuento por porcentaje genera diferencias de centavos que después no se pueden explicar ni conciliar.

**La entrega de cheque va en una transacción.** Ese flujo (§4.3) toca cinco tablas: cheque, imputaciones, facturas, saldo de proveedor y cartera. Si se corta a la mitad quedan datos inconsistentes que nadie detecta hasta que un reporte da mal. Envolver en `prisma.$transaction()`. Lo mismo aplica a cualquier operación que mueva saldo en más de una tabla.

### 7.2 Despliegue

- Railway despliega desde GitHub y expone `DATABASE_URL` como variable de referencia, sincronizada automáticamente si cambian las credenciales del Postgres.
- Configurar `prisma migrate deploy` como **pre-deploy command**: las migraciones corren antes de que la versión nueva reciba tráfico.
- Usar entornos separados de Railway para staging y producción, con base de datos propia cada uno. No probar migraciones contra la base real.

### 7.3 Sobre la conectividad

Al no haber POS (§2.4), una caída de internet no impide vender: siguen operando con la registradora y cargan después. El riesgo que justificaría una arquitectura offline-first no existe en este alcance. Si más adelante se incorpora el POS, hay que revisar esta decisión antes de escribirlo.

---

## 8. Pendientes a resolver antes de codificar

1. **Vencimiento de cheques en cartera.** ¿Qué pasa si un cheque llega a su fecha de vencimiento sin haberse entregado? ¿Alerta, estado nuevo, se deposita?
2. **Estado `acreditado`.** ¿La verdulería hace seguimiento de si el proveedor efectivamente cobró el cheque, o para ellos termina en `entregado`? Si no hacen seguimiento, el estado sobra.
3. **Límite de crédito de clientes.** Sin POS no hay venta que bloquear, así que el límite solo puede ser una advertencia al cargar el fiado o un dato informativo. ¿Vale la pena tenerlo?
4. **Turnos.** ¿Siempre son dos por día o puede haber más? ¿El turno queda atado a un usuario o a un horario?
5. **Moneda y redondeo.** Definir decimales y política de redondeo en el cálculo de descuento — con porcentajes es donde aparecen las diferencias de centavos.
