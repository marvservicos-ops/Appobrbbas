import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MARV Gestão — Mechanical Engineering",
  description: "Plataforma de gestão de obras para engenharia mecânica",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
