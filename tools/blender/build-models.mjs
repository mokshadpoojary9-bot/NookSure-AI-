// Batch-convert the assets listed in models.json with Blender (one process per model).
// Sources: src.blendFolder / src.gltfFolder (extracted folders), src.zip, or src.glb (a loose .glb).
// Originals in Downloads are never modified: zips are extracted to WORK, .blend files are opened read-only.
//
//   node tools/blender/build-models.mjs [--only id1,id2] [--blender <path>] [--downloads <dir>] [--work <dir>]
//
// Writes WORK/out/<room>/<id>.glb, WORK/_thumbs/<id>.png and WORK/_results.json.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : def;
};
const home = os.homedir();
const DOWNLOADS = arg("--downloads", path.join(home, "Downloads"));
const WORK = arg("--work", path.join(home, "Tools", "nooksure-assets"));
const only = arg("--only", "")?.split(",").filter(Boolean);
const maxPx = Number(arg("--max-px", "1024"));

function findBlender() {
  const given = arg("--blender");
  if (given) return given;
  const base = "C:\\Program Files\\Blender Foundation";
  for (const d of fs.existsSync(base) ? fs.readdirSync(base) : []) {
    const exe = path.join(base, d, "blender.exe");
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error("blender.exe not found; pass --blender");
}

const findFile = (dir, re) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isFile() && re.test(e.name)) return p;
    if (e.isDirectory()) {
      const f = findFile(p, re);
      if (f) return f;
    }
  }
  return null;
};

function sourceFile(src) {
  if (src.glb) {
    const f = path.join(DOWNLOADS, src.glb);
    return fs.existsSync(f) ? f : null;
  }
  if (src.blendFolder) return findFile(path.join(DOWNLOADS, src.blendFolder), /\.blend$/i);
  if (src.gltfFolder) return findFile(path.join(DOWNLOADS, src.gltfFolder), /\.gltf$/i);
  if (src.zip) {
    const zip = path.join(DOWNLOADS, src.zip);
    if (!fs.existsSync(zip)) return null;
    const dest = path.join(WORK, "src", src.zip.replace(/\.zip$/i, ""));
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
      execFileSync("unzip", ["-q", "-o", zip, "-d", dest]);
    }
    return findFile(dest, /\.blend$/i) ?? findFile(dest, /\.gltf$/i) ?? findFile(dest, /\.glb$/i);
  }
  return null;
}

const { models } = JSON.parse(fs.readFileSync(path.join(here, "models.json"), "utf8"));
const blender = findBlender();
const script = path.join(here, "convert_to_glb.py");
fs.mkdirSync(path.join(WORK, "_thumbs"), { recursive: true });
const resultsFile = path.join(WORK, "_results.json");
const results = fs.existsSync(resultsFile) ? JSON.parse(fs.readFileSync(resultsFile, "utf8")) : {};

for (const m of models) {
  if (only.length && !only.includes(m.id)) continue;
  const src = sourceFile(m.src);
  if (!src) {
    results[m.id] = { status: "skipped", reason: "source not found" };
    console.log(`SKIP ${m.id}: source not found`);
    continue;
  }
  const out = path.join(WORK, "out", m.room, `${m.id}.glb`);
  const thumb = path.join(WORK, "_thumbs", `${m.id}.png`);
  const args = ["-b", "--factory-startup"];
  if (/\.blend$/i.test(src)) args.push(src);
  args.push("--python", script, "--", out, String(m.maxPx ?? maxPx), "--normalize", "--thumb", thumb);
  if (!/\.blend$/i.test(src)) args.push("--import", src);
  if (m.fitHeight) args.push("--fit-height", String(m.fitHeight));
  if (m.rotateDeg) args.push("--rotate-deg", String(m.rotateDeg));
  if (m.maxTris) args.push("--max-tris", String(m.maxTris));
  const t0 = Date.now();
  const run = spawnSync(blender, args, { encoding: "utf8", maxBuffer: 1 << 26 });
  const line = (run.stdout ?? "").split(/\r?\n/).find((l) => l.startsWith("NOOKSURE_RESULT "));
  if (!line) {
    const tail = `${run.stdout ?? ""}\n${run.stderr ?? ""}`.trim().split(/\r?\n/).slice(-6).join(" | ");
    results[m.id] = { status: "failed", reason: tail.slice(0, 400) };
    console.log(`FAIL ${m.id}: ${tail.slice(0, 300)}`);
  } else {
    const r = JSON.parse(line.slice("NOOKSURE_RESULT ".length));
    results[m.id] = { status: "converted", seconds: Math.round((Date.now() - t0) / 1000), src: path.basename(src), ...r };
    console.log(
      `OK   ${m.id.padEnd(20)} ${(r.bytes / 1048576).toFixed(2)} MB  tris ${r.triangles}${r.triangles !== r.triangles_before ? ` (from ${r.triangles_before})` : ""}  size ${r.size_m?.join("×")} m  imgs ${r.images}  ${results[m.id].seconds}s`,
    );
  }
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
}
