# -*- coding: utf-8 -*-
"""Generate build/icon.ico (Prembroke leaf) from an inline SVG, with a Pillow fallback."""
import os
from io import BytesIO

OUT_DIR = r"C:\Users\TILAK CHILLARA\OneDrive\Desktop\Trading-DEX\build"
os.makedirs(OUT_DIR, exist_ok=True)
ICO = os.path.join(OUT_DIR, "icon.ico")
PNG = os.path.join(OUT_DIR, "icon.png")

SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect x="8" y="8" width="240" height="240" rx="52" fill="#0b1710" stroke="#1c3325" stroke-width="4"/>
  <g transform="translate(44,50) scale(2.6)">
    <path d="M50 12C30 12 16 24 13 44c-1 6 1 9 1 9s3 2 9 1c20-3 32-17 32-37 0-3-2-6-5-6z" fill="#14532d" stroke="#d9a521" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M14 53C18 44 24 36 33 30" stroke="#d9a521" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    <path d="M19 49C28 41 38 31 49 19" stroke="#c99a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
  </g>
</svg>"""

from PIL import Image, ImageDraw

def render_svg() -> "Image.Image | None":
    try:
        import fitz
        doc = fitz.open(stream=SVG.encode("utf-8"), filetype="svg")
        page = doc[0]
        zoom = 256 / page.rect.width
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=True)
        img = Image.open(BytesIO(pix.tobytes("png"))).convert("RGBA")
        # sanity: must contain non-background pixels
        if img.getbbox() is None:
            return None
        return img.resize((256, 256), Image.LANCZOS)
    except Exception as e:
        print("svg render failed:", e)
        return None

def fallback() -> "Image.Image":
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([8, 8, 248, 248], radius=52, fill=(11, 23, 16, 255), outline=(28, 51, 37, 255), width=4)
    # simple leaf: gold-outlined green ellipse + midrib
    d.ellipse([70, 64, 196, 180], fill=(20, 83, 45, 255), outline=(217, 165, 33, 255), width=6)
    d.line([86, 176, 184, 78], fill=(201, 154, 46, 255), width=5)
    for i in range(3):
        y = 150 - i * 28
        d.line([128, y, 168, y - 26], fill=(201, 154, 46, 255), width=3)
        d.line([128, y, 92, y - 22], fill=(201, 154, 46, 255), width=3)
    return img

img = render_svg() or fallback()
img.save(PNG)
img.save(ICO, sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print("WROTE", ICO, "and", PNG, "via", "svg" if render_svg() else "fallback")
