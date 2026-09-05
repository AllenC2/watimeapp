import "./globals.css";

export const metadata = {
  title: "WhatsApp Dashboard",
  description: "Dashboard para programar mensajes de WhatsApp",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
