// Emulates the Design System preview frame: tokens.css + bundle.css + libraries + bundle.js, then the preview body.
// Usage: node scripts/render.mjs measure|check [names,comma] [--shots]
import { chromium } from "playwright-core"
import fs from "node:fs"

const ROOT = "/home/claude/dsbuild"
const OUT = `${ROOT}/out/project`
const GEN = `${ROOT}/gen`
const mode = process.argv[2] || "check"
const only = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3].split(",") : null
const shots = process.argv.includes("--shots")
const WIDTH = 760
const WIDE = { sidebar: 1100, Sidebar: 1100, Cover: 960 }
const pageWidth = (n) => (/^(Login|Signup)\d/.test(n) ? 1024 : /^Charts/.test(n) ? 1100 : /^(Dashboard|Sidebar\d|Preview|Style[A-Z])/.test(n) ? 1280 : null)

// tokens.css "as compiled" (format.md), for local rendering only.
function tokensCss() {
  const t = JSON.parse(fs.readFileSync(`${OUT}/tokens.json`, "utf8"))
  const [first, ...rest] = t.color.themes.map((x) => x.id)
  const val = (tok, th) => (typeof tok.value === "string" ? (th === first ? tok.value : null) : tok.value[th])
  const conv = (v) => (/^\{(.+)\}$/.test(v) ? `var(--${v.slice(1, -1)})` : v)
  let css = `:root, [data-theme="${first}"] {\n${t.color.tokens.map((k) => `  --${k.name}: ${conv(val(k, first))};`).join("\n")}\n}\n`
  for (const th of rest) css += `[data-theme="${th}"] {\n${t.color.tokens.filter((k) => val(k, th)).map((k) => `  --${k.name}: ${conv(val(k, th))};`).join("\n")}\n}\n`
  const other = [...(t.spacing?.tokens ?? []), ...(t.radius?.tokens ?? [])]
  css += `:root {\n${other.map((k) => `  --${k.name}: ${k.value};`).join("\n")}\n${Object.entries(t.type.families).map(([k, v]) => `  --font-${k}: ${v};`).join("\n")}\n}\n`
  return css
}

function frame(previewHtml, theme) {
  const libs = ["react", "react-dom", "recharts", "sonner"].map((n) => `<script>${fs.readFileSync(`${OUT}/components/lib/${n}.production.min.js`, "utf8")}</script>`).join("\n")
  const body = previewHtml.replace(/^<!--[^\n]*-->\n/, "").replace(/<!doctype html>/i, "")
  const bodyInner = body.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? body
  let headInner = (body.match(/<head[^>]*>([\s\S]*)<\/head>/i)?.[1] ?? "").replace(/<title>[\s\S]*?<\/title>/i, "")
  headInner = headInner.replace(/<link rel="stylesheet" href="\.\.\/\.\.\/([^"]+)">/g, (_, f) => `<style>${fs.readFileSync(`${OUT}/${f}`, "utf8")}</style>`)
  if (/__STYLES__/.test(previewHtml)) headInner += fs.readdirSync(`${OUT}/components/styles`).map((f) => `<style>${fs.readFileSync(`${OUT}/components/styles/${f}`, "utf8")}</style>`).join("")
  return `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8">
<style>${tokensCss()}</style>
<style>${fs.readFileSync(`${OUT}/components/bundle.css`, "utf8")}</style>
${libs}
<script>${fs.readFileSync(`${OUT}/components/bundle.js`, "utf8")}</script>
${headInner}
</head><body>${bodyInner}</body></html>`
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" })
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: 1 })
const results = {}
fs.mkdirSync(`${GEN}/shots`, { recursive: true })

const DIR = mode === "probe" ? "probe" : mode === "pages" ? "pages" : "previews"
const targets = mode === "measure" || mode === "probe" || mode === "pages"
  ? fs.readdirSync(`${GEN}/${DIR}`).filter((f) => f.endsWith(".js")).map((f) => f.replace(".js", ""))
  : fs.readdirSync(`${OUT}/components`).filter((d) => fs.existsSync(`${OUT}/components/${d}/preview.html`))

for (const name of targets) {
  if (only && !only.includes(name)) continue
  const html = mode === "measure" || mode === "probe" || mode === "pages"
    ? `${/^Style[A-Z]/.test(name) ? "<!--__STYLES__-->" : ""}<div id="root"></div><script>${fs.readFileSync(`${GEN}/${DIR}/${name}.js`, "utf8")}</script>`
    : fs.readFileSync(`${OUT}/components/${name}/preview.html`, "utf8")
  const r = { errors: [] }
  const W = WIDE[name.split("__")[0]] ?? pageWidth(name) ?? WIDTH
  await ctx.close().catch(() => {})
  for (const theme of mode === "check" ? (process.env.THEMES || "light,dark").split(",") : ["light"]) {
    const page = await browser.newPage({ viewport: { width: W, height: 900 } })
    page.on("pageerror", (e) => r.errors.push(`${theme}: ${e.message.slice(0, 200)}`))
    page.on("console", (m) => { if (m.type() === "error") r.errors.push(`${theme} console: ${m.text().slice(0, 200)}`) })
    await page.setContent(frame(html, theme), { waitUntil: "load" })
    await page.waitForTimeout(400)
    const m = await page.evaluate(() => {
      const root = document.getElementById("root") || document.body.firstElementChild
      const sections = [...document.querySelectorAll("[data-section]")].map((s) => ({ name: s.dataset.section, h: Math.ceil(s.getBoundingClientRect().height) }))
      const text = (root?.innerText || "").trim().length
      return { height: Math.ceil(document.documentElement.scrollHeight), rootH: Math.ceil(root?.getBoundingClientRect().height || 0), sections, text, overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 }
    })
    r[theme] = m
    if (shots) await page.screenshot({ path: `${GEN}/shots/${name}-${theme}.png`, fullPage: true })
    await page.close()
  }
  results[name] = r
  const L = r.light ?? r[Object.keys(r).find((k) => k !== "errors")]
  console.log(name.padEnd(18), String(L.rootH).padStart(5), "text", String(L.text).padStart(5), L.overflowX ? "OVERFLOW-X" : "", r.errors.length ? "ERR " + r.errors[0] : "")
}
fs.writeFileSync(`${GEN}/render-${mode}.json`, JSON.stringify(results, null, 1))
await browser.close()
