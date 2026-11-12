/** Keep the backend hostname server-side while browser requests stay same-origin. */
export function createDeploymentConfig(backendUrl: string | undefined) {
  if (!backendUrl?.trim()) {
    throw new Error("Set BACKEND_URL in the frontend deployment environment.");
  }

  let backend: URL;
  try {
    backend = new URL(backendUrl.trim());
  } catch {
    throw new Error("BACKEND_URL must be an HTTPS origin without a path.");
  }

  if (
    backend.protocol !== "https:" ||
    backend.username ||
    backend.password ||
    backend.search ||
    backend.hash ||
    (backend.pathname !== "/" && backend.pathname !== "") ||
    ["localhost", "127.0.0.1", "[::1]"].includes(backend.hostname)
  ) {
    throw new Error(
      "BACKEND_URL must be a public HTTPS origin without credentials, path, query or fragment.",
    );
  }

  return {
    framework: "vite",
    buildCommand: "npm run build",
    outputDirectory: "dist",
    rewrites: [
      { source: "/api/:path*", destination: `${backend.origin}/api/:path*` },
      { source: "/(.*)", destination: "/index.html" },
    ],
    headers: [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ],
  };
}
