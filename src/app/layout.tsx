import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Estación Verde",
  description: "Gestión administrativa: caja por turno, cheques y cuentas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b">
          <div className="mx-auto flex w-full max-w-4xl gap-1 px-4 py-3 text-sm">
            <Link href="/caja" className="rounded-md px-3 py-1.5 hover:bg-accent">
              Caja
            </Link>
            <Link href="/cheques" className="rounded-md px-3 py-1.5 hover:bg-accent">
              Cheques
            </Link>
            <Link href="/proveedores" className="rounded-md px-3 py-1.5 hover:bg-accent">
              Proveedores
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
