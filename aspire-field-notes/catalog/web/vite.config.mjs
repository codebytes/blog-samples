import { defineConfig } from "vite";
import { apiTarget } from "./proxy-config.mjs";

export default defineConfig(({ command }) => ({
  plugins: [{
    name: "field-notes-health",
    configureServer(server) {
      server.middlewares.use("/health", (_request, response) => {
        response.setHeader("Content-Type", "text/plain");
        response.end("Healthy");
      });
    },
  }],
  // Production uses the generated YARP proxy, not a build-time VITE_* API URL.
  server: command === "serve" ? {
    proxy: {
      "/api": {
        target: apiTarget(process.env),
        changeOrigin: true,
      },
    },
  } : undefined,
}));
