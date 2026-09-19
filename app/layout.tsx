import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#0b1220", color: "#f8fafc" }}>
        {children}
      </body>
    </html>
  );
}
