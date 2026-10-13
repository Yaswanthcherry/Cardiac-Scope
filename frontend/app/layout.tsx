import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CardioScope — Cardiovascular Risk Visualization",
  description:
    "Interactive 3D cardiovascular risk prediction and SHAP explanation dashboard. For educational and decision-support purposes only.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0f1e] text-[#f0f4ff] antialiased">
        {children}
      </body>
    </html>
  );
}
