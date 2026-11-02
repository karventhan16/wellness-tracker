import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: true }, // open on your phone via the Network link (same Wi-Fi)
});
