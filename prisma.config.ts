import path from "node:path";
import { defineConfig } from "prisma/config";

// Replaces the deprecated `package.json#prisma` block. A Prisma config file
// disables Prisma's own .env loading, so do it here (Node 20.6+ builtin).
try {
  process.loadEnvFile(path.join(import.meta.dirname, ".env"));
} catch {
  // No .env locally — rely on the ambient environment (e.g. Vercel).
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
