// Writes components/<Page>/preview.html and README.md for blocks, chart galleries and style pages.
import fs from "node:fs"

const ROOT = "/home/claude/dsbuild"
const REPO = "/home/claude/gf4e/ui"
const V4 = `${REPO}/apps/v4`
const OUT = `${ROOT}/out/project`
const GEN = `${ROOT}/gen`
const pages = JSON.parse(fs.readFileSync(`${GEN}/pages.json`, "utf8"))
const measured = JSON.parse(fs.readFileSync(`${GEN}/render-pages.json`, "utf8"))
const BLOCKS = `${V4}/registry/bases/base/blocks`
const CHARTS = `${V4}/registry/new-york-v4/charts`
const reg = fs.readFileSync(`${BLOCKS}/_registry.ts`, "utf8")
const STYLE_INFO = Object.fromEntries([...fs.readFileSync(`${V4}/registry/styles.tsx`, "utf8").matchAll(/name: "([a-z]+)",\s*title: "([^"]+)",\s*description: "([^"]+)"/g)].map((m) => [m[1], { title: m[2], description: m[3] }]))

function blockEntry(name) {
  const i = reg.indexOf(`    name: "${name}",`)
  const j = reg.indexOf("\n  },\n  {", i)
  const body = reg.slice(i, j < 0 ? undefined : j)
  return {
    title: body.match(/title: "([^"]+)"/)?.[1] ?? name,
    description: body.match(/description: "([^"]+)"/)?.[1],
    categories: [...(body.match(/categories: \[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]),
    files: [...body.matchAll(/path: "([^"]+)"/g)].map((m) => m[1]),
    deps: [...(body.match(/registryDependencies: \[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]),
  }
}
const width = (n) => (/^(Login|Signup)\d/.test(n) ? 1024 : /^Charts/.test(n) ? 1100 : 1280)
const write = (card, marker, head, js, md) => {
  if (/<\/script/i.test(js)) throw new Error("script close in " + card)
  const html = `${marker}
<!doctype html>
<html>
<head><meta charset="utf-8"><title>${card} — preview</title>${head}</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`
  if (html.length > 256 * 1024) throw new Error(`preview too big: ${card} ${html.length}`)
  fs.mkdirSync(`${OUT}/components/${card}`, { recursive: true })
  fs.writeFileSync(`${OUT}/components/${card}/preview.html`, html)
  fs.writeFileSync(`${OUT}/components/${card}/README.md`, md)
}

for (const [card, p] of Object.entries(pages)) {
  const js = fs.readFileSync(`${GEN}/pages/${card}.js`, "utf8")
  const m = measured[card]
  if (!m || m.errors.length) throw new Error(`no clean render for ${card}`)
  let h = m.light.rootH
  if (h === 900) h = 760 // full-viewport layouts (min-h-svh) take the card height
  h = Math.min(4000, Math.max(240, h))
  if (p.kind === "block") {
    const b = blockEntry(p.name)
    const sub = (b.description ?? b.title).replace(/"/g, "'")
    const md = `${b.description ?? `${b.title}.`}${/[.!?]$/.test(b.description ?? ".") ? "" : "."}

- Install: \`npx shadcn@latest add ${p.name}\`. It writes ${b.files.length} file${b.files.length === 1 ? "" : "s"}: ${b.files.map((f) => `\`${f}\``).join(", ")}.
- Built from: ${b.deps.length ? b.deps.map((d) => `\`${d}\``).join(", ") : "the components it imports"}.${b.categories.length ? `\n- Categories: ${b.categories.join(", ")}.` : ""}
- A page, not a component: it isn't in \`window.ShadcnUI\`. Edit the installed files to make it yours.${p.name.startsWith("preview") ? "\n- This is one of the showcase grids from `shadcn/create`. Create-page state (style, font, icon library) is fixed to the repo default here." : ""}
- Source: \`apps/v4/registry/bases/base/blocks/${p.name}\`.
`
    write(card, `<!-- @dsCard group="${p.group}" height=${h} width=${width(card)} page subtitle="${sub}" -->`, "", js, md)
  } else if (p.kind === "charts") {
    const rows = p.charts.map((c) => {
      const d = fs.readFileSync(`${CHARTS}/${c}.tsx`, "utf8").match(/export const description = "([^"]+)"/)?.[1] ?? ""
      return `| \`${c}\` | ${d} |`
    })
    const md = `${p.charts.length} ${p.name} chart recipes, each a \`Card\` wrapping \`ChartContainer\` and Recharts primitives.

- Install any one: \`npx shadcn@latest add ${p.charts[0]}\` (swap in the name below).
- Colour comes from \`chart-1\` to \`chart-5\` through each recipe's \`ChartConfig\`; switch the theme to see the accent palettes.
- Charts need the \`Recharts\` library global, which this system loads before the bundle.
- Source: \`apps/v4/registry/new-york-v4/charts\`. The recipes render here with the Base UI \`Card\` and \`ChartContainer\`, which share the new-york API.

| Recipe | What it shows |
| --- | --- |
${rows.join("\n")}
`
    write(card, `<!-- @dsCard group="Charts" height=${h} width=${width(card)} page subtitle="${p.charts.length} recipes" -->`, "", js, md)
  } else {
    const s = STYLE_INFO[p.name]
    const link = p.name === "nova" ? "" : `\n<link rel="stylesheet" href="../../components/styles/style-${p.name}.css">`
    const md = `${s.title}: ${s.description.replace(/\.$/, "")}.${p.name === "nova" ? " This is the default style for every component here." : ""}

- ${p.name === "nova" ? "Nova ships in `components/bundle.css` and applies wherever no other style class is set." : `Load \`components/styles/style-${p.name}.css\` after \`bundle.css\`, then add \`class="style-${p.name}"\` to \`<html>\` or a container.`}
- In an app, choose it at \`npx shadcn@latest init\` or in \`shadcn/create\`; \`components.json\` records \`"style": "base-${p.name}"\`.
- The page renders the repo's own docs demos (\`button-demo\`, \`badge-demo\`, \`switch-demo\`, \`input-demo\`, \`checkbox-demo\`, \`card-demo\` from \`apps/v4/examples/base\`) inside a \`style-${p.name}\` container.
- The Styles section compares all eight side by side.
`
    write(card, `<!-- @dsCard group="Styles" height=${h} width=1280 page subtitle="${s.description.replace(/"/g, "'")}" -->`, link, js, md)
  }
}
console.log("pages", Object.keys(pages).length)
