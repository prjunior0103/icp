import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sistema ICP",
  description: "Gestão de Incentivo de Curto Prazo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-gray-50 antialiased`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
