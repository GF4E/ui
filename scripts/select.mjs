// Picks which of each example's sections the preview mounts: in the repo's order, up to ~1000px.
import fs from "node:fs"
const m = JSON.parse(fs.readFileSync("/home/claude/dsbuild/gen/render-measure.json", "utf8"))
const probe = fs.existsSync("/home/claude/dsbuild/gen/render-probe.json") ? JSON.parse(fs.readFileSync("/home/claude/dsbuild/gen/render-probe.json", "utf8")) : {}
for (const [k, r] of Object.entries(probe)) {
  const [f, name] = k.split("__")
  if (r.errors.length) continue
  // a section whose script alone nears the 256 KB preview cap can't ship
  const pf = `/home/claude/dsbuild/gen/probe/${k}.js`
  if (fs.existsSync(pf) && fs.statSync(pf).size > 200 * 1024) continue
  m[f] ??= { light: { sections: [] } }
  if (!m[f].light.sections.length || m[f].fromProbe) { m[f].fromProbe = true; m[f].light.sections.push({ name, h: r.light.rootH - 40 }) }
}
// keep the repo's section order for probed files
const info = fs.existsSync("/home/claude/dsbuild/gen/order.json") ? JSON.parse(fs.readFileSync("/home/claude/dsbuild/gen/order.json", "utf8")) : {}
for (const [f, r] of Object.entries(m)) if (r.fromProbe && info[f]) r.light.sections.sort((a, b) => info[f].indexOf(a.name) - info[f].indexOf(b.name))
const EXCLUDE = { "code-block": ["CodeBlockMarkdown", "CodeBlockStreamed"], trace: ["TraceChat", "TraceReasoning"] }
const BUDGET = 1000, MAX = 6
const out = {}
for (const [f, r] of Object.entries(m)) {
  const secs = (r.light?.sections ?? []).filter((s) => !(EXCLUDE[f] ?? []).includes(s.name))
  if (!secs.length) continue
  const pick = []
  let total = 0
  for (const s of secs) {
    if (pick.length && (total + s.h > BUDGET || pick.length >= MAX)) break
    pick.push(s.name); total += s.h
  }
  out[f] = pick
}
for (const f of Object.keys(m)) if (!out[f]) console.log("no usable section:", f)
fs.writeFileSync("/home/claude/dsbuild/gen/sections.json", JSON.stringify(out, null, 1))
console.log(Object.entries(out).map(([f, p]) => `${f}: ${p.length}`).join("  "))
