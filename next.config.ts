import path from "node:path";
import type { NextConfig } from "next";

// Cabeceras de seguridad para todas las rutas. La CSP es deliberadamente
// acotada (no restringe scripts: Next y el script de tema usan inline):
// cubre clickjacking (frame-ancestors), inyección de <base>, envío de
// formularios a terceros y plugins.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  // Raíz explícita: sin esto Turbopack toma cualquier package-lock.json de
  // una carpeta superior (p. ej. el del perfil de usuario) como raíz del
  // workspace y resuelve mal rutas y estilos.
  turbopack: {
    root: path.join(__dirname),
  },
  poweredByHeader: false,
  // Caché del navegador para páginas dinámicas: volver a una pestaña vista
  // hace menos de 30 s es instantáneo (antes: 0 s, siempre al servidor).
  // Guardar algo llama a router.refresh(), que vacía esta caché.
  experimental: {
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
