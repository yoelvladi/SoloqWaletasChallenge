import type { Metadata } from "next";
import "./globals.css";
import "./hextech.css";

export const metadata: Metadata = {
  title: "SoloQWaletasChallenge · Clasificación",
  description: "El desafío de SoloQ de los Waletas. Clasificación privada de ocho jugadores de LAS.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
