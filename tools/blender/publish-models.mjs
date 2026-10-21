// Verify converted models and publish the good ones into the web app.
//
//   node tools/blender/publish-models.mjs [--work <dir>] [--exclude id1,id2]
//
// A model is published only if three.js parses it, it is under 5 MB, it stands on the
// floor and is centred, and its textures are embedded JPEG/PNG. Writes:
//   frontend/public/models/<room>/<id>.glb
//   frontend/src/components/room3d/models.manifest.json   (bundled: ids, sizes, credits)
(globalThis).ProgressEvent ??= class ProgressEvent extends Event { constructor(t, o = {}) { super(t); Object.assign(this, o); } };
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const arg = (n, d) => (process.argv.indexOf(n) > 0 ? process.argv[process.argv.indexOf(n) + 1] : d);
const WORK = arg("--work", path.join(os.homedir(), "Tools", "nooksure-assets"));
const exclude = new Set((arg("--exclude", "") ?? "").split(",").filter(Boolean));
const MAX_BYTES = 5 * 1024 * 1024;

const r = (p) => pathToFileURL(path.join(repo, "node_modules", p)).href;
const THREE = await import(r("three/build/three.module.js"));
const { GLTFLoader } = await import(r("three/examples/jsm/loaders/GLTFLoader.js"));

const { models, skipped } = JSON.parse(fs.readFileSync(path.join(here, "models.json"), "utf8"));
const results = JSON.parse(fs.readFileSync(path.join(WORK, "_results.json"), "utf8"));
const publicDir = path.join(repo, "frontend", "public", "models");

function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  const jl = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jl).toString("utf8"));
  const bs = 20 + jl;
  const bin = buf.subarray(bs + 8, bs + 8 + buf.readUInt32LE(bs));
  return { buf, json, bin };
}

async function verify(file) {
  const { buf, json, bin } = readGlb(file);
  const images = (json.images ?? []).map((im) => {
    const bv = json.bufferViews[im.bufferView];
    const h = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + 4);
    return (h[0] === 0xff && h[1] === 0xd8) || (h[0] === 0x89 && h[1] === 0x50);
  });
  const g = structuredClone(json);
  g.buffers = [{ byteLength: bin.length, uri: "data:application/octet-stream;base64," + Buffer.from(bin).toString("base64") }];
  for (const m of g.materials ?? []) {
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
    if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; }
    if (m.extensions) delete m.extensions;
  }
  delete g.textures; delete g.images; delete g.samplers;
  const scene = await new Promise((ok, no) => new GLTFLoader().parse(JSON.stringify(g), "", (x) => ok(x.scene), no));
  // precise=true: exact vertices (the default box is approximate for rotated parts).
  const box = new THREE.Box3().setFromObject(scene, true);
  const size = box.getSize(new THREE.Vector3());
  let tris = 0;
  scene.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  const problems = [];
  if (buf.length > MAX_BYTES) problems.push(`too large (${(buf.length / 1048576).toFixed(1)} MB)`);
  if (Math.abs(box.min.y) > 0.01) problems.push(`not on floor (minY ${box.min.y.toFixed(3)})`);
  if (Math.abs((box.min.x + box.max.x) / 2) > 0.02 || Math.abs((box.min.z + box.max.z) / 2) > 0.02) problems.push("not centred");
  if (images.some((ok) => !ok)) problems.push("bad embedded image");
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) problems.push("empty geometry");
  if (json.extensionsUsed?.some((e) => /draco|meshopt/i.test(e))) problems.push("compressed mesh (needs decoder)");
  return { bytes: buf.length, size: [size.x, size.y, size.z].map((v) => Number(v.toFixed(3))), tris, images: images.length, problems };
}

const manifest = { generated: new Date().toISOString().slice(0, 10), models: [], skipped: [...(skipped ?? [])] };
fs.mkdirSync(publicDir, { recursive: true });

for (const m of models) {
  const res = results[m.id];
  const file = path.join(WORK, "out", m.room, `${m.id}.glb`);
  if (exclude.has(m.id)) { manifest.skipped.push({ file: m.id, reason: "excluded after visual check" }); continue; }
  if (!res || res.status !== "converted" || !fs.existsSync(file)) {
    manifest.skipped.push({ file: m.id, reason: res?.reason ?? "not converted" });
    console.log(`SKIP ${m.id}: ${res?.reason ?? "not converted"}`);
    continue;
  }
  let v;
  try { v = await verify(file); } catch (e) { v = { problems: [`parse failed: ${e.message}`] }; }
  if (v.problems.length) {
    manifest.skipped.push({ file: m.id, reason: v.problems.join("; ") });
    console.log(`FAIL ${m.id}: ${v.problems.join("; ")}`);
    continue;
  }
  fs.mkdirSync(path.join(publicDir, m.room), { recursive: true });
  fs.copyFileSync(file, path.join(publicDir, m.room, `${m.id}.glb`));
  manifest.models.push({
    id: m.id,
    name: m.name,
    room: m.room,
    item: m.item,
    path: `models/${m.room}/${m.id}.glb`,
    bytes: v.bytes,
    // three.js / glTF axes: [width x, height y, depth z] in metres; base at y=0, centred.
    size: v.size,
    triangles: v.tris,
    source: m.source,
    author: m.author,
    license: m.license,
  });
  console.log(`PUB  ${m.id.padEnd(20)} ${(v.bytes / 1048576).toFixed(2)} MB  ${v.size.join("×")}  tris ${v.tris}`);
}

fs.writeFileSync(path.join(repo, "frontend", "src", "components", "room3d", "models.manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`\npublished ${manifest.models.length}, skipped ${manifest.skipped.length}`);
