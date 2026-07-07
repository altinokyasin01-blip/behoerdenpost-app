// Runs as "postbuild" (npm's automatic post-hook for the "build" script).
// Vite copies public/sw.js into dist/sw.js verbatim, with no processing —
// its CACHE_NAME would otherwise stay a static string forever, meaning an
// already-installed service worker could keep serving a stale cache
// indefinitely. This derives a hash from the actual built asset filenames
// (already content-hashed by Vite, so the set changes whenever any asset's
// content changes) and injects it, so cache invalidation is automatic and
// tied to real content changes — no manual version bump needed per deploy.
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");
const assetsDir = join(distDir, "assets");
const swPath = join(distDir, "sw.js");

const assetFiles = readdirSync(assetsDir).sort();
const hash = createHash("sha256")
  .update(assetFiles.join(","))
  .digest("hex")
  .slice(0, 10);

const sw = readFileSync(swPath, "utf8");
const versioned = sw.replace(
  /const CACHE_NAME = ".*?";/,
  `const CACHE_NAME = "buero-${hash}";`
);

if (versioned === sw) {
  throw new Error(
    "inject-sw-version: CACHE_NAME line not found/replaced in dist/sw.js — " +
      "check that public/sw.js still defines it as `const CACHE_NAME = \"...\";`"
  );
}

writeFileSync(swPath, versioned);
console.log(`[inject-sw-version] dist/sw.js CACHE_NAME set to "buero-${hash}"`);
