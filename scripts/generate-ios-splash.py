#!/usr/bin/env python3
"""Generate iOS PWA launch images (apple-touch-startup-image).

iOS ignores manifest background_color for Home Screen splash. Each PNG must
match device-width × device-height × pixel-ratio exactly or Safari falls back
to a white screen.

Run: python3 scripts/generate-ios-splash.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ICON_PATH = ROOT / "public/icons/icon-512.png"
OUT_DIR = ROOT / "public/icons/splash"
MARK_PATH = OUT_DIR / "mark.png"
INDEX_HTML = ROOT / "index.html"
BG = (10, 10, 10, 255)  # #0a0a0a
# icon-512 is an RGB plate (white card + dark bezel). Treat light pixels as
# transparent so splash/boot stay on-theme instead of a white square.
LIGHT_PLATE_MIN = 220
MARK_SIZE = 256

# device-width, device-height, pixel-ratio → PNG pixels
DEVICES: list[tuple[int, int, int]] = [
    (320, 568, 2),  # iPhone SE (1st)
    (375, 667, 2),  # iPhone SE (2nd/3rd), 8
    (414, 736, 3),  # iPhone 8 Plus
    (375, 812, 3),  # iPhone X / 11 Pro / 12-13 mini
    (390, 844, 3),  # iPhone 12/13/14
    (393, 852, 3),  # iPhone 14/15 Pro, 16
    (402, 873, 3),  # iPhone 17 Pro (some tables)
    (402, 874, 3),  # iPhone 16 Pro / 17
    (414, 896, 2),  # iPhone 11 / XR
    (414, 896, 3),  # iPhone 11 Pro Max / XS Max
    (420, 912, 3),  # iPhone Air
    (428, 926, 3),  # iPhone 12/13 Pro Max, 14 Plus
    (430, 932, 3),  # iPhone 14 Pro Max / 15 Plus / 16 Plus
    (440, 956, 3),  # iPhone 16/17 Pro Max
    (744, 1133, 2),  # iPad mini
    (768, 1024, 2),  # iPad 9.7
    (810, 1080, 2),  # iPad 10.2
    (820, 1180, 2),  # iPad 10.9
    (834, 1112, 2),  # iPad Air 10.5
    (834, 1194, 2),  # iPad Pro 11
    (1024, 1366, 2),  # iPad Pro 12.9
]

MARKER_START = "<!-- ios-splash-start -->"
MARKER_END = "<!-- ios-splash-end -->"


def splash_name(px_w: int, px_h: int) -> str:
    return f"{px_w}x{px_h}.png"


def media_query(dw: int, dh: int, dpr: int, landscape: bool) -> str:
    # Apple keeps portrait device-width/height and switches orientation.
    orientation = "landscape" if landscape else "portrait"
    return (
        f"screen and (device-width: {dw}px) and (device-height: {dh}px) "
        f"and (-webkit-device-pixel-ratio: {dpr}) and (orientation: {orientation})"
    )


def punch_light_plate(icon: Image.Image) -> Image.Image:
    rgba = icon.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            red, green, blue, _alpha = pixels[x, y]
            if red >= LIGHT_PLATE_MIN and green >= LIGHT_PLATE_MIN and blue >= LIGHT_PLATE_MIN:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def compose(px_w: int, px_h: int, icon: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (px_w, px_h), BG)
    icon_size = max(180, round(min(px_w, px_h) * 0.22))
    mark = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    x = (px_w - icon_size) // 2
    y = (px_h - icon_size) // 2
    canvas.alpha_composite(mark, (x, y))
    return canvas.convert("RGB")


def link_tag(href: str, media: str) -> str:
    return f'        <link rel="apple-touch-startup-image" media="{media}" href="{href}" />'


def build_links(files: list[tuple[str, str]]) -> str:
    lines = [MARKER_START, "        <!-- iOS Home Screen splash (exact device sizes). -->"]
    lines.extend(link_tag(href, media) for href, media in files)
    lines.append(f"        {MARKER_END}")
    return "\n".join(lines)


def patch_index(links_html: str) -> None:
    text = INDEX_HTML.read_text(encoding="utf-8")
    start = text.find(MARKER_START)
    end = text.find(MARKER_END)
    if start == -1 or end == -1:
        raise SystemExit("index.html is missing ios-splash markers")
    end += len(MARKER_END)
    INDEX_HTML.write_text(text[:start] + links_html + text[end:], encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    icon = punch_light_plate(Image.open(ICON_PATH))
    mark = icon.resize((MARK_SIZE, MARK_SIZE), Image.Resampling.LANCZOS)
    mark.save(MARK_PATH, format="PNG", optimize=True)
    seen: set[tuple[int, int]] = set()
    files: list[tuple[str, str]] = []

    for dw, dh, dpr in DEVICES:
        for landscape in (False, True):
            css_w, css_h = (dh, dw) if landscape else (dw, dh)
            px_w, px_h = css_w * dpr, css_h * dpr
            name = splash_name(px_w, px_h)
            dest = OUT_DIR / name
            if (px_w, px_h) not in seen:
                seen.add((px_w, px_h))
                image = compose(px_w, px_h, icon).quantize(colors=48, method=Image.Quantize.FASTOCTREE)
                image.save(dest, format="PNG", optimize=True)
            href = f"/icons/splash/{name}"
            files.append((href, media_query(dw, dh, dpr, landscape)))

    patch_index(build_links(files))
    print(f"wrote {len(seen)} PNGs / {len(files)} link tags to {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
