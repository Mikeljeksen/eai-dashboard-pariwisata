import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AuroraBackground } from "@/components/aurora-background";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "Nusantara Tourism Hub", template: "%s · Nusantara Tourism Hub" },
  description:
    "Dashboard EVD pariwisata Indonesia — integrasi data-level (ETL) dari 5 sumber BPS & World Bank ke Supabase.",
};

export const viewport: Viewport = { themeColor: "#0b0b1a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${jakarta.variable} font-sans antialiased min-h-dvh`}>
        <AuroraBackground />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
