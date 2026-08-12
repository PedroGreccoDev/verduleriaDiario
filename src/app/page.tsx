import { redirect } from "next/navigation";

export default function Home() {
  // Caja por turno es la única pantalla por ahora y la que se usa todos los días.
  redirect("/caja");
}
