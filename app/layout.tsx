import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pergola — Configuratore IC Tende",
  description: "Configura tende, pergole e schermature su misura. Prezzi dal catalogo IC Tende, preventivi e archivio condiviso.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}
