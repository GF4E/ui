// Writes components/<Card>/preview.html, components/<Card>/README.md and components/index.d.ts.
import fs from "node:fs"

const ROOT = "/home/claude/dsbuild"
const REPO = "/home/claude/gf4e/ui"
const DOCS = `${REPO}/apps/v4/content/docs/components`
const OUT = `${ROOT}/out/project`
const GEN = `${ROOT}/gen`
const cards = JSON.parse(fs.readFileSync(`${GEN}/cards.json`, "utf8")) // file -> Card
const exportsMap = JSON.parse(fs.readFileSync(`${ROOT}/exports.json`, "utf8"))
const measure = JSON.parse(fs.readFileSync(`${GEN}/render-measure.json`, "utf8"))
const sections = JSON.parse(fs.readFileSync(`${GEN}/sections.json`, "utf8"))

const GROUP = {
  Actions: ["button", "button-group", "toggle", "toggle-group"],
  Forms: ["input", "input-group", "input-otp", "textarea", "checkbox", "radio-group", "switch", "slider", "select", "native-select", "combobox", "calendar", "field", "label"],
  Overlays: ["dialog", "alert-dialog", "sheet", "drawer", "popover", "hover-card", "tooltip"],
  "Menus & navigation": ["dropdown-menu", "context-menu", "menubar", "navigation-menu", "breadcrumb", "pagination", "tabs", "sidebar", "command"],
  Feedback: ["alert", "sonner", "toast", "progress", "skeleton", "spinner", "empty"],
  "Data display": ["card", "table", "avatar", "badge", "kbd", "item", "chart", "carousel", "marker"],
  Layout: ["aspect-ratio", "separator", "scroll-area", "resizable", "accordion", "collapsible"],
  "AI & chat": ["message", "message-scroller", "bubble", "attachment", "code-block", "trace", "questionnaire"],
}
const groupOf = Object.fromEntries(Object.entries(GROUP).flatMap(([g, fs_]) => fs_.map((f) => [f, g])))
const OVERLAY = new Set(["alert-dialog", "combobox", "command", "context-menu", "dialog", "drawer", "dropdown-menu", "hover-card", "menubar", "navigation-menu", "popover", "select", "sheet", "sonner", "toast", "tooltip"])
const WIDE = { sidebar: 1100 }
const missingGroup = Object.keys(cards).filter((f) => !groupOf[f])
if (missingGroup.length) throw new Error("no group: " + missingGroup)

const NOVA = fs.readFileSync(`${REPO}/apps/v4/registry/styles/style-nova.css`, "utf8")
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")

// ---------- previews ----------
const order = []
for (const [f, Card] of Object.entries(cards)) {
  const js = fs.readFileSync(`${GEN}/previews/${f}.js`, "utf8")
  if (/<\/script/i.test(js)) throw new Error("script close in " + f)
  const h = measure[f]?.light?.rootH ?? 300
  let height = Math.max(120, Math.min(4000, h))
  if (OVERLAY.has(f)) height = Math.max(height, 480)
  if (f === "sidebar") height = 640
  const width = WIDE[f] ? ` width=${WIDE[f]}` : ""
  const picked = sections[f] ?? ["default"]
  const html = `<!-- @dsCard group="${groupOf[f]}" height=${height}${width} -->
<!doctype html>
<html>
<head><meta charset="utf-8"><title>${Card} — preview</title></head>
<body>
<!-- From apps/v4/registry/bases/base/examples/${f}-example.tsx: ${picked.join(", ")}${f === "message-scroller" ? " (useChat replaced by local state; same scripted chat)" : ""}${f === "code-block" ? " (no syntax highlighting: shiki is not bundled)" : ""} -->
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`
  if (html.length > 256 * 1024) throw new Error("preview too big " + f)
  fs.mkdirSync(`${OUT}/components/${Card}`, { recursive: true })
  fs.writeFileSync(`${OUT}/components/${Card}/preview.html`, html)
  order.push([groupOf[f], Card])
}

// ---------- READMEs from the repo's docs ----------
function docFor(f) {
  for (const p of [`${DOCS}/base/${f}.mdx`, `${DOCS}/radix/${f}.mdx`]) if (fs.existsSync(p)) return p
  return null
}
function mdxToMd(src) {
  const fm = src.match(/^---\n([\s\S]*?)\n---\n/)
  const meta = {}
  if (fm) for (const l of fm[1].split("\n")) { const m = l.match(/^(\w+):\s*(.*)$/); if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, "") }
  let body = fm ? src.slice(fm[0].length) : src
  // split into ## sections, drop Installation / RTL / Changelog
  const parts = body.split(/\n(?=## )/)
  const keep = parts.filter((p) => !/^## (Installation|RTL|Changelog)\b/.test(p))
  body = keep.join("\n")
  // remove JSX blocks and tags outside code fences
  const out = []
  let fence = false, inTag = false
  for (let line of body.split("\n")) {
    if (inTag) { if (/\/?>\s*$/.test(line)) inTag = false; continue }
    if (/^\s*```/.test(line)) { fence = !fence; out.push(line.replace(/^(\s*```\w*).*$/, "$1")); continue }
    if (fence) { out.push(line); continue }
    if (/^\s*<[A-Z][A-Za-z]*\b[^>]*$/.test(line)) { inTag = true; continue }
    if (/^\s*<\/?(ComponentPreview|ComponentSource|CodeTabs|TabsList|TabsTrigger|TabsContent|Steps|Step|CodeCollapsibleWrapper|Image|LinkedCard|ComponentsList|div|figure)\b[^>]*\/?>\s*$/.test(line)) continue
    if (/^\s*<(ComponentPreview|ComponentSource|Image)\b/.test(line)) continue
    line = line.replace(/<\/?Callout[^>]*>/g, "").replace(/<\/?Step>/g, "")
    line = line.replace(/\]\(\/docs\//g, "](https://ui.shadcn.com/docs/").replace(/\]\(\/(create|blocks|charts)/g, "](https://ui.shadcn.com/$1")
    out.push(line)
  }
  body = out.join("\n")
  // drop headings left with nothing under them
  const secs = body.split(/\n(?=#{2,3} )/)
  body = secs.filter((s) => s.replace(/^#{2,3} .*\n?/, "").trim().length > 0 || !/^#{2,3} /.test(s)).join("\n")
  body = body.replace(/\n{3,}/g, "\n\n").trim()
  return { meta, body }
}

const PREVIEW_NOTE = {
  "message-scroller": "The preview runs the repo's scripted chat with local state in place of the AI SDK's `useChat`; press send to step through it.",
  "code-block": "The preview shows the component without syntax colours: the repo highlights with shiki, which is not bundled here.",
  sonner: "In this system's bundle the component is `ShadcnUI.Sonner` (it is `Toaster` in `@/components/ui/sonner`), so it does not collide with Base UI Toast's `Toaster`.",
  chart: "Charts need the shared `Recharts` library global, which this system loads before the bundle.",
  sidebar: "The preview is laid out at 1100px: below 768px the sidebar collapses into a sheet.",
}

const dts = []
for (const [f, Card] of Object.entries(cards)) {
  const p = docFor(f)
  const vals = exportsMap[f].vals.map((v) => (f === "sonner" && v === "Toaster" ? "Sonner" : v))
  let md
  if (p) {
    const { meta, body } = mdxToMd(fs.readFileSync(p, "utf8"))
    const desc = (meta.description || `${meta.title}.`).replace(/\s+$/, "")
    md = `${/[.!?]$/.test(desc) ? desc : desc + "."}\n\n`
    md += `- Import: \`import { ${exportsMap[f].vals.filter((v) => /^[A-Z]/.test(v)).slice(0, 4).join(", ")}${exportsMap[f].vals.filter((v) => /^[A-Z]/.test(v)).length > 4 ? ", …" : ""} } from "@/components/ui/${f}"\` (add with \`npx shadcn@latest add ${f}\`).\n`
    md += `- In this system: \`window.ShadcnUI\` exports ${vals.map((v) => "`" + v + "`").join(", ")}.\n`
    const styled = new RegExp(`\\.cn-${f}[\\s{-]`).test(NOVA)
    md += `- Source: \`apps/v4/registry/bases/base/ui/${f}.tsx\`${styled ? `, styled by the \`cn-${f}*\` rules in \`style-nova.css\`` : ""}.\n`
    if (PREVIEW_NOTE[f]) md += `- ${PREVIEW_NOTE[f]}\n`
    md += `\n${body}\n`
  } else {
    md = `${Card}.\n`
  }
  if (Buffer.byteLength(md) > 64 * 1024) md = md.slice(0, 60 * 1024) + "\n\n…(trimmed; full docs at https://ui.shadcn.com/docs/components/base/" + f + ")\n"
  fs.writeFileSync(`${OUT}/components/${Card}/README.md`, md)

  // types
  let d = fs.readFileSync(`${ROOT}/dts/apps/v4/registry/bases/base/ui/${f}.d.ts`, "utf8")
  d = d.replace(/import\("@types\/react"\)/g, 'import("react")')
    .replace(/from "@\/registry\/bases\/base\/ui\/([^"]+)"/g, 'from "@/components/ui/$1"')
    .replace(/from "@\/registry\/bases\/base\/hooks\/([^"]+)"/g, 'from "@/hooks/$1"')
    .replace(/from "@\/app\/\(create\)\/components\/icon-placeholder"/g, 'from "lucide-react"')
    .replace(/^export \{\};\n?/m, "")
  const main = f === "sonner" ? "Toaster" : Card
  const indented = d.trim().split("\n").map((l) => "  " + l).join("\n")
  dts.push(`/** ${Card} · ${groupOf[f]} · window.ShadcnUI.${f === "sonner" ? "Sonner" : Card} */
declare module "@/components/ui/${f}" {
  import type * as React from "react";
${indented}
  export type ${Card}Props = React.ComponentProps<typeof ${main}>;
}`)
}

const header = `/* shadcn/ui · base-nova · component types, emitted by tsc from apps/v4/registry/bases/base/ui/*.tsx.
 * Documentation, not type-checked. In an app, each module is what \`npx shadcn@latest add <name>\` writes to
 * "@/components/ui/<name>". In this system every value export is also on window.ShadcnUI (sonner's Toaster is ShadcnUI.Sonner). */
`
fs.writeFileSync(`${OUT}/components/index.d.ts`, header + dts.join("\n\n") + "\n")
fs.writeFileSync(`${GEN}/card-order.json`, JSON.stringify(order))
console.log("cards", order.length, "index.d.ts", fs.statSync(`${OUT}/components/index.d.ts`).size)
