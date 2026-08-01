import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Edu Signal · Aprendizaje que deja señal",
  description: "MVP para convertir el aprendizaje en evidencia verificable.",
  openGraph: { title: "Edu Signal", description: "Aprendizaje que deja señal.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "Edu Signal", images: ["/og.png"] },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }
