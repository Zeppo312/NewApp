# Kontaktbogen aus dem fertigen Film: repräsentative Bilder mit Zeitmarke und Szenenname.
# Aufruf: python3 werkzeuge/kontaktbogen.py  (aus dem Ausgabeordner)
import subprocess, io
from PIL import Image, ImageDraw, ImageFont
SRC = 'export/lotti-baby-vorschau-motion-de.mp4'
SHOTS = [(0.4, 'Einstieg: App sofort sichtbar'), (2.9, 'Frage + Antwort, Markierung'), (5.8, 'Tippen auf „Speichern"'),
         (7.2, 'Bestätigung der App'), (9.6, 'Unser Tag: Kennzahl'), (11.6, 'Eintrag in der Timeline'),
         (14.15, 'Tippen auf „Schlaf starten"'), (15.6, '„Nachtschlaf läuft"'), (17.2, 'Timer läuft'),
         (18.72, 'Tippen auf „beenden"'), (19.6, 'Schlafqualität wählen'), (22.6, 'Beendet'),
         (24.6, 'Markenabschluss'), (27.3, 'Schlussbild mit Hinweis')]
W = 300
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 17)
small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 15)
tiles = []
for t, label in SHOTS:
    png = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(t), '-i', SRC, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True, check=True).stdout
    im = Image.open(io.BytesIO(png)).convert('RGB'); im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    tiles.append((t, label, im))
cols = 7; th = tiles[0][2].height; pad = 14; cap = 48
sheet = Image.new('RGB', (cols * (W + pad) + pad, 2 * (th + cap + pad) + pad + 50), (252, 247, 241))
d = ImageDraw.Draw(sheet)
d.text((pad, 14), 'Lotti Baby – App-Vorschau Motion (de-DE) · 886 × 1920 · 30 fps · 27,5 s', fill=(51, 38, 58), font=font)
for i, (t, label, im) in enumerate(tiles):
    x = pad + (i % cols) * (W + pad); y = 50 + pad + (i // cols) * (th + cap + pad)
    sheet.paste(im, (x, y))
    d.text((x, y + th + 6), f'{t:05.2f} s', fill=(117, 72, 158), font=font)
    d.text((x, y + th + 26), label, fill=(51, 38, 58), font=small)
sheet.save('export/kontaktbogen.png')
print('export/kontaktbogen.png', sheet.size)
