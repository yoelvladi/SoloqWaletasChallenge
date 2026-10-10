import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Access databases, backups and secrets belong to the runtime volume only.
  outputFileTracingExcludes: { "/*": ["./data/**/*", "./.env*"] },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'${process.env.NODE_ENV === "development" ? " ws://127.0.0.1:* ws://localhost:*" : ""}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';` }
      ]
    }];
  }
};

export default config;
