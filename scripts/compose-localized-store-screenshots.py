#!/usr/bin/env python3
"""Compose localized App Store artwork from real Simulator screenshots.

The outer layout is reused from the existing German App Store artwork. Only
the headline and the phone display are replaced. The phone content therefore
always comes from the real Lotti Baby app running in the iOS Simulator.
"""

from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
GERMAN = ROOT / "store/apple/screenshot/de-DE/APP_IPHONE_65"
RAW = ROOT / "store/apple/screenshot/raw"
OUTPUT = ROOT / "store/apple/screenshot"
FONT_PATH = Path("/System/Library/Fonts/Supplemental/Didot.ttc")

# Inner edge of the phone display in the existing 1242 x 2688 artwork.
DISPLAY_BOX = (148, 500, 1094, 2550)
DISPLAY_RADIUS = 105

SCENES = {
    "home": {"base": "14.png", "order": 1},
    "accounts": {"base": "20.png", "order": 2},
    "profiles": {"base": "19.png", "order": 3},
    "teeth": {"base": "23.png", "order": 4},
    "day": {"base": "15.png", "order": 5},
    "weather": {"base": "22.png", "order": 6},
    "checklist": {"base": "17.png", "order": 7},
    "notifications": {"base": "18.png", "order": 8},
    "sleep": {"base": "21.png", "order": 9},
    "contractions": {"base": "16.png", "order": 10},
}

HEADLINES = {
    "en-US": {
        "home": "BABY & TODDLER\nMODE",
        "accounts": "LINK YOUR\nACCOUNTS",
        "profiles": "BABY & PREGNANCY\nIN ONE PLACE",
        "teeth": "CAPTURE THEIR\nFIRST TEETH",
        "day": "PLAN YOUR\nDAY TOGETHER",
        "weather": "ALWAYS DRESS\nTHEM RIGHT",
        "checklist": "PACK YOUR\nHOSPITAL BAG",
        "notifications": "GET REMINDERS\nRIGHT ON TIME",
        "sleep": "USE THE\nSLEEP TRACKER",
        "contractions": "TRACK YOUR\nCONTRACTIONS",
    },
    "es-ES": {
        "home": "MODO BEBÉ Y\nNIÑO PEQUEÑO",
        "accounts": "VINCULAD VUESTRAS\nCUENTAS",
        "profiles": "BEBÉ Y EMBARAZO\nEN UN SOLO LUGAR",
        "teeth": "GUARDA SUS\nPRIMEROS DIENTES",
        "day": "ORGANIZAD\nVUESTRO DÍA",
        "weather": "SIEMPRE CON LA\nROPA ADECUADA",
        "checklist": "PREPARA LA BOLSA\nPARA EL HOSPITAL",
        "notifications": "RECIBE AVISOS\nA TIEMPO",
        "sleep": "USA EL REGISTRO\nDE SUEÑO",
        "contractions": "REGISTRA TUS\nCONTRACCIONES",
    },
}


def remove_transient_capture_artifacts(
    raw: Image.Image,
    locale: str,
    scene: str,
) -> Image.Image:
    """Remove UI artifacts that only exist at the instant of capture."""
    if locale == "en-US" and scene == "weather" and raw.size == (1284, 2778):
        # The city field keeps its first-responder state after searching. The
        # Simulator capture therefore catches the six-pixel blinking caret.
        # Replace only that caret with the immediately adjacent input fill.
        cleaned = raw.copy()
        cleaned.paste(raw.crop((284, 800, 290, 863)), (276, 800))
        return cleaned
    return raw


def fitted_font(draw: ImageDraw.ImageDraw, text: str) -> ImageFont.FreeTypeFont:
    size = 92
    while size >= 54:
        font = ImageFont.truetype(str(FONT_PATH), size=size, index=0)
        box = draw.multiline_textbbox((0, 0), text, font=font, spacing=4, align="center")
        if box[2] - box[0] <= 1050 and box[3] - box[1] <= 235:
            return font
        size -= 2
    return ImageFont.truetype(str(FONT_PATH), size=54, index=0)


def compose(locale: str, scene: str) -> Path:
    scene_info = SCENES[scene]
    base = Image.open(GERMAN / scene_info["base"]).convert("RGB")
    raw = Image.open(RAW / locale / f"{scene}.png").convert("RGB")
    raw = remove_transient_capture_artifacts(raw, locale, scene)
    draw = ImageDraw.Draw(base)

    # Rebuild the existing white headline card without retaining German text.
    draw.rounded_rectangle((-20, -100, 1262, 402), radius=110, fill=(253, 252, 250))
    headline = HEADLINES[locale][scene]
    font = fitted_font(draw, headline)
    text_box = draw.multiline_textbbox((0, 0), headline, font=font, spacing=4, align="center")
    text_width = text_box[2] - text_box[0]
    text_height = text_box[3] - text_box[1]
    draw.multiline_text(
        ((1242 - text_width) / 2, 190 - text_height / 2 - text_box[1]),
        headline,
        font=font,
        fill=(18, 17, 17),
        spacing=4,
        align="center",
    )

    left, top, right, bottom = DISPLAY_BOX
    display_size = (right - left, bottom - top)
    raw = raw.resize(display_size, Image.Resampling.LANCZOS)
    mask = Image.new("L", display_size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, display_size[0] - 1, display_size[1] - 1),
        radius=DISPLAY_RADIUS,
        fill=255,
    )
    base.paste(raw, (left, top), mask)

    target_dir = OUTPUT / locale / "APP_IPHONE_65"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"store-shot-{locale[:2]}-{scene_info['order']}.png"
    base.save(target, format="PNG", optimize=True)
    return target


def main() -> int:
    locales = sys.argv[1:] or list(HEADLINES)
    for locale in locales:
        if locale not in HEADLINES:
            raise SystemExit(f"Unsupported locale: {locale}")
        for scene in SCENES:
            raw_path = RAW / locale / f"{scene}.png"
            if not raw_path.exists():
                continue
            print(compose(locale, scene).relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
