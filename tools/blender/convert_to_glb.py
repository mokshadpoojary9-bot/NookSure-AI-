"""Convert one .blend asset to a web-ready .glb.

Run with Blender in background mode (the .blend is opened read-only and never saved):

    blender -b --factory-startup <asset.blend> --python convert_to_glb.py -- <out.glb> [max_texture_px]

- Downscales every image texture to at most `max_texture_px` (default 1024) in memory.
- Exports a single binary glTF with textures embedded as JPEG; no Draco, no cameras/lights.
- Prints one line `NOOKSURE_RESULT {json}` with stats for the caller to verify.
"""

import json
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if not argv:
    print("usage: blender -b <asset.blend> --python convert_to_glb.py -- <out.glb> [max_px]")
    sys.exit(2)
out_path = os.path.abspath(argv[0])
max_px = int(argv[1]) if len(argv) > 1 else 1024

# 1) Downscale textures (in memory only — the source files are not modified).
images, missing = [], []
for img in bpy.data.images:
    if img.source != "FILE":
        continue
    w, h = img.size
    if w == 0 or h == 0:  # path didn't resolve / failed to load
        missing.append(img.filepath)
        continue
    if max(w, h) > max_px:
        s = max_px / max(w, h)
        img.scale(max(1, round(w * s)), max(1, round(h * s)))
    images.append({"name": img.name, "from": [w, h], "to": list(img.size)})

# 2) Stats on what will be exported.
deps = bpy.context.evaluated_depsgraph_get()
meshes, tris = 0, 0
lo, hi = [1e9] * 3, [-1e9] * 3
for ob in bpy.context.scene.objects:
    if ob.type != "MESH":
        continue
    meshes += 1
    ev = ob.evaluated_get(deps)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    tris += len(me.loop_triangles)
    for v in me.vertices:
        p = ev.matrix_world @ v.co
        for i in range(3):
            lo[i] = min(lo[i], p[i])
            hi[i] = max(hi[i], p[i])
    ev.to_mesh_clear()

# 3) Export. Only pass options this Blender version's exporter supports.
wanted = {
    "filepath": out_path,
    "export_format": "GLB",
    "export_image_format": "JPEG",
    "export_jpeg_quality": 85,
    "export_apply": True,
    "export_yup": True,
    "export_cameras": False,
    "export_lights": False,
    "export_draco_mesh_compression_enable": False,
}
supported = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
opts = {k: v for k, v in wanted.items() if k in supported}
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(**opts)

result = {
    "out": out_path,
    "bytes": os.path.getsize(out_path) if os.path.exists(out_path) else 0,
    "meshes": meshes,
    "triangles": tris,
    # Blender is Z-up: size is [x, y(depth), z(height)] in metres.
    "size_m": [round(hi[i] - lo[i], 3) for i in range(3)] if meshes else None,
    "images": images,
    "missing_images": missing,
    "unsupported_options": sorted(set(wanted) - supported),
}
print("NOOKSURE_RESULT " + json.dumps(result))
