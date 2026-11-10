import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from '../lib/i18n/provider';

export const metadata: Metadata = {
  title: "IC Tende — Configuratore",
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
      <body className="antialiased"><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
