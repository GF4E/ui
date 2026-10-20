// Decides what a re-sync publishes, keeping anything people edited on the page.
// Usage: node scripts/plan.mjs <live-dir>   (live-dir holds the system's current project/ files, read from the artifact)
// Reads state/published.json (what the last sync published) and out/project (the new build).
// Writes gen/plan.json: { send, pinned, newAssets, removed, tokens } and gen/next-state.json.
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const OUT = `${ROOT}/out/project`
const LIVE = path.resolve(process.argv[2] ?? "", "project")
const STATE = `${ROOT}/state/published.json`
const LAST_TOKENS = `${ROOT}/state/tokens.last.json`
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex")
const walk = (d, base = d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`, base) : [path.relative(base, `${d}/${e.name}`)]) : []

const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { files: {}, pinned: [] }
const pinned = new Set(state.pinned ?? [])
const built = walk(OUT).filter((p) => !(p.startsWith("assets/") && !p.endsWith(".md")) && p !== "design-system.json")
const send = [], kept = [], newAssets = []
const next = { files: {}, pinned: [] }

for (const p of built) {
  const nb = fs.readFileSync(`${OUT}/${p}`)
  const livePath = `${LIVE}/${p}`
  const lb = fs.existsSync(livePath) ? fs.readFileSync(livePath) : null
  const recorded = state.files[p]
  const editedOnPage = lb !== null && recorded && sha(lb) !== recorded
  if (p === "tokens.json" && lb !== null && (editedOnPage || pinned.has(p))) continue // merged below
  if (pinned.has(p) || editedOnPage) {
    kept.push(p)
    next.pinned.push(p)
    next.files[p] = sha(lb)
    continue
  }
  next.files[p] = sha(nb)
  if (lb === null || sha(lb) !== sha(nb)) send.push(p)
}

// tokens.json edited on the page: update only values nobody changed, add new tokens, keep the rest.
let tokens = { merged: false, changed: [], added: [], keptEdits: [], noLongerInSource: [] }
const liveTokensPath = `${LIVE}/tokens.json`
if (fs.existsSync(liveTokensPath) && state.files["tokens.json"] && sha(fs.readFileSync(liveTokensPath)) !== state.files["tokens.json"]) {
  const live = JSON.parse(fs.readFileSync(liveTokensPath, "utf8"))
  const built_ = JSON.parse(fs.readFileSync(`${OUT}/tokens.json`, "utf8"))
  const last = fs.existsSync(LAST_TOKENS) ? JSON.parse(fs.readFileSync(LAST_TOKENS, "utf8")) : built_
  const fams = ["color", "spacing", "radius"]
  for (const fam of fams) {
    const L = new Map((live[fam]?.tokens ?? []).map((t) => [t.name, t]))
    const P = new Map((last[fam]?.tokens ?? []).map((t) => [t.name, t]))
    for (const t of built_[fam]?.tokens ?? []) {
      const lt = L.get(t.name), pt = P.get(t.name)
      if (!lt) { live[fam].tokens.push(t); tokens.added.push(t.name); continue }
      if (JSON.stringify(lt.value) === JSON.stringify(pt?.value)) {
        if (JSON.stringify(lt.value) !== JSON.stringify(t.value)) { lt.value = t.value; tokens.changed.push(t.name) }
      } else tokens.keptEdits.push(t.name)
      if (lt.usage === pt?.usage) lt.usage = t.usage
    }
    for (const name of P.keys()) if (!(built_[fam]?.tokens ?? []).some((t) => t.name === name) && L.has(name)) tokens.noLongerInSource.push(name)
  }
  if (JSON.stringify(live.color.themes) === JSON.stringify(last.color.themes)) live.color.themes = built_.color.themes
  live.meta = built_.meta
  fs.writeFileSync(`${OUT}/tokens.json`, JSON.stringify(live, null, 2) + "\n")
  tokens.merged = true
  send.push("tokens.json")
  next.files["tokens.json"] = sha(fs.readFileSync(`${OUT}/tokens.json`))
}

// icons: SVGs the live index doesn't record yet need uploading
const liveIndex = fs.existsSync(`${LIVE}/design-system.json`) ? JSON.parse(fs.readFileSync(`${LIVE}/design-system.json`, "utf8")) : null
for (const p of walk(`${OUT}/assets`).filter((p) => p.endsWith(".svg"))) {
  const [group, ...rest] = p.split("/")
  if (!liveIndex?.assetGroups?.[group]?.files?.[rest.join("/")]) newAssets.push(`assets/${p}`)
}
const removed = Object.keys(state.files).filter((p) => !built.includes(p))
const plan = { send, pinned: kept, newAssets, removed, tokens }
fs.writeFileSync(`${ROOT}/gen/plan.json`, JSON.stringify(plan, null, 1))
fs.writeFileSync(`${ROOT}/gen/next-state.json`, JSON.stringify(next, null, 1))
console.log(`send ${send.length} · kept (edited on the page) ${kept.length} · new icons ${newAssets.length} · gone from source ${removed.length}${tokens.merged ? ` · tokens merged: ${tokens.changed.length} changed, ${tokens.added.length} added, ${tokens.keptEdits.length} page edits kept` : ""}`)
