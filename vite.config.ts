import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const productionPolicy: Plugin = {
  name: "watchtower-production-policy",
  apply: "build",
  transformIndexHtml() {
    return [{
      tag: "meta",
      attrs: {
        "http-equiv": "Content-Security-Policy",
        content: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https:; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'"
      },
      injectTo: "head-prepend"
    }];
  }
};

export default defineConfig({
  base: "/parallax-watchtower/",
  plugins: [react(), productionPolicy]
});
