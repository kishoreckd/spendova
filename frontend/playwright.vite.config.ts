// Test-only aliases. The normal Vite build never imports these fixtures.
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    { find: "@/features/auth/auth-context", replacement: import.meta.dirname + "/test/browser/auth-fixture.tsx" },

    { find: "@", replacement: import.meta.dirname + "/src" },
  ] },
});
