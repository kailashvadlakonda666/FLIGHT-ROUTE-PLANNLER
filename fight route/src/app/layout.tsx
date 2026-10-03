import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routewise — Flight route algorithm studio",
  description:
    "Find the cheapest routes, watch graph algorithms work, and plan the perfect multi-city trip.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
