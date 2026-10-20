import fs from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import * as L from "lucide-react"
const names = JSON.parse(fs.readFileSync("/home/claude/dsbuild/gen/ui-icons.json", "utf8"))
const out = "/home/claude/dsbuild/out/project/assets/Icons"
const where = {}
const UI = "/home/claude/gf4e/ui/apps/v4/registry/bases/base/ui"
for (const f of fs.readdirSync(UI).filter((f) => f.endsWith(".tsx"))) {
  const src = fs.readFileSync(`${UI}/${f}`, "utf8")
  for (const m of src.matchAll(/lucide="([A-Za-z0-9]+)"/g)) (where[m[1]] ??= new Set()).add(f.replace(".tsx", ""))
}
const rows = []
for (const n of names) {
  const C = L[n]
  if (!C) throw new Error("missing " + n)
  let svg = renderToStaticMarkup(createElement(C, {}))
  svg = svg.replace(/ class="[^"]*"/, "")
  const file = n.replace(/Icon$/, "").replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z])([A-Z][a-z])/g, "$1-$2").replace(/([a-z])(\d)/g, "$1-$2").toLowerCase() + ".svg"
  fs.writeFileSync(`${out}/${file}`, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`)
  rows.push({ n, file, used: [...where[n]].sort() })
}
fs.writeFileSync("/home/claude/dsbuild/gen/icons.json", JSON.stringify(rows, null, 1))
const v = JSON.parse(fs.readFileSync("/home/claude/dsbuild/node_modules/lucide-react/package.json", "utf8")).version
fs.writeFileSync(`${out}/README.md`, [
  `The ${rows.length} Lucide glyphs the components draw themselves, exported from \`lucide-react\` ${v} at its defaults: 24px viewBox, 2px stroke, round caps and joins, no fill.`, "",
  "- Each SVG strokes `currentColor`, which an `<img>` paints black. To colour one, inline the SVG or render it from `lucide-react` with a `text-*` token class (`text-muted-foreground` for chevrons and carets, `text-foreground` elsewhere).",
  "- Components size them with `size-4` (16px); small buttons and badges use `size-3`.", "- Any other icon: import it from `lucide-react`; don't redraw Lucide shapes.", "",
  "| File | Lucide name | Drawn by |", "| --- | --- | --- |",
  ...rows.map((r) => `| \`${r.file}\` | \`${r.n}\` | ${r.used.join(", ")} |`),
].join("\n") + "\n")
console.log(rows.map((r) => `${r.file} <- ${r.used.join(",")}`).join("\n"))
