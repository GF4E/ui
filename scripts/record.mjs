// After a successful publish: commit what was published as the new baseline.
// Usage: node scripts/record.mjs <upstream-sha>
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const next = JSON.parse(fs.readFileSync(`${ROOT}/gen/next-state.json`, "utf8"))
fs.mkdirSync(`${ROOT}/state`, { recursive: true })
fs.writeFileSync(`${ROOT}/state/published.json`, JSON.stringify({ sha: process.argv[2], at: new Date().toISOString(), ...next }, null, 1) + "\n")
fs.copyFileSync(`${ROOT}/out/project/tokens.json`, `${ROOT}/state/tokens.last.json`)
console.log("recorded", Object.keys(next.files).length, "files at", process.argv[2])
