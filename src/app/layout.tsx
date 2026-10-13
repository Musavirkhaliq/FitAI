import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { themeScript } from "@/components/ThemeToggle";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "FitTrack AI", template: "%s · FitTrack AI" },
  description: "A voice-first AI fitness coach: log by talking, get honest estimates and adaptive coaching.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f8f7" }, { media: "(prefers-color-scheme: dark)", color: "#0b1013" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
