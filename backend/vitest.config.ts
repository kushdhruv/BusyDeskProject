import { defineConfig } from "vitest/config";
import path from "path";
import fs from "fs";

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
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./") },
      { find: /^(\.\.\/)+lib\/(.*)$/, replacement: path.resolve(__dirname, "./lib/$2") },
    ],
  },
});
