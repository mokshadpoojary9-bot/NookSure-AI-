"""Convert one 3D asset (.blend, .gltf or .glb) to a web-ready, normalized .glb.

Run with Blender in background mode. Sources are opened read-only and never saved.

  .blend:  blender -b --factory-startup <asset.blend> --python convert_to_glb.py -- <out.glb> [max_px] [options]
  .gltf:   blender -b --factory-startup --python convert_to_glb.py -- <out.glb> [max_px] --import <scene.gltf> [options]

Options:
  --normalize          base on the floor (z=0), centred on x/y (Blender units = metres)
  --fit-height H       uniformly scale so the model is H metres tall (for assets in odd units)
  --rotate-deg D       turn about the vertical axis (so the front faces Blender -Y = glTF +Z)
  --max-tris N         decimate dense meshes to about N triangles in total
  --thumb out.png      render a small front preview (camera on the front, -Y side)

- Downscales every image texture to at most `max_px` (default 1024) in memory.
- Exports one binary glTF, textures embedded as JPEG; no Draco, cameras or lights.
- Prints one line `NOOKSURE_RESULT {json}` with stats for the caller to verify.
"""

import json
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if not argv:
    print("usage: see docstring")
    sys.exit(2)


def opt(name, cast=str, default=None):
    if name in argv:
        i = argv.index(name)
        return cast(argv[i + 1]) if cast is not bool else True
    return default


out_path = os.path.abspath(argv[0])
max_px = int(argv[1]) if len(argv) > 1 and argv[1].isdigit() else 1024
import_path = opt("--import")
normalize = "--normalize" in argv
fit_height = opt("--fit-height", float)
rotate_deg = opt("--rotate-deg", float, 0.0)
max_tris = opt("--max-tris", int)
thumb = opt("--thumb")

# 0) Load a glTF source into an empty scene.
if import_path:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(import_path))

scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == "MESH"]


def world_bounds():
    deps = bpy.context.evaluated_depsgraph_get()
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    tris = 0
    # Only objects that will be exported (hidden ones are skipped by the exporter).
    for ob in [o for o in scene.objects if o.type == "MESH" and o.visible_get()]:
        ev = ob.evaluated_get(deps)
        me = ev.to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        for v in me.vertices:
            p = ev.matrix_world @ v.co
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
        ev.to_mesh_clear()
    return lo, hi, tris


# 1) Downscale textures (in memory only — the source files are not modified).
images, missing = [], []
for img in bpy.data.images:
    if img.source != "FILE":
        continue
    w, h = img.size
    if w == 0 or h == 0:
        missing.append(img.filepath)
        continue
    if max(w, h) > max_px:
        s = max_px / max(w, h)
        img.scale(max(1, round(w * s)), max(1, round(h * s)))
    images.append({"name": img.name, "from": [w, h], "to": list(img.size)})

lo, hi, tris_before = world_bounds()

# 2) Simplify very dense meshes.
if max_tris and tris_before > max_tris:
    ratio = max(0.02, max_tris / tris_before)
    for ob in meshes:
        mod = ob.modifiers.new("nooksure_decimate", "DECIMATE")
        mod.ratio = ratio

# 3) Normalize: put everything under one root, then scale / turn / place on the floor.
if normalize or fit_height or rotate_deg:
    root = bpy.data.objects.new("nooksure_root", None)
    scene.collection.objects.link(root)
    for ob in list(scene.objects):
        if ob is not root and ob.parent is None:
            mw = ob.matrix_world.copy()
            ob.parent = root
            ob.matrix_world = mw
    bpy.context.view_layer.update()
    if fit_height:
        lo, hi, _ = world_bounds()
        height = hi.z - lo.z
        if height > 0:
            root.scale = (fit_height / height,) * 3
    if rotate_deg:
        root.rotation_euler = (0, 0, math.radians(rotate_deg))
    bpy.context.view_layer.update()
    lo, hi, _ = world_bounds()
    root.location = root.location - Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    bpy.context.view_layer.update()

lo, hi, tris_after = world_bounds()

# 4) Optional front preview (Workbench is fast and needs no lights).
if thumb:
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "TEXTURE"
    scene.render.resolution_x = scene.render.resolution_y = 320
    scene.render.film_transparent = False
    world = scene.world or bpy.data.worlds.new("w")
    scene.world = world
    center = (lo + hi) / 2
    size = max((hi - lo).length, 0.1)
    cam_data = bpy.data.cameras.new("thumb_cam")
    cam = bpy.data.objects.new("thumb_cam", cam_data)
    scene.collection.objects.link(cam)
    # Front is Blender -Y (exports as glTF +Z). View from front-right, slightly above.
    cam.location = center + Vector((0.45, -1.0, 0.55)).normalized() * size * 1.6
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.lens = 50
    scene.camera = cam
    scene.render.filepath = os.path.abspath(thumb)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)

# 5) Export. Only pass options this Blender version's exporter supports.
wanted = {
    "filepath": out_path,
    "export_format": "GLB",
    "export_image_format": "JPEG",
    "export_jpeg_quality": 80,
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
    "meshes": len(meshes),
    "triangles": tris_after,
    "triangles_before": tris_before,
    # Blender is Z-up: size is [x, y(depth), z(height)] in metres.
    "size_m": [round(hi[i] - lo[i], 3) for i in range(3)] if meshes else None,
    "min_z": round(lo.z, 4) if meshes else None,
    "images": len(images),
    "missing_images": missing,
    "unsupported_options": sorted(set(wanted) - supported),
}
print("NOOKSURE_RESULT " + json.dumps(result))
