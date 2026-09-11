import { defineConfig } from "vitest/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file natively if present
const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  for (const line of envConfig.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*["']?(.*?)["']?\s*$/);
    if (match) {
      const key = match[1];
      const value = match[2];
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@/routes": path.resolve(__dirname, "./routes"),
      "@/controllers": path.resolve(__dirname, "./controllers"),
      "@/middlewares": path.resolve(__dirname, "./middlewares"),
      "@/models": path.resolve(__dirname, "./models"),
      "@/db": path.resolve(__dirname, "./db"),
      "@/utils": path.resolve(__dirname, "./utils"),
    },
  },
});
