import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Akış — Yerel Kanban ve Mind Map",
  description:
    "Projelerinizi çevrimdışı yönetin, işlerinizi görünür kılın ve düşüncelerinizi birbirine bağlayın.",
  applicationName: "Akış",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
