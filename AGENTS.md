<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Moneda: pesos enteros, NUNCA centavos

La moneda del sistema es el peso argentino y **no se usan centavos**. Ningún
monto —nominal de un cheque, monto pagado, ahorro, retiro de caja, saldo de
proveedor, imputación de factura— lleva parte decimal, en ningún lugar:

- **En la base:** los montos son enteros. Nada de `Decimal(14, 2)` ni de escalas
  de dos decimales.
- **En el cálculo:** el descuento por porcentaje se resuelve a peso entero. No
  existe el "medio peso" que después haya que redondear al mostrar.
- **En pantalla:** se muestra `$ 4.070.000`, no `$ 4.070.000,00`. Tampoco se
  acepta que el operador tipee centavos.
- **En los tests:** ningún caso se expresa en centavos ni verifica diferencias
  de centavos.

El motivo es que en la verdulería la plata se cuenta en pesos: no hay monedas
de centavo, la registradora no las da y el proveedor no las cobra. Un centavo
guardado es un centavo que ningún papel del negocio puede respaldar.

Esto reemplaza lo que dice la especificación sobre "diferencias de centavos"
(§7.1, §8.5): el problema no se resuelve eligiendo una política de redondeo a
dos decimales, se elimina no teniendo decimales.

## Cuando el porcentaje no da peso justo: redondear a favor de la verdulería

El descuento por porcentaje casi nunca cae en un peso exacto. Nominal $1.000 al
3,33 % da $966,7, y hay que decidir hacia dónde va ese resto. **Siempre a favor
de la verdulería**, que es la que pone la plata:

- **`montoPagado` se redondea HACIA ABAJO** (piso), nunca al más cercano. En el
  ejemplo se pagan $966, no $967.
- **`ahorro` se deriva restando**, nunca se calcula aparte: `ahorro = nominal −
  montoPagado`. En el ejemplo, $34.

Derivar el ahorro en vez de calcularlo es lo que mantiene la identidad
`nominal = montoPagado + ahorro` con números enteros. Si se redondearan los dos
por separado, habría nominales donde las columnas no cierran por un peso, y un
reporte que no cierra es indefendible frente al dueño.

El sesgo va siempre para el mismo lado a propósito: la verdulería paga de menos,
nunca de más.
