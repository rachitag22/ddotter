import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DDOT Advocacy Map",
  description: "Discover DC transportation projects and submit feedback.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
