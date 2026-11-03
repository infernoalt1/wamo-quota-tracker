import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ravenswood · Trouble Brewing",
  description: "Gather your friends. Keep your secrets. An automated Trouble Brewing table.",
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
