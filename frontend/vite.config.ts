import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, ["VITE_", "DEV_", "BACKEND_"]);
  const apiPath = (env.VITE_API_BASE_PATH || "/api/v1").replace(/\/+$/, "");
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": import.meta.dirname + "/src",
      },
    },
    server: {
      port: 5173,
      proxy: {
        [apiPath]:
          env.BACKEND_URL ||
          env.DEV_API_PROXY_TARGET ||
          "http://127.0.0.1:8000",
      },
    },
  };
});
