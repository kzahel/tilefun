#!/usr/bin/env python3
"""
Composite directional sprite strips into single spritesheets.

Layout: rows = Down, Up, Left, Right (matching Direction enum 0-3)
Columns = animation frames.

Bird sprites have different native frame sizes per direction:
  - Down/Up: narrow and tall (e.g. 16x32)
  - Left/Right: wide (e.g. 32x16 or 32x32)
All frames are padded to a uniform output cell size (max_w x max_h),
centered horizontally, bottom-aligned (feet at bottom).
"""

from PIL import Image
import os

ME_BASE = os.path.join(
    os.path.dirname(__file__),
    "..",
    "assets",
    "Modern_Exteriors_16x16",
    "Animated_16x16",
    "Animated_sheets_16x16",
)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "sprites")


def composite_bird(name, files, du_frame_w, du_frame_h, lr_frame_w, lr_frame_h, out_name):
    """
    Composite bird with different frame sizes per direction pair.
    Down/Up use du_frame_w x du_frame_h, Left/Right use lr_frame_w x lr_frame_h.
    Output uses uniform cell size = max(widths) x max(heights), padded with transparency.
    """
    down = Image.open(os.path.join(ME_BASE, files[0]))
    up = Image.open(os.path.join(ME_BASE, files[1]))
    left = Image.open(os.path.join(ME_BASE, files[2]))
    right = Image.open(os.path.join(ME_BASE, files[3]))

    du_frames = min(down.width // du_frame_w, up.width // du_frame_w)
    lr_frames = min(left.width // lr_frame_w, right.width // lr_frame_w)

    # All birds should have same actual frame count once sizes are correct
    assert du_frames == lr_frames, (
        f"{name}: down/up have {du_frames} frames but left/right have {lr_frames}"
    )
    n_frames = du_frames

    # Uniform output cell
    cell_w = max(du_frame_w, lr_frame_w)
    cell_h = max(du_frame_h, lr_frame_h)

    out_w = n_frames * cell_w
    out_h = 4 * cell_h
    result = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))

    strips = [
        (down, du_frame_w, du_frame_h),
        (up, du_frame_w, du_frame_h),
        (left, lr_frame_w, lr_frame_h),
        (right, lr_frame_w, lr_frame_h),
    ]

    for row, (img, fw, fh) in enumerate(strips):
        # Padding: center horizontally, bottom-align vertically
        pad_x = (cell_w - fw) // 2
        pad_y = cell_h - fh
        for i in range(n_frames):
            frame = img.crop((i * fw, 0, (i + 1) * fw, fh))
            result.paste(frame, (i * cell_w + pad_x, row * cell_h + pad_y))

    out_path = os.path.join(OUT_DIR, out_name)
    result.save(out_path)
    print(f"  {out_name}: {out_w}x{out_h} ({n_frames} frames, {cell_w}x{cell_h} cells)")


def composite_uniform(name, pattern, frame_w, frame_h, out_name):
    """Composite 4 same-sized direction strips into one sheet."""
    dirs = ["down", "up", "left", "right"]
    strips = []
    frame_counts = []
    for d in dirs:
        path = os.path.join(ME_BASE, pattern.format(dir=d))
        img = Image.open(path)
        frames = img.width // frame_w
        frame_counts.append(frames)
        strips.append(img)

    n_frames = min(frame_counts)
    out_w = n_frames * frame_w
    out_h = 4 * frame_h
    result = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    for row, img in enumerate(strips):
        cropped = img.crop((0, 0, out_w, frame_h))
        result.paste(cropped, (0, row * frame_h))

    out_path = os.path.join(OUT_DIR, out_name)
    result.save(out_path)
    print(f"  {out_name}: {out_w}x{out_h} ({n_frames} frames, {frame_w}x{frame_h})")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # --- Worms (4 variants, all 16x16, 6 frames per direction) ---
    print("Worms:")
    for v in range(1, 5):
        composite_uniform(
            f"Worm {v}",
            f"Worm_{v}_{{dir}}_16x16.png",
            16, 16,
            f"worm{v}.png",
        )

    # --- Seagull idle ---
    # Down/Up: 96x32 → 6 frames of 16x32
    # Left/Right: 192x32 → 6 frames of 32x32
    # Output: 32x32 cells, 6 frames
    print("Seagull:")
    composite_bird(
        "Seagull",
        [
            "Beach_Seagull_Idle_Down_16x16.png",
            "Beach_Seagull_Idle_Up_16x16.png",
            "Beach_Seagull_Idle_Left_16x16.png",
            "Beach_Seagull_Idle_Right_16x16.png",
        ],
        du_frame_w=16, du_frame_h=32,
        lr_frame_w=32, lr_frame_h=32,
        out_name="seagull.png",
    )

    # --- Crow idle ---
    # Down/Up: 96x32 → 6 frames of 16x32
    # Left/Right: 192x16 → 6 frames of 32x16
    # Output: 32x32 cells, 6 frames
    print("Crow:")
    composite_bird(
        "Crow",
        [
            "Crow_idle_Down_16x16.png",
            "Crow_idle_Up_16x16.png",
            "Crow_idle_Left_16x16.png",
            "Crow_idle_Right_16x16.png",
        ],
        du_frame_w=16, du_frame_h=32,
        lr_frame_w=32, lr_frame_h=16,
        out_name="crow.png",
    )

    print("Done!")


if __name__ == "__main__":
    main()
