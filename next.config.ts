import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Raíz explícita: sin esto Turbopack toma cualquier package-lock.json de
  // una carpeta superior (p. ej. el del perfil de usuario) como raíz del
  // workspace y resuelve mal rutas y estilos.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
