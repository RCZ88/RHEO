import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const spaceGrotesk = localFont({
  src: [
    { path: "../fonts/SpaceGrotesk-500.ttf", weight: "500", style: "normal" },
    { path: "../fonts/SpaceGrotesk-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["Space Grotesk", "system-ui", "sans-serif"],
});

const jetbrainsMono = localFont({
  src: [
    { path: "../fonts/JetBrainsMono-400.ttf", weight: "400", style: "normal" },
    { path: "../fonts/JetBrainsMono-500.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
  fallback: ["JetBrains Mono", "ui-monospace", "monospace"],
});

const HERO_SUB =
  "RHEO records how you spend your hours, then turns the record into understanding — phases, dashboards, lessons, and an AI that knows your time because it watched it flow.";

export const metadata: Metadata = {
  metadataBase: new URL("https://rheo.app"),
  title: "RHEO — Time, made legible",
  description: HERO_SUB,
  authors: [{ name: "RHEO" }],
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "RHEO — Time, made legible",
    description: HERO_SUB,
    type: "website",
    images: [
      { url: "/og.png", width: 1200, height: 630, alt: "RHEO — Time, made legible" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RHEO — Time, made legible",
    description: HERO_SUB,
    images: ["/og.png"],
  },
};

export const viewport = {
  themeColor: "#050506",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
