"""Fit reusable compact-car geometry and project four observed views onto an atlas.

This is geometry fitting, not learned reconstruction. Unobserved texels stay gray.
"""
import argparse
import json
from pathlib import Path
import time

import numpy as np
from PIL import Image, ImageDraw
import torch
import trimesh
import nvdiffrast.torch as dr
from scipy.ndimage import distance_transform_edt

from reference import digest

DIRECTIONS = ["east", "west", "north", "south"]
U = [[-1, 0], [1, 0], [0, 1], [0, -1]]
G = [[0, -1], [0, 1], [-1, 0], [1, 0]]


def mesh_parameters(values):
    s = torch.sigmoid(values)
    width = .55 + .7 * s[0]
    base = .08 + .18 * s[1]
    belt = base + .23 + .3 * s[2]
    roof = belt + .2 + .4 * s[3]
    rear = -.75 + .5 * s[4]
    front = .05 + .5 * s[5]
    radius = .12 + .18 * s[6]
    axle = .5 + .3 * s[7]
    taper = .65 + .3 * s[8]
    zero = values.sum() * 0
    verts, faces = [], []
    xs = [-1 + zero, -.86 + zero, rear, front, .75 + zero, 1 + zero]
    tops = [belt - .04, belt, roof, roof, belt, belt - .08]
    widths = [width * .42, width * .5, width * .5 * taper, width * .5 * taper, width * .5, width * .43]
    for x, z, w in zip(xs, tops, widths):
        verts.extend([torch.stack([x, -width / 2, base]), torch.stack([x, width / 2, base]), torch.stack([x, w, z]), torch.stack([x, -w, z])])
    for section in range(5):
        for edge in range(4):
            a, b = section * 4 + edge, section * 4 + (edge + 1) % 4
            faces.extend([[a, b, b + 4], [a, b + 4, a + 4]])
    faces.extend([[0, 2, 1], [0, 3, 2], [20, 21, 22], [20, 22, 23]])
    for xsign in [-1, 1]:
        for ysign in [-1, 1]:
            start = len(verts)
            for side in [-1, 1]:
                for k in range(16):
                    angle = values.new_tensor(k * 2 * np.pi / 16)
                    verts.append(torch.stack([xsign * axle + radius * torch.cos(angle), ysign * width / 2 + side * .065, radius + radius * torch.sin(angle)]))
            for k in range(16):
                a, b = start + k, start + (k + 1) % 16
                faces.extend([[a, b, b + 16], [a, b + 16, a + 16]])
            for side in [0, 16]:
                for k in range(1, 15):
                    faces.append([start + side, start + side + k, start + side + k + 1])
    return torch.stack(verts), torch.tensor(faces, dtype=torch.int32, device=values.device)


def cameras(values, initial):
    elevation = torch.sigmoid(values[:, 0]) * np.deg2rad(65) + np.deg2rad(15)
    scale = initial[:, 0] * torch.exp(values[:, 1] * .25)
    offsets = initial[:, 1:] + values[:, 2:] * 12
    return elevation, scale, offsets


def project(vertices, camera, view):
    elevation, scale, offsets = camera
    uaxis = vertices.new_tensor(U[view])
    gaxis = vertices.new_tensor(G[view])
    horizontal = vertices[:, :2] @ uaxis
    ground = vertices[:, :2] @ gaxis
    row = torch.sin(elevation[view]) * ground - torch.cos(elevation[view]) * vertices[:, 2]
    depth = torch.cos(elevation[view]) * ground + torch.sin(elevation[view]) * vertices[:, 2]
    return torch.stack([horizontal * scale[view] + offsets[view, 0], row * scale[view] + offsets[view, 1], depth], dim=-1)


def render(context, vertices, faces, camera, view, size=128):
    projected = project(vertices, camera, view)
    clip = torch.stack([projected[:, 0] * 2 / size - 1, 1 - projected[:, 1] * 2 / size, -projected[:, 2] / 4, torch.ones_like(projected[:, 0])], dim=-1)[None]
    rast, _ = dr.rasterize(context, clip.contiguous(), faces, [size, size])
    mask = dr.antialias((rast[..., 3:] > 0).float(), rast, clip.contiguous(), faces)[0, :, :, 0].flip(0)
    depth, _ = dr.interpolate(projected[None, :, 2:3].contiguous(), rast, faces)
    return mask, depth[0, :, :, 0].flip(0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--id", default="fitted-car-001")
    args = parser.parse_args()
    torch.set_num_threads(6)
    directory = args.bundle / "runs" / args.id
    directory.mkdir(parents=True, exist_ok=False)
    start = time.perf_counter()
    manifest_path = args.bundle / "inputs.json"
    manifest = json.loads(manifest_path.read_text())
    source_images, targets, weights, initial = [], [], [], []
    for direction in DIRECTIONS:
        entry = next(x for x in manifest["inputs"] if x["id"] == f"compact-1-{direction}")
        path = args.bundle / entry["enlarged"]
        if digest(path) != entry["enlargedSha256"]:
            raise RuntimeError("Frozen direction changed")
        image = np.array(Image.open(path).convert("RGBA").resize((128, 128), Image.Resampling.NEAREST))
        target = image[:, :, 3] > 128
        yy, xx = np.nonzero(target)
        scale = (xx.max() - xx.min()) / (2 if direction in ("east", "west") else .9)
        initial.append([scale, (xx.max() + xx.min()) / 2, (yy.max() + yy.min()) / 2 + scale * .35])
        targets.append(target.astype(np.float32))
        weights.append(1 + np.minimum(distance_transform_edt(~target), 20) / 8)
        source_images.append(image)
    target = torch.tensor(np.array(targets), device="cuda")
    provider_sheet = Image.new("RGB", (4 * 320, 320), "#19222c")
    for i, direction in enumerate(DIRECTIONS):
        preview = Image.fromarray(source_images[i]).resize((256, 256), Image.Resampling.NEAREST)
        provider_sheet.paste(preview, (i * 320 + 32, 45), preview)
        ImageDraw.Draw(provider_sheet).text((i * 320 + 16, 15), f"{direction}: genuine input", fill="white")
    provider_sheet.save(directory / "provider-input.png")
    weight = torch.tensor(np.array(weights), dtype=torch.float32, device="cuda")
    initial = torch.tensor(initial, dtype=torch.float32, device="cuda")
    context = dr.RasterizeCudaContext()
    best = None
    history = []
    for restart in [0, 1]:
        shape = torch.zeros(9, device="cuda", requires_grad=True)
        camera_values = torch.zeros((4, 4), device="cuda", requires_grad=True)
        with torch.no_grad():
            camera_values[:, 0] = torch.tensor([-.2, -.2, 1.2, 1.2], device="cuda") + restart * .6
        optimizer = torch.optim.Adam([shape, camera_values], lr=.035)
        for step in range(180):
            optimizer.zero_grad()
            vertices, faces = mesh_parameters(shape)
            camera = cameras(camera_values, initial)
            masks = torch.stack([render(context, vertices, faces, camera, i)[0] for i in range(4)])
            loss = ((masks - target).square() * weight).mean() + shape.square().mean() * .00015 + camera_values[:, 1].square().mean() * .002
            loss.backward()
            optimizer.step()
            if step % 30 == 0:
                history.append({"restart": restart, "step": step, "loss": float(loss.detach())})
        score = float(loss.detach())
        if best is None or score < best[0]:
            best = score, shape.detach().clone(), camera_values.detach().clone()
    score, shape, camera_values = best
    vertices, faces = mesh_parameters(shape)
    camera = cameras(camera_values, initial)
    raw_vertices, raw_faces = vertices.cpu().numpy(), faces.cpu().numpy()
    mesh = trimesh.Trimesh(raw_vertices, raw_faces, process=False)
    mesh.fix_normals()
    raw_faces = mesh.faces.astype(np.int32)
    faces = torch.tensor(raw_faces, device="cuda", dtype=torch.int32)
    raw = directory / "raw.glb"
    mesh.export(raw)
    np.savez_compressed(directory / "raw.npz", vertices=raw_vertices, faces=raw_faces)
    view_records, depths = [], []
    sheet = Image.new("RGB", (4 * 320, 700), "#19222c")
    for i, direction in enumerate(DIRECTIONS):
        mask, depth = render(context, vertices, faces, camera, i)
        fit = mask.detach().cpu().numpy() > .5
        truth = targets[i] > 0
        iou = int((fit & truth).sum()) / int((fit | truth).sum())
        overlay = np.zeros((128, 128, 4), dtype=np.uint8)
        overlay[truth & ~fit] = [245, 95, 85, 255]
        overlay[fit & ~truth] = [75, 155, 245, 255]
        overlay[truth & fit] = [150, 215, 160, 255]
        image = Image.fromarray(source_images[i]).resize((256, 256), Image.Resampling.NEAREST)
        sheet.paste(image, (i * 320 + 32, 42), image)
        image = Image.fromarray(overlay).resize((256, 256), Image.Resampling.NEAREST)
        sheet.paste(image, (i * 320 + 32, 360), image)
        ImageDraw.Draw(sheet).text((i * 320 + 16, 15), f"{direction}: genuine source", fill="white")
        ImageDraw.Draw(sheet).text((i * 320 + 16, 327), f"silhouette IoU {iou:.3f}", fill="white")
        view_records.append({"direction": direction, "uGroundAxis": U[i], "groundDownAxis": G[i], "elevationDegrees": float(camera[0][i].cpu()) * 180 / np.pi, "scale": float(camera[1][i].cpu()), "offset": camera[2][i].cpu().tolist(), "silhouetteIou": iou})
        depths.append(depth.detach().cpu().numpy())
    ImageDraw.Draw(sheet).text((16, 655), "Green: overlap. Red: source only. Blue: fitted only. Alpha includes original painted shadows.", fill="white")
    sheet.save(directory / "fit-sheet.png")
    # One triangle per atlas cell: original colors projected through fitted cameras.
    cell, columns = 32, int(np.ceil(np.sqrt(len(raw_faces))))
    atlas_size = columns * cell
    atlas = np.full((atlas_size, atlas_size, 4), [155, 155, 155, 255], dtype=np.uint8)
    uv, flat_vertices, flat_faces = [], [], []
    covered, total = 0, 0
    normals = mesh.face_normals
    yy, xx = np.mgrid[:cell, :cell]
    bary1, bary2 = (xx - 2) / (cell - 5), (yy - 2) / (cell - 5)
    bary0 = 1 - bary1 - bary2
    inside = (bary0 >= 0) & (bary1 >= 0) & (bary2 >= 0)
    bary = np.stack([bary0[inside], bary1[inside], bary2[inside]], axis=1)
    camera_np = tuple(x.detach().cpu().numpy() for x in camera)
    for fi, face in enumerate(raw_faces):
        xcell, ycell = fi % columns, fi // columns
        points = bary @ raw_vertices[face]
        point_tensor = torch.tensor(points, dtype=torch.float32, device="cuda")
        colors = np.full((len(points), 4), [155, 155, 155, 255], dtype=np.uint8)
        quality = np.full(len(points), -1.)
        for vi in range(4):
            projected = project(point_tensor, camera, vi).cpu().numpy()
            px = np.clip(np.round(projected[:, 0]).astype(int), 0, 127)
            py = np.clip(np.round(projected[:, 1]).astype(int), 0, 127)
            g = np.array([*G[vi], 0.])
            facing = np.cos(camera_np[0][vi]) * g + np.array([0, 0, np.sin(camera_np[0][vi])])
            angle = float(normals[fi] @ facing)
            visible = (np.abs(projected[:, 2] - depths[vi][py, px]) < .06) & (source_images[vi][py, px, 3] > 128) & (angle > .05)
            better = visible & (angle > quality)
            colors[better] = source_images[vi][py[better], px[better]]
            quality[better] = angle
        patch = atlas[ycell * cell:(ycell + 1) * cell, xcell * cell:(xcell + 1) * cell]
        patch[inside] = colors
        covered += int((quality >= 0).sum())
        total += len(points)
        # Dilate atlas colors into a 2px seam margin, without inventing unseen-face colors.
        from scipy.ndimage import distance_transform_edt as distance
        _, inds = distance(~inside, return_indices=True)
        patch[~inside] = patch[inds[0][~inside], inds[1][~inside]]
        origin = len(flat_vertices)
        flat_vertices.extend(raw_vertices[face])
        flat_faces.append([origin, origin + 1, origin + 2])
        for x, y in [(2, 2), (cell - 3, 2), (2, cell - 3)]:
            uv.append([(xcell * cell + x) / atlas_size, 1 - (ycell * cell + y) / atlas_size])
    texture = Image.fromarray(atlas)
    texture.save(directory / "observed-atlas.png")
    painted = trimesh.Trimesh(np.array(flat_vertices), np.array(flat_faces), process=False, visual=trimesh.visual.texture.TextureVisuals(uv=np.array(uv), image=texture))
    # Car's declared axes are Z up; common GLB viewer is Y up.
    rotation = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]])
    painted.apply_transform(rotation)
    export = directory / "export"
    export.mkdir()
    painted.export(export / "candidate.glb")
    (export / "export.json").write_text(json.dumps({"sha256": digest(export / "candidate.glb"), "triangles": len(raw_faces), "textureSize": atlas_size, "transform": rotation.tolist(), "appearance": "Four genuine source views; unobserved texels gray", "review": "Unreviewed diagnostic mesh"}, indent=2) + "\n")
    record = {"id": args.id, "status": "succeeded", "generator": "Scripted compact-car cross sections and volumetric cylindrical tires, jointly silhouette-fitted", "inputManifestSha256": digest(manifest_path), "implementationSha256": digest(__file__), "parameters": shape.cpu().tolist(), "cameraParameters": camera_values.cpu().tolist(), "cameras": view_records, "optimization": {"restarts": 2, "iterationsEach": 180, "loss": score, "history": history}, "texture": {"method": "Visibility-tested strongest-facing genuine source projection per atlas texel", "observedTexelFraction": covered / total, "unobserved": "neutral gray; no invented texture", "atlasSha256": digest(directory / "observed-atlas.png")}, "sourceFacing": {"east": "left", "west": "right", "north": "hood at top", "south": "hood at bottom"}, "outputSha256": {n: digest(directory / n) for n in ["raw.npz", "raw.glb", "fit-sheet.png", "observed-atlas.png"]}, "elapsedSeconds": time.perf_counter() - start, "limits": ["Hand-drawn views are not calibrated", "Loss fits opaque silhouette including painted shadows, not semantic part landmarks", "Class-specific topology is authored; missing surfaces are assumptions", "Silhouette IoU alone does not establish correct 3D or texture"], "review": "Unreviewed diagnostic geometry; no promotion"}
    (directory / "run.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps({"id": args.id, "seconds": record["elapsedSeconds"], "ious": [x["silhouetteIou"] for x in view_records], "observedTexelFraction": covered / total}), flush=True)


if __name__ == "__main__":
    main()
