import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  publicDir: resolve(__dirname, "fonts"),
  server: {
    port: 5173,
    open: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  plugins: [
    {
      name: "otf-mime",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith(".otf")) {
            res.setHeader("Content-Type", "font/otf");
          }
          next();
        });
      },
    },
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "index.js"
    },
    rollupOptions: {
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js"
      }
    }
  }
});