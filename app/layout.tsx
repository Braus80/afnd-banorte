export const metadata = {
  title: "AFND — Reestructuración de deuda",
  description: "Agente que genera interfaces en tiempo real sobre LLM + MCP + A2UI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
