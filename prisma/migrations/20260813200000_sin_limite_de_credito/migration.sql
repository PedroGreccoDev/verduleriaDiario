-- §8.3 resuelto: no hay límite de crédito para clientes. El dueño fía por
-- confianza, y sin POS no había ninguna venta que un límite pudiera bloquear.
--
-- Se elimina la columna en vez de dejarla sin uso: un campo que nadie llena y que
-- nada consulta termina siendo una pregunta más en el alta de clientes y una duda
-- para el que lea el schema dentro de un año.
ALTER TABLE "cliente" DROP COLUMN "limite_credito";
