import type { Metadata } from "next";
import { Geist, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { NavLink } from "@/components/nav-link";
import { NavGroup } from "@/components/nav-group";
import { BloqueSesion } from "@/components/bloque-sesion";
import { puede, sesionActual } from "@/lib/sesion";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Estación Verde",
  description: "Gestión administrativa: caja por turno, cheques y cuentas.",
};

const NAV_ICON = "h-[18px] w-[18px] shrink-0";

/**
 * Cada entrada del menú se muestra solo si la persona tiene el permiso de ver esa
 * sección.
 *
 * Ocultar no es proteger: quien tipee la URL a mano llega igual, y por eso cada
 * pantalla vuelve a exigir su permiso con `requerirPermiso`. Esto es para que la
 * barra no ofrezca puertas que después dan un cartel de "no podés".
 */
const ENTRADAS_NAV = [
  {
    href: "/caja",
    permiso: "caja.ver",
    etiqueta: "Caja",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={NAV_ICON}>
        <rect x="3" y="7" width="18" height="12" rx="2" />
        <path d="M3 11h18" />
        <circle cx="16" cy="15" r="1" />
      </svg>
    ),
  },
  {
    href: "/cheques",
    permiso: "cheques.ver",
    etiqueta: "Cheques",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={NAV_ICON}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </svg>
    ),
  },
  {
    href: "/proveedores",
    permiso: "proveedores.ver",
    etiqueta: "Proveedores",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={NAV_ICON}>
        <rect x="3" y="9" width="10" height="8" rx="1" />
        <path d="M13 12h4l3 3v2h-7z" />
        <circle cx="7" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
      </svg>
    ),
  },
  {
    href: "/clientes",
    permiso: "clientes.ver",
    etiqueta: "Clientes",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={NAV_ICON}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-4 3-6 6-6s6 2 6 6" />
        <circle cx="17" cy="9" r="2.3" />
        <path d="M15 20c.3-2.5 1.8-4 3.5-4.3" />
      </svg>
    ),
  },
  {
    href: "/reportes",
    permiso: "reportes.ver",
    etiqueta: "Reportes",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={NAV_ICON}>
        <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />
      </svg>
    ),
  },
] as const;

const ICONO_CONFIGURACION = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={NAV_ICON}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
  </svg>
);

const ICONO_USUARIOS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={NAV_ICON}>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </svg>
);

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sesion = await sesionActual();

  const cuerpo = sesion ? (
    <>
      <Sidebar>
        <nav className="flex flex-col gap-1">
          {ENTRADAS_NAV.filter((entrada) => puede(sesion.usuario, entrada.permiso)).map(
            (entrada) => (
              <NavLink key={entrada.href} href={entrada.href} icon={entrada.icono}>
                {entrada.etiqueta}
              </NavLink>
            ),
          )}
          {puede(sesion.usuario, "usuarios.configurar") && (
            <NavGroup
              etiqueta="Configuración"
              icon={ICONO_CONFIGURACION}
              prefijo="/configuracion"
            >
              <NavLink href="/configuracion/usuarios" icon={ICONO_USUARIOS} anidado>
                Usuarios
              </NavLink>
            </NavGroup>
          )}
        </nav>

        <BloqueSesion usuario={sesion.usuario} />
      </Sidebar>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </>
  ) : (
    // Sin sesión no hay barra lateral: las únicas pantallas que se alcanzan así son
    // la de ingreso y la de primer arranque, y un menú al costado que no lleva a
    // ningún lado solo estorba.
    <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
  );

  return (
    <html
      lang="es-AR"
      className={`${geistSans.variable} ${geistMono.variable} ${nunito.variable} h-full antialiased`}
    >
      <body
        className="flex h-full flex-col bg-background text-foreground md:flex-row"
        suppressHydrationWarning
      >
        {cuerpo}
      </body>
    </html>
  );
}
