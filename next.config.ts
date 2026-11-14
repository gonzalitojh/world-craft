import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

const nextConfig: NextConfig = {
  // Detecta efectos secundarios y APIs obsoletas en desarrollo.
  reactStrictMode: true,
  // Fija la raíz del proyecto: sin esto Turbopack rastrea el sistema de
  // archivos hacia arriba y avisa de lockfiles ajenos.
  turbopack: {
    root: import.meta.dirname,
  },
  // Playwright sirve la aplicación en 127.0.0.1; sin esta lista, Next.js
  // bloquea en desarrollo los recursos internos (HMR) por origen cruzado.
  allowedDevOrigins: ['127.0.0.1'],
  // `AGENTS.md` lo gobierna el proceso SDD del proyecto (ADR 0015): Next no
  // debe añadir ni reescribir sus bloques de instrucciones para agentes.
  agentRules: false,
  // No revelamos el servidor ni la versión en las respuestas.
  poweredByHeader: false,
  images: {
    // Formatos modernos servidos por el optimizador de Next.js.
    formats: ['image/avif', 'image/webp'],
    // Los SVG subidos por usuarios se sirven como descarga, nunca inline:
    // un SVG puede contener scripts. Los assets propios se sirven desde /public.
    dangerouslyAllowSVG: false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
