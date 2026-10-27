import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "NOVA by AETHRA",
  description: "Supervised autonomous engineering research and analysis workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
