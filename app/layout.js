export const metadata = {
  title: "YSASL | Yuba Sutter Adult Soccer League",
  description: "Sitio oficial de Yuba Sutter Adult Soccer League",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
