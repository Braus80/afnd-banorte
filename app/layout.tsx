import { Montserrat } from "next/font/google";
import "@/src/ui/a2ui.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--a2ui-fuente-montserrat" });

export const metadata = {
  title: "Tu situación de crédito",
  description: "Agente que genera interfaces en tiempo real sobre LLM + MCP + A2UI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={montserrat.variable}>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
