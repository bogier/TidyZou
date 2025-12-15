// build.mjs
import { build } from "esbuild";
import fs from "fs-extra";

async function main() {
  await fs.emptyDir("dist");

  const staticFiles = [
    "index.html",
    "about.html",
    "install.html",
    "style.css",
    "service-worker.js",
    "manifest.json",
    "exemple.json",
    "favicon.ico"
  ];

  console.log("📄 Vérification des fichiers statiques :");
  for (const file of staticFiles) {
    const exists = await fs.pathExists(file);
    console.log(`- ${file}: ${exists ? "OK" : "ABSENT"}`);
    if (exists) {
      await fs.copy(file, `dist/${file}`);
    }
  }

  const staticDirs = [
    "icons",
    "img",
    "appli",
    "screenshots",
    "splash",
    "ideas"
  ];

  console.log("📁 Vérification des dossiers statiques :");
  for (const dir of staticDirs) {
    const exists = await fs.pathExists(dir);
    console.log(`- ${dir}: ${exists ? "OK" : "ABSENT"}`);
    if (exists) {
      await fs.copy(dir, `dist/${dir}`);
    }
  }

  await build({
    entryPoints: ["index.js"],
    bundle: true,
    minify: true,
    target: ["es2018"],
    format: "iife",
    outfile: "dist/index.js",
    sourcemap: false
  });

  console.log("✅ Build prod TidyZou généré dans dist/");
}

main().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
