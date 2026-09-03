import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rheo.app"),
  title: "RHEO — Time, made legible.",
  description:
    "RHEO is an AI-native time-tracking desktop app. It records how you spend your hours, then turns the record into understanding — phases, dashboards, lessons, and an AI that knows your time because it watched it flow.",
  keywords: [
    "RHEO",
    "time tracking",
    "AI time tracking",
    "deep work",
    "flow",
    "desktop app",
  ],
  authors: [{ name: "RHEO" }],
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "RHEO — Time, made legible.",
    description:
      "RHEO records how you spend your hours, then turns the record into understanding.",
    type: "website",
    images: [
      { url: "/og.png", width: 1200, height: 630, alt: "RHEO — Time, made legible." },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RHEO — Time, made legible.",
    description:
      "RHEO records how you spend your hours, then turns the record into understanding.",
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
