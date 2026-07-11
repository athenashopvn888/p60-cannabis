from __future__ import annotations

import io
import json
import math
import urllib.request
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "banners" / "p60-real"
CACHE = OUT / "cache"
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)

HERO_PATH = ROOT / "public" / "banners" / "homepage_hero.webp"
LOGO_PATH = ROOT / "public" / "storeFavicon.webp"
FLOWERS_PATH = ROOT / "app" / "lib" / "flowers.json"
ITEMS_PATH = ROOT / "app" / "lib" / "items.json"

HERO = Image.open(HERO_PATH).convert("RGB")
LOGO = Image.open(LOGO_PATH).convert("RGBA")
FLOWERS = json.loads(FLOWERS_PATH.read_text(encoding="utf-8"))
ITEMS = json.loads(ITEMS_PATH.read_text(encoding="utf-8"))


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    path = Path("C:/Windows/Fonts") / name
    return ImageFont.truetype(str(path), size)


FONT_BLACK = "arialbd.ttf"
FONT_REGULAR = "arial.ttf"
FONT_IMPACT = "impact.ttf"


def draw_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    size: int,
    fill: str | tuple[int, int, int, int],
    font_name: str = FONT_BLACK,
    stroke: int = 0,
    stroke_fill: str | tuple[int, int, int, int] = "#000000",
) -> None:
    draw.text(
        xy,
        text,
        font=font(font_name, size),
        fill=fill,
        stroke_width=stroke,
        stroke_fill=stroke_fill,
    )


def text_size(draw: ImageDraw.ImageDraw, text: str, size: int, font_name: str = FONT_BLACK) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font(font_name, size))
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, start: int, font_name: str = FONT_BLACK) -> int:
    size = start
    while size > 22 and text_size(draw, text, size, font_name)[0] > max_width:
        size -= 2
    return size


def rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill, outline=None, width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def glow_line(canvas: Image.Image, box: tuple[int, int, int, int], color: tuple[int, int, int], radius: int = 18) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=radius, outline=(*color, 150), width=4)
    blur = layer.filter(ImageFilter.GaussianBlur(12))
    canvas.alpha_composite(blur)
    canvas.alpha_composite(layer)


def hero_background(size: tuple[int, int], centering: tuple[float, float] = (0.5, 0.48)) -> Image.Image:
    bg = ImageOps.fit(HERO, size, method=Image.Resampling.LANCZOS, centering=centering).convert("RGBA")
    bg = bg.filter(ImageFilter.GaussianBlur(5))
    bg = ImageEnhance.Contrast(bg).enhance(1.08)
    bg = ImageEnhance.Color(bg).enhance(1.18)

    overlay = Image.new("RGBA", size, (0, 0, 0, 104))
    bg.alpha_composite(overlay)

    w, h = size
    radial = Image.new("RGBA", size, (0, 0, 0, 0))
    pix = radial.load()
    for y in range(h):
        for x in range(w):
            nx = (x - w * 0.72) / (w * 0.62)
            ny = (y - h * 0.35) / (h * 0.74)
            a = max(0, 1 - math.sqrt(nx * nx + ny * ny))
            if a > 0:
                pix[x, y] = (137, 255, 27, int(a * 72))
    bg.alpha_composite(radial)

    vignette = Image.new("RGBA", size, (0, 0, 0, 0))
    vpix = vignette.load()
    for y in range(h):
        for x in range(w):
            dx = abs(x / w - 0.5) * 2
            dy = abs(y / h - 0.5) * 2
            edge = max(dx, dy)
            a = max(0, edge - 0.45) / 0.55
            if a > 0:
                vpix[x, y] = (0, 0, 0, int(min(170, a * 170)))
    bg.alpha_composite(vignette)
    return bg


def cache_name(url: str) -> Path:
    safe = "".join(ch if ch.isalnum() else "-" for ch in url.split("/")[-1])[:90]
    return CACHE / safe


def load_remote_image(url: str) -> Image.Image | None:
    if not url:
        return None
    cached = cache_name(url)
    try:
        if cached.exists():
            raw = cached.read_bytes()
        else:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as response:
                raw = response.read()
            cached.write_bytes(raw)
        return Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception as exc:
        print(f"[asset] Could not load {url}: {exc}")
        return None


def remove_white_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            brightness = (r + g + b) / 3
            spread = max(r, g, b) - min(r, g, b)
            if brightness > 244 and spread < 18:
                px[x, y] = (r, g, b, 0)
            elif brightness > 228 and spread < 28:
                fade = int(max(0, min(255, (244 - brightness) / 16 * 255)))
                px[x, y] = (r, g, b, min(a, fade))
    alpha = img.getchannel("A").filter(ImageFilter.GaussianBlur(0.7))
    img.putalpha(alpha)
    bbox = alpha.getbbox()
    if bbox:
        img = img.crop(bbox)
    return img


def product_images(records: Iterable[dict], limit: int = 3) -> list[Image.Image]:
    images: list[Image.Image] = []
    for record in records:
        img = load_remote_image(record.get("image", ""))
        if img is None:
            continue
        cutout = remove_white_background(img)
        cutout = ImageEnhance.Sharpness(cutout).enhance(1.12)
        cutout = ImageEnhance.Contrast(cutout).enhance(1.06)
        images.append(cutout)
        if len(images) >= limit:
            break
    return images


def records_for_tier(tier: str, limit: int = 4) -> list[dict]:
    matches = [f for f in FLOWERS if str(f.get("tier", "")).upper() == tier.upper()]
    matches.sort(key=lambda f: (not f.get("isSale", False), not f.get("isHot", False), str(f.get("sku", ""))))
    return matches[:limit]


def records_for_category(category: str, limit: int = 4) -> list[dict]:
    category = category.upper()
    if category == "PREROLLS":
        matches = [i for i in ITEMS if "PRE-ROLL" in str(i.get("name", "")).upper() or "PR-ROLL" in str(i.get("name", "")).upper()]
    elif category == "ACCESSORIES":
        matches = [i for i in ITEMS if str(i.get("category", "")).upper() == "ADD ONS" and "ROLL" not in str(i.get("name", "")).upper()]
    elif category == "MAGIC":
        matches = [i for i in ITEMS if "MAGIC" in str(i.get("category", "")).upper() or "MAGIC" in str(i.get("name", "")).upper()]
    else:
        matches = [i for i in ITEMS if str(i.get("category", "")).upper() == category]
    return matches[:limit]


def paste_contained(
    canvas: Image.Image,
    img: Image.Image,
    box: tuple[int, int, int, int],
    opacity: int = 255,
    shadow: bool = True,
) -> None:
    x1, y1, x2, y2 = box
    bw, bh = x2 - x1, y2 - y1
    scale = min(bw / img.width, bh / img.height)
    nw = max(1, int(img.width * scale))
    nh = max(1, int(img.height * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    if opacity < 255:
        alpha = resized.getchannel("A").point(lambda p: int(p * opacity / 255))
        resized.putalpha(alpha)
    px = x1 + (bw - nw) // 2
    py = y1 + (bh - nh) // 2
    if shadow:
        shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        mask = resized.getchannel("A").filter(ImageFilter.GaussianBlur(14))
        sh = Image.new("RGBA", resized.size, (0, 0, 0, 170))
        sh.putalpha(mask)
        shadow_layer.alpha_composite(sh, (px + 18, py + 24))
        canvas.alpha_composite(shadow_layer)
    canvas.alpha_composite(resized, (px, py))


def paste_logo(canvas: Image.Image, xy: tuple[int, int], size: int = 70) -> None:
    logo = LOGO.copy()
    logo.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, xy)


def add_card_frame(canvas: Image.Image, accent: tuple[int, int, int], strong: bool = False) -> None:
    d = ImageDraw.Draw(canvas)
    w, h = canvas.size
    radius = 24 if min(w, h) > 500 else 18
    glow_line(canvas, (24, 24, w - 24, h - 24), accent, radius=radius)
    d.rounded_rectangle((24, 24, w - 24, h - 24), radius=radius, outline=(*accent, 180 if strong else 125), width=3 if strong else 2)
    d.rectangle((0, 0, w, 12), fill=(*accent, 230))


def make_tile(file: str, accent: tuple[int, int, int], records: list[dict], product_kind: str = "flower") -> None:
    size = (1200, 760)
    canvas = hero_background(size, centering=(0.58, 0.52))
    d = ImageDraw.Draw(canvas)
    add_card_frame(canvas, accent)

    images = product_images(records, limit=3)
    if not images and product_kind == "flower":
        images = product_images(records_for_tier("EXOTIC", 3), limit=3)

    if images:
        if len(images) == 1:
            paste_contained(canvas, images[0], (190, 74, 1080, 660))
        else:
            paste_contained(canvas, images[0], (105, 92, 590, 690))
            paste_contained(canvas, images[1], (500, 74, 1015, 660), opacity=238)
            if len(images) > 2:
                paste_contained(canvas, images[2], (810, 245, 1135, 690), opacity=230)

    # Darken the label area so UI text remains readable without hiding the photo.
    label_fade = Image.new("RGBA", size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(label_fade)
    ld.rectangle((0, 500, 1200, 760), fill=(0, 0, 0, 118))
    canvas.alpha_composite(label_fade)
    paste_logo(canvas, (58, 52), 76)
    d.text((1040, 654), "P60", font=font(FONT_IMPACT, 42), fill=(*accent, 185), stroke_width=2, stroke_fill=(0, 0, 0, 180))
    canvas.convert("RGB").save(OUT / file, "WEBP", quality=92, method=6)


def make_banner(
    file: str,
    title: str,
    kicker: str,
    subtitle: str,
    chips: list[str],
    accent: tuple[int, int, int],
    records: list[dict],
) -> None:
    size = (1600, 760)
    canvas = hero_background(size, centering=(0.54, 0.5))
    d = ImageDraw.Draw(canvas)
    add_card_frame(canvas, accent, strong=True)

    images = product_images(records, limit=4)
    if images:
        paste_contained(canvas, images[0], (850, 85, 1280, 650))
        if len(images) > 1:
            paste_contained(canvas, images[1], (1110, 90, 1530, 650), opacity=232)
        if len(images) > 2:
            paste_contained(canvas, images[2], (690, 320, 990, 690), opacity=228)

    text_panel = Image.new("RGBA", size, (0, 0, 0, 0))
    pd = ImageDraw.Draw(text_panel)
    pd.rounded_rectangle((76, 86, 800, 666), radius=24, fill=(0, 0, 0, 126), outline=(*accent, 94), width=2)
    canvas.alpha_composite(text_panel)

    paste_logo(canvas, (112, 122), 88)
    draw_text(d, (220, 132), "P60 CANNABIS", 38, "#f9fff0", FONT_BLACK, stroke=2, stroke_fill="#031004")
    draw_text(d, (112, 244), kicker.upper(), 27, accent + (255,), FONT_BLACK, stroke=2, stroke_fill="#031004")
    title_size = fit_font(d, title.upper(), 650, 98, FONT_IMPACT)
    draw_text(d, (110, 294), title.upper(), title_size, "#ffffff", FONT_IMPACT, stroke=3, stroke_fill="#041006")
    draw_text(d, (114, 418), subtitle, 31, "#eaffda", FONT_BLACK, stroke=2, stroke_fill="#041006")

    x = 112
    y = 532
    for chip in chips[:3]:
        tw, _ = text_size(d, chip, 22, FONT_BLACK)
        bw = min(250, tw + 42)
        rounded(d, (x, y, x + bw, y + 54), 27, (4, 15, 6, 190), outline=accent + (160,), width=2)
        draw_text(d, (x + 21, y + 15), chip, 22, "#ffffff", FONT_BLACK)
        x += bw + 20

    d.text((1465, 638), "P60", font=font(FONT_IMPACT, 58), fill=(*accent, 210), stroke_width=3, stroke_fill=(0, 0, 0, 210))
    canvas.convert("RGB").save(OUT / file, "WEBP", quality=93, method=6)


TIER_ASSETS = [
    ("exotic", "EXOTIC", "Top shelf flower tier", ["35-39% THC", "$10-$12/g", "P60 flower"], (236, 49, 189), records_for_tier("EXOTIC")),
    ("premium", "PREMIUM", "Connoisseur flower picks", ["32-34% THC", "$7-$10/g", "P60 flower"], (255, 212, 67), records_for_tier("PREMIUM")),
    ("aaa", "AAA+", "Strong quality and value", ["30-32% THC", "$5-$6/g", "Popular tier"], (43, 225, 255), records_for_tier("AAA+")),
    ("aa", "AA", "Daily flower value", ["27-29% THC", "$4/g", "Daily picks"], (48, 255, 158), records_for_tier("AA")),
    ("budget", "BUDGET", "Value flower options", ["From $3/g", "Budget picks", "P60 value"], (236, 241, 245), records_for_tier("BUDGET")),
]

CATEGORY_ASSETS = [
    ("edibles", "EDIBLES", "Gummies, chocolates and drinks", ["Gummies", "Chocolate", "Drinks"], (255, 128, 42), records_for_category("EDIBLES")),
    ("thc-vape", "THC VAPE", "Vape menu categories", ["Carts", "Pens", "Menu"], (136, 98, 255), records_for_category("VAPE PENS")),
    ("nic-vape", "NIC VAPE", "Disposable vape browsing", ["Disposable", "Flavours", "Menu"], (178, 132, 255), records_for_category("VAPE DISPOSABLE")),
    ("concentrates", "CONCENTRATES", "Hash, resin and extracts", ["Hash", "Resin", "Extracts"], (255, 222, 67), records_for_category("CONCENTRATES")),
    ("prerolls", "PRE-ROLLS", "Ready-to-go pre-roll picks", ["Singles", "Packs", "Pre-rolls"], (55, 255, 129), records_for_category("PREROLLS")),
    ("accessories", "ACCESSORIES", "Smoke-shop essentials", ["Papers", "Tools", "Add-ons"], (71, 255, 209), records_for_category("ACCESSORIES")),
    ("cigarettes", "CIGARETTES", "Native cigarette category", ["Full", "Lights", "Cartons"], (226, 219, 200), records_for_category("CIGARETTES")),
    ("magic", "MAGIC STUFF", "Specialty menu category", ["Specialty", "Menu", "Varies"], (178, 108, 255), records_for_category("MAGIC") or records_for_category("EDIBLES")),
]


def main() -> None:
    for slug, title, subtitle, chips, accent, records in TIER_ASSETS:
        make_tile(f"tile-{slug}.webp", accent, records)
        make_banner(f"tier-{slug}.webp", title, "P60 flower tier", subtitle, chips, accent, records)

    make_tile("tile-menu-plus.webp", (255, 130, 40), records_for_category("EDIBLES") + records_for_category("CONCENTRATES"), product_kind="items")
    make_banner(
        "category-menu-plus.webp",
        "EDIBLES / PREROLLS / MORE",
        "P60 menu shortcut",
        "Quick access to non-flower categories",
        ["Edibles", "Pre-rolls", "Vapes"],
        (255, 130, 40),
        records_for_category("EDIBLES") + records_for_category("PREROLLS") + records_for_category("VAPE PENS"),
    )

    for slug, title, subtitle, chips, accent, records in CATEGORY_ASSETS:
        make_tile(f"tile-{slug}.webp", accent, records, product_kind="items")
        make_banner(f"category-{slug}.webp", title, "P60 menu category", subtitle, chips, accent, records)

    page_records = records_for_tier("EXOTIC", 2) + records_for_category("CONCENTRATES", 2)
    for file, title, subtitle in [
        ("page-delivery.webp", "DELIVERY PREVIEW", "Delivery page preview with P60 styling"),
        ("page-faq.webp", "FAQ", "Store questions, hours and menu details"),
        ("page-contact.webp", "CONTACT P60", "1938 Weston Rd, York, ON M9N 1W2"),
        ("page-york.webp", "YORK WEED DISPENSARY", "P60 Cannabis on Weston Rd"),
        ("page-budget.webp", "BUDGET CANNABIS DEALS", "Value flower and tier options"),
        ("page-cigarettes.webp", "NATIVE CIGARETTES", "Cigarette category details"),
        ("page-near-toronto.webp", "WEED STORE NEAR TORONTO", "Easy access from Toronto"),
        ("page-near-me.webp", "DISPENSARY NEAR ME", "P60 store details for nearby shoppers"),
    ]:
        make_banner(file, title, "P60 store info", subtitle, ["Weston Rd", "Open Daily", "Adults 19+"], (166, 255, 24), page_records)

    print(f"Generated P60 real assets in {OUT}")


if __name__ == "__main__":
    main()
