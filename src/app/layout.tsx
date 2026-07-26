import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nexis OS",
    template: "%s · Nexis OS",
  },
  description: "The operating system for the NEXIS School of Business team.",
  openGraph: {
    title: "Nexis OS",
    description: "The operating system for the NEXIS School of Business team.",
    images: ["/brand/logo.png"],
    type: "website",
  },
  appleWebApp: {
    capable: true,
    title: "Nexis OS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0f" },
  ],
  width: "device-width",
  initialScale: 1,
  // Allow zoom — locking it out is an accessibility failure.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <body className="antialiased">
        {children}
        <Toaster
          position="top-center"
          richColors
          toastOptions={{ style: { fontFamily: "var(--font-poppins)" } }}
        />
      </body>
    </html>
  );
}
