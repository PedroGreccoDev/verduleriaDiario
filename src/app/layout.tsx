import type { Metadata } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { NavLink } from "@/components/nav-link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Estación Verde",
  description: "Gestión administrativa: caja por turno, cheques y cuentas.",
};

const NAV_ICON = "h-[18px] w-[18px] shrink-0";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
    >
      <body
        className="flex h-full flex-col bg-background text-foreground md:flex-row"
        suppressHydrationWarning
      >
        <Sidebar>
          <nav className="flex flex-col gap-1">
            <NavLink
              href="/caja"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={NAV_ICON}>
                  <rect x="3" y="7" width="18" height="12" rx="2" />
                  <path d="M3 11h18" />
                  <circle cx="16" cy="15" r="1" />
                </svg>
              }
            >
              Caja
            </NavLink>
            <NavLink
              href="/cheques"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={NAV_ICON}>
                  <rect x="4" y="3" width="16" height="18" rx="2" />
                  <path d="M8 9h8M8 13h8M8 17h5" />
                </svg>
              }
            >
              Cheques
            </NavLink>
            <NavLink
              href="/proveedores"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={NAV_ICON}>
                  <rect x="3" y="9" width="10" height="8" rx="1" />
                  <path d="M13 12h4l3 3v2h-7z" />
                  <circle cx="7" cy="19" r="1.5" />
                  <circle cx="17" cy="19" r="1.5" />
                </svg>
              }
            >
              Proveedores
            </NavLink>
            <NavLink
              href="/clientes"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={NAV_ICON}>
                  <circle cx="9" cy="8" r="3" />
                  <path d="M3 20c0-4 3-6 6-6s6 2 6 6" />
                  <circle cx="17" cy="9" r="2.3" />
                  <path d="M15 20c.3-2.5 1.8-4 3.5-4.3" />
                </svg>
              }
            >
              Clientes
            </NavLink>
            <NavLink
              href="/reportes"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={NAV_ICON}>
                  <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />
                </svg>
              }
            >
              Reportes
            </NavLink>
          </nav>

          <div className="mt-auto flex flex-col gap-0.5 rounded-lg bg-sidebar-accent/60 px-3.5 py-3">
            <span className="text-xs text-muted-foreground">Sesión</span>
            <span className="text-sm font-semibold">Mostrador</span>
          </div>
        </Sidebar>

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
