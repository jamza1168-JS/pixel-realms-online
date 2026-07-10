#!/usr/bin/env python3
"""
Pixel Realms — sprite generator (Pillow).

Produces animated spritesheets into ../../assets/<key>.png plus a sibling
<key>.json describing frame size and named animations. The game's asset
loader (js/assets.js) uses these at runtime; anything without a sheet here
falls back to the procedural sprite in js/sprites.js.

This is the repeatable "art pipeline": add a sprite by writing one build_*
function + an entry in SPRITES, then run `python3 tools/art/generate.py`.
Runtime never needs Pillow — only regeneration does (auto-installed below).

Usage:  python3 tools/art/generate.py
"""
import os, sys, json, subprocess

# --- self-bootstrap Pillow so any fresh session/PC can regenerate art ---
try:
    from PIL import Image
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "pillow"], check=True)
    from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ASSETS = os.path.join(ROOT, "assets")
os.makedirs(ASSETS, exist_ok=True)

# ------------------------------------------------------------------ helpers
class Frame:
    """A tiny drawing surface: a dict of (x,y)->(r,g,b). 'None' palette = skip."""
    def __init__(self, size): self.size = size; self.d = {}
    def px(self, x, y, c):
        if c is None: return
        if 0 <= x < self.size and 0 <= y < self.size: self.d[(x, y)] = c
    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.px(x, y, c)
    def to_image(self):
        img = Image.new("RGBA", (self.size, self.size), (0, 0, 0, 0))
        for (x, y), c in self.d.items(): img.putpixel((x, y), c + (255,))
        return img

def export(key, frames, anims, size):
    """Write a horizontal spritesheet + JSON anim metadata."""
    sheet = Image.new("RGBA", (size * len(frames), size), (0, 0, 0, 0))
    for i, fr in enumerate(frames): sheet.paste(fr.to_image(), (i * size, 0))
    sheet.save(os.path.join(ASSETS, key + ".png"))
    with open(os.path.join(ASSETS, key + ".json"), "w") as f:
        json.dump({"frameW": size, "frameH": size, "frames": len(frames), "anims": anims}, f)
    print(f"  {key}: {len(frames)}f {size}x{size}")

# ------------------------------------------------------------------ palettes
OUT = (24, 20, 30)
SKIN = (240, 200, 156); SKIN_D = (206, 158, 118)

HEROES = {
    # class: robe? , cloth, cloth_light, trim, hair, weapon, weapon2
    "warrior": dict(robe=False, c=(70,110,190),  C=(120,165,235), m=(190,196,210), hair=(120,72,40),  w=(214,220,235), g=(150,110,50)),
    "archer":  dict(robe=False, c=(70,150,80),   C=(120,200,130), m=(150,110,60),  hair=(60,44,30),   w=(160,120,70),  g=(90,60,35)),
    "mage":    dict(robe=True,  c=(90,80,180),   C=(140,130,225), m=(230,210,90),  hair=(200,200,210),w=(150,110,55),  g=(120,200,255)),
    "cleric":  dict(robe=True,  c=(225,220,205), C=(255,252,240), m=(230,200,90),  hair=(150,120,70), w=(200,205,215), g=(230,200,90)),
}

def build_hero(cfg, pose):
    """pose: 0 neutral, -1 left step, +1 right step. Right-facing; game flips."""
    f = Frame(32)
    bob = 1 if pose != 0 else 0
    oy = -bob
    # head + hair
    f.rect(12, 5+oy, 19, 11+oy, SKIN); f.rect(12, 10+oy, 19, 11+oy, SKIN_D)
    f.rect(11, 4+oy, 20, 4+oy, cfg["hair"]); f.rect(11, 5+oy, 11, 7+oy, cfg["hair"]); f.rect(20, 5+oy, 20, 7+oy, cfg["hair"])
    f.rect(12, 4+oy, 19, 4+oy, cfg["hair"])
    f.px(15, 8+oy, OUT); f.px(18, 8+oy, OUT)  # eyes (right-facing → eyes toward right)
    if cfg["robe"]:
        # long robe covering body+legs, small sway on step
        sway = pose
        f.rect(10, 12+oy, 21, 26+oy, cfg["c"]); f.rect(12, 12+oy, 19, 12+oy, cfg["C"])
        f.rect(13, 15+oy, 18, 20+oy, cfg["C"]); f.rect(10, 12+oy, 10, 26+oy, cfg["m"]); f.rect(21, 12+oy, 21, 26+oy, cfg["m"])
        f.rect(10+ (1 if sway>0 else 0), 26+oy, 21+ (1 if sway>0 else 0), 27+oy, cfg["c"])  # hem
        f.rect(9, 13+oy, 10, 19+oy, cfg["c"]); f.rect(21, 13+oy, 22, 19+oy, cfg["c"])       # sleeves
        f.rect(9, 19+oy, 10, 20+oy, SKIN); f.rect(21, 19+oy, 22, 20+oy, SKIN)               # hands
    else:
        # armored torso + pants + boots with alternating legs
        f.rect(11, 12+oy, 20, 19+oy, cfg["c"]); f.rect(12, 12+oy, 19, 12+oy, cfg["C"]); f.rect(13, 14+oy, 18, 16+oy, cfg["C"])
        f.rect(11, 12+oy, 11, 19+oy, cfg["m"]); f.rect(20, 12+oy, 20, 19+oy, cfg["m"])
        f.rect(9, 13+oy, 10, 18+oy, cfg["c"]); f.rect(9, 18+oy, 10, 19+oy, SKIN)             # left arm+hand
        f.rect(21, 13+oy, 22, 18+oy, cfg["c"]); f.rect(21, 18+oy, 22, 19+oy, SKIN)           # right arm+hand
        lL = 1 if pose > 0 else 0; lR = 1 if pose < 0 else 0
        f.rect(12, 20+oy, 14, 24+oy+lL, (60,48,80)); f.rect(12, 25+oy+lL, 14, 26+oy+lL, (40,30,22))
        f.rect(17, 20+oy, 19, 24+oy+lR, (60,48,80)); f.rect(17, 25+oy+lR, 19, 26+oy+lR, (40,30,22))
    # weapon on the right hand (simple, per class)
    return f

def build_portal(phase):
    f = Frame(32)
    ring = [(168,110,232),(200,150,250),(150,90,220),(190,140,245)][phase]
    core = [(60,30,90),(120,80,180),(80,50,130),(150,110,220)][phase]
    import math
    cx = cy = 16
    for y in range(32):
        for x in range(32):
            dx, dy = x - cx + 0.5, y - cy + 0.5
            r = (dx*dx + dy*dy) ** 0.5
            if r < 4 + phase*0.6: f.px(x, y, core)
            elif r < 12: f.px(x, y, ring if int(r + phase) % 3 else core)
            elif r < 13.5: f.px(x, y, (90, 50, 140))
    return f

# ------------------------------------------------------------------ registry
def main():
    print("Generating spritesheets → assets/")
    keys = []
    for cls, cfg in HEROES.items():
        frames = [build_hero(cfg, 0), build_hero(cfg, -1), build_hero(cfg, +1)]
        export("hero_" + cls, frames, {"idle": [0], "walk": [1, 0, 2, 0]}, 32)
        keys.append("hero_" + cls)
    export("portal", [build_portal(i) for i in range(4)], {"loop": [0, 1, 2, 3]}, 32)
    keys.append("portal")
    # manifest so the client loader discovers art without any code change
    with open(os.path.join(ASSETS, "manifest.json"), "w") as f:
        json.dump({"keys": keys}, f)
    print(f"manifest: {len(keys)} keys. done.")

if __name__ == "__main__":
    main()
