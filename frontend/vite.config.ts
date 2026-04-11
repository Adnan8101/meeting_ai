import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const backendTarget = process.env.VITE_BACKEND_URL || "http://localhost:5001";

export default defineConfig({
  appType: "spa",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": { target: backendTarget, changeOrigin: true },
      "/check_username": { target: backendTarget, changeOrigin: true },
      "/assistant": { target: backendTarget, changeOrigin: true },
      "/get_lists": { target: backendTarget, changeOrigin: true },
      "/get_jira_projects": { target: backendTarget, changeOrigin: true },
      "/get_jira_issue_types": { target: backendTarget, changeOrigin: true },
      "/slack": { target: backendTarget, changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
