import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SUN FREAK",
  description: "Sun Freak Forecast",
  applicationName: "SUN FREAK",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SUN FREAK",
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="SUN FREAK" />
      </head>
      <body>{children}</body>
    </html>
  );
}