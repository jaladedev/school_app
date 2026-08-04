// Copies MathLive's bundled KaTeX fonts into public/ so the browser can
// load them from a path that actually exists in Next's build output.
// MathLive's default fontsDirectory assumes its fonts sit next to its own
// JS chunk, which isn't true once webpack bundles it -- see
// lib/tiptap/math-nodes.tsx, which points fontsDirectory at "/mathlive-fonts".
// Runs automatically via the "postinstall" script in package.json.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "mathlive", "fonts");
const dest = path.join(__dirname, "..", "public", "mathlive-fonts");

if (!fs.existsSync(src)) {
  console.warn("[copy-mathlive-fonts] mathlive/fonts not found, skipping");
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });

for (const file of fs.readdirSync(src)) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}

console.log(`[copy-mathlive-fonts] copied ${fs.readdirSync(dest).length} font files to public/mathlive-fonts`);