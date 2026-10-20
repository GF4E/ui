// Writes the brand-book sections under project/guides/ (path order = section order).
import fs from "node:fs"

const ROOT = "/home/claude/dsbuild"
const REPO = "/home/claude/gf4e/ui"
const V4 = `${REPO}/apps/v4`
const D = `${V4}/content/docs`
const OUT = `${ROOT}/out/project/guides`
const GEN = `${ROOT}/gen`
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

export function mdxToMd(src) {
  const fm = src.match(/^---\n([\s\S]*?)\n---\n/)
  const meta = {}
  if (fm) for (const l of fm[1].split("\n")) { const m = l.match(/^(\w+):\s*(.*)$/); if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, "") }
  let body = fm ? src.slice(fm[0].length) : src
  // strip inline SVG marks and JSX-only markup outside code fences
  body = body.split(/(```[\s\S]*?```)/).map((part, i) => (i % 2 ? part : part.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<(p|span|div)\b[^>]*>[^<]*<\/\1>/g, ""))).join("")
  const out = []
  let fence = false, inTag = false
  for (let line of body.split("\n")) {
    if (inTag) { if (/\/?>\s*$/.test(line)) inTag = false; continue }
    if (/^\s*```/.test(line)) { fence = !fence; out.push(line.replace(/^(\s*```\w*).*$/, "$1")); continue }
    if (fence) { out.push(line); continue }
    if (/^\s*<[A-Za-z][A-Za-z.]*\b[^>]*$/.test(line)) { inTag = true; continue }
    if (/^\s*<\/?[a-z][a-z0-9]*\b[^>]*>\s*$/.test(line)) continue
    if (/^\s*<\/?[A-Z][A-Za-z.]*\b[^>]*\/?>\s*$/.test(line)) continue
    if (/^\s*<\/?(div|figure|img|span|p|a)\b[^>]*\/?>\s*$/.test(line)) continue
    line = line.replace(/<\/?(Callout|Step|Kbd|Badge)[^>]*>/g, "")
    line = line.replace(/\]\(\/docs\//g, "](https://ui.shadcn.com/docs/").replace(/\]\(\/(create|blocks|charts|r)\b/g, "](https://ui.shadcn.com/$1")
    out.push(line)
  }
  body = out.join("\n")
  const secs = body.split(/\n(?=#{2,4} )/)
  body = secs.filter((s) => s.replace(/^#{2,4} .*\n?/, "").trim().length > 0 || !/^#{2,4} /.test(s)).join("\n")
  return { meta, body: body.replace(/\n{3,}/g, "\n\n").trim() }
}

function fromDoc(file, out, { title, drop = [] } = {}) {
  const { meta, body } = mdxToMd(fs.readFileSync(`${D}/${file}`, "utf8"))
  let b = body
  for (const h of drop) b = b.split(/\n(?=## )/).filter((s) => !new RegExp(`^## ${h}\\b`).test(s)).join("\n")
  const md = `# ${title ?? meta.title}\n\n${meta.description ? meta.description.replace(/\.?$/, ".") + "\n\n" : ""}${b}\n\n_From \`apps/v4/content/docs/${file}\`._\n`
  fs.writeFileSync(`${OUT}/${out}`, md)
  return md.length
}

// ---------- 01 Styles ----------
const STYLE_INFO = [...fs.readFileSync(`${V4}/registry/styles.tsx`, "utf8").matchAll(/name: "([a-z]+)",\s*title: "([^"]+)",\s*description: "([^"]+)"/g)].map((m) => ({ name: m[1], title: m[2], description: m[3] }))
const ORDER = ["nova", "vega", "maia", "lyra", "mira", "luma", "sera", "rhea"]
const rule = (st, cls) => {
  const css = fs.readFileSync(`${V4}/registry/styles/style-${st}.css`, "utf8")
  const m = css.match(new RegExp(`\\n  \\.${cls} \\{\\n\\s*@apply ([^;]*);`))
  return m ? m[1].split(/\s+/) : []
}
const pick = (classes, re) => classes.filter((c) => re.test(c) && !c.includes(":")).join(" ") || "–"
let styles = `# Styles

shadcn/ui ships eight visual styles over the same components. A style changes structure (heights, padding, radii, borders, rings, casing), never colour: colours always come from the tokens.

- **Nova is the default** and is in \`components/bundle.css\`. It applies wherever no other style class is set.
- **Switch style** by loading \`components/styles/style-<name>.css\` after \`bundle.css\` and adding \`class="style-<name>"\` to \`<html>\` or to any container. Styles can be mixed on one page by container.
- In an app, the style is chosen once at \`npx shadcn@latest init\` (or \`shadcn/create\`) and baked into the component files as \`base-<style>\` in \`components.json\`.
- The repo's presets pair Sera with the taupe palette and recommend mono fonts for Lyra. This system keeps Inter and the active colour theme for every style.

| Style | Class | What it is | Button | Input | Card | Badge | Dialog |
| --- | --- | --- | --- | --- | --- | --- | --- |
`
for (const n of ORDER) {
  const s = STYLE_INFO.find((x) => x.name === n)
  const btn = [...rule(n, "cn-button"), ...rule(n, "cn-button-size-default")]
  styles += `| ${s.title}${n === "nova" ? " (default)" : ""} | \`style-${n}\` | ${s.description} | ${pick(btn, /^(h-\d|rounded|px-|uppercase|tracking)/)} | ${pick(rule(n, "cn-input"), /^(h-\d|rounded|px-|bg-|border-b)/)} | ${pick(rule(n, "cn-card"), /^(rounded|ring-|border$|shadow|\[--card-spacing)/)} | ${pick(rule(n, "cn-badge"), /^(h-\d|rounded|uppercase)/)} | ${pick(rule(n, "cn-dialog-content"), /^(rounded|ring-|shadow|border$)/)} |\n`
}
styles += `\nEach style has a page under Styles showing the same demos (button, badge, switch, input, checkboxes, login card) in that style.\n\n_From \`apps/v4/registry/styles.tsx\` and \`apps/v4/registry/styles/style-*.css\`._\n`
fs.writeFileSync(`${OUT}/01-styles.md`, styles)

// ---------- 02 Color themes ----------
const THEMES = JSON.parse(fs.readFileSync(`${GEN}/themes.json`, "utf8"))
function oklchHex(s) {
  const m = s.match(/oklch\(([\d.]+%?) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+)%)?\)/)
  if (!m) return ""
  let L = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1])
  const C = parseFloat(m[2]), H = (parseFloat(m[3]) * Math.PI) / 180
  const a = C * Math.cos(H), b = C * Math.sin(H)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, ss = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss, -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * ss]
  const enc = (v) => { v = Math.min(1, Math.max(0, v)); return Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255) }
  return "#" + lin.map(enc).map((x) => x.toString(16).padStart(2, "0")).join("") + (m[4] ? ` at ${m[4]}%` : "")
}
const live = JSON.parse(fs.readFileSync(`${ROOT}/out/project/tokens.json`, "utf8")).color.themes.map((t) => t.id)
let ct = `# Color themes

Every colour theme in the repository, with exact values. Live in this system: ${live.map((x) => `\`${x}\``).join(", ")}.

- **Base colours** (neutral, stone, zinc, mauve, olive, mist, taupe) set every token. Pick one at \`init\` as \`tailwind.baseColor\`.
- **Accent themes** (amber to yellow) override only \`primary\`, \`secondary\`, the chart series and \`sidebar-primary\`, and sit on top of a base colour. \`buildRegistryTheme\` merges base colour, then theme, then the chart colour.
- To use one in an app, paste its values into \`:root\` and \`.dark\` in your global CSS, or pick it in \`shadcn/create\`.
- Hex values are the sRGB equivalents of the oklch source, for tools that need hex. The oklch value is the one to use.

`
for (const t of THEMES) {
  const kind = t.cssVars.light && Object.keys(t.cssVars.light).length > 20 ? "base colour" : "accent theme"
  ct += `## ${t.title}\n\n${kind[0].toUpperCase() + kind.slice(1)} \`${t.name}\`.\n\n| Token | Light | Dark |\n| --- | --- | --- |\n`
  const keys = [...new Set([...Object.keys(t.cssVars.light ?? {}), ...Object.keys(t.cssVars.dark ?? {})])]
  for (const k of keys) {
    const lv = t.cssVars.light?.[k], dv = t.cssVars.dark?.[k]
    const cell = (v) => (v ? `\`${v}\`${/oklch/.test(v) ? ` ${oklchHex(v)}` : ""}` : "–")
    ct += `| \`${k}\` | ${cell(lv)} | ${cell(dv)} |\n`
  }
  ct += "\n"
}
ct += `_From \`apps/v4/registry/themes.ts\` and \`buildRegistryTheme\` in \`apps/v4/registry/config.ts\`._\n`
fs.writeFileSync(`${OUT}/02-color-themes.md`, ct)

// ---------- docs from the repo ----------
const sizes = {
  "03-theming.md": fromDoc("(root)/theming.mdx", "03-theming.md"),
  "04-dark-mode.md": fromDoc("dark-mode/next.mdx", "04-dark-mode.md", { title: "Dark mode" }),
  "06-typeset.md": fromDoc("(root)/typeset.mdx", "06-typeset.md"),
  "08-react-hook-form.md": fromDoc("forms/react-hook-form.mdx", "08-react-hook-form.md"),
  "09-tanstack-form.md": fromDoc("forms/tanstack-form.mdx", "09-tanstack-form.md"),
  "10-rtl.md": fromDoc("rtl/index.mdx", "10-rtl.md"),
  "11-new-project.md": fromDoc("(root)/new.mdx", "11-new-project.md", { title: "New project" }),
  "12-installation-next.md": fromDoc("installation/next.mdx", "12-installation-next.md", { title: "Install: Next.js" }),
  "13-installation-vite.md": fromDoc("installation/vite.mdx", "13-installation-vite.md", { title: "Install: Vite" }),
  "14-cli.md": fromDoc("(root)/cli.mdx", "14-cli.md"),
  "15-components-json.md": fromDoc("(root)/components-json.mdx", "15-components-json.md"),
  "16-tailwind-v4.md": fromDoc("(root)/tailwind-v4.mdx", "16-tailwind-v4.md"),
  "17-react-19.md": fromDoc("(root)/react-19.mdx", "17-react-19.md"),
  "18-monorepo.md": fromDoc("(root)/monorepo.mdx", "18-monorepo.md"),
  "19-package-imports.md": fromDoc("(root)/package-imports.mdx", "19-package-imports.md"),
  "20-registry.md": fromDoc("registry/getting-started.mdx", "20-registry.md", { title: "Registry" }),
  "21-mcp.md": fromDoc("(root)/mcp.mdx", "21-mcp.md"),
  "22-skills.md": fromDoc("(root)/skills.mdx", "22-skills.md"),
}

// ---------- 23 Blocks and charts ----------
const pages = JSON.parse(fs.readFileSync(`${GEN}/pages.json`, "utf8"))
const reg = fs.readFileSync(`${V4}/registry/bases/base/blocks/_registry.ts`, "utf8")
const blockDesc = Object.fromEntries([...reg.matchAll(/name: "([a-z0-9-]+)",\s*title: "([^"]+)",(?:\s*description: "([^"]*)",)?/g)].map((m) => [m[1], m[3] ?? m[2]]))
let bc = `# Blocks and charts

Whole layouts and chart recipes built from the components. Each one has a live page in this system; install any of them into an app with the shadcn CLI.

## Blocks

| Page | Block | What it is | Install |
| --- | --- | --- | --- |
`
for (const [card, p] of Object.entries(pages)) if (p.kind === "block") bc += `| ${card} | \`${p.name}\` | ${blockDesc[p.name] ?? ""} | \`npx shadcn@latest add ${p.name}\` |\n`
bc += `\n\`preview\` and \`preview-02\` are the showcase grids from \`shadcn/create\`. Blocks render the Nova style and whichever colour theme is active.\n\n## Charts\n\nCharts are Recharts compositions inside \`ChartContainer\`, coloured by \`chart-1\` to \`chart-5\`.\n\n| Page | Charts | Install one |\n| --- | --- | --- |\n`
for (const [card, p] of Object.entries(pages)) if (p.kind === "charts") bc += `| ${card} | ${p.charts.length}: ${p.charts.map((c) => `\`${c}\``).join(", ")} | \`npx shadcn@latest add ${p.charts[0]}\` |\n`
bc += `\nThe chart recipes live in the repo's new-york-v4 set; here they render with the Base UI \`Card\` and \`ChartContainer\`, which share their API.\n\n_From \`apps/v4/registry/bases/base/blocks\` and \`apps/v4/registry/new-york-v4/charts\`._\n`
fs.writeFileSync(`${OUT}/23-blocks-and-charts.md`, bc)

for (const f of fs.readdirSync(OUT)) {
  const n = fs.statSync(`${OUT}/${f}`).size
  if (n > 200 * 1024) throw new Error(`${f} over 200 KB`)
  console.log(f.padEnd(26), n)
}
