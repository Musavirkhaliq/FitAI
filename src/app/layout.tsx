import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { themeScript } from "@/components/ThemeToggle";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
// Display face for headings and big numerals: geometric, friendly, with excellent figures.
const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-display", weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "SukoonFit", template: "%s · SukoonFit" },
  applicationName: "SukoonFit",
  appleWebApp: { capable: true, title: "SukoonFit", statusBarStyle: "black-translucent" },
  description: "SukoonFit: a calm, voice-first AI fitness coach. Log by talking, get honest estimates and adaptive coaching.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f5f8f6" }, { media: "(prefers-color-scheme: dark)", color: "#080c0f" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
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
