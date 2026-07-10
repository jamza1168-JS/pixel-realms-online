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

# ------------------------------------------------------------------ mobs
# Each mob: 2 frames (a subtle idle/move cycle). Drawn right-facing.
def build_slime(f2):
    f = Frame(32); g=(87,180,95); G=(150,224,150); dk=(46,122,58); o=(26,58,31)
    if not f2:
        f.rect(8,15,23,28,g); f.rect(10,12,21,15,g); f.rect(12,10,19,12,g)
        f.rect(11,14,15,19,G)
    else:
        f.rect(6,18,25,29,g); f.rect(9,16,22,18,g); f.rect(11,14,20,16,g)
        f.rect(9,17,13,21,G)
    yb = 20 if f2 else 18
    f.px(13,yb,o); f.px(14,yb,o); f.px(18,yb,o); f.px(19,yb,o)  # eyes
    f.rect(14,yb+3,17,yb+4,dk)                                   # mouth
    f.rect(8, 28 if not f2 else 29, 23, 29, dk)                  # base shadow row
    return f

def build_goblin(f2):
    f = Frame(32); sk=(111,174,79); dk=(40,70,30); tun=(122,74,36); eye=(224,64,64); wood=(90,58,30)
    f.rect(11,6,20,13,sk); f.rect(9,8,10,10,sk); f.rect(21,8,22,10,sk)   # head+ears
    f.rect(11,6,20,6,dk); f.px(14,9,eye); f.px(18,9,eye)
    f.rect(12,14,19,21,tun); f.rect(10,15,11,19,sk); f.rect(20,15,21,19,sk)  # body+arms
    f.rect(22,11,23,19,wood)                                              # club
    l1 = 1 if f2 else 0; l2 = 0 if f2 else 1
    f.rect(12,22,14,25+l1,sk); f.rect(17,22,19,25+l2,sk)
    return f

def build_wolf(f2):
    f = Frame(32); gy=(122,127,136); dk=(86,90,99); eye=(255,208,80)
    f.rect(6,14,23,20,gy); f.rect(3,12,7,15,gy)                 # body+tail
    f.rect(20,11,27,18,gy); f.rect(26,14,29,16,gy)             # head+snout
    f.rect(21,9,22,11,gy); f.rect(24,9,25,11,gy); f.px(25,13,eye); f.px(28,15,(20,20,20))
    a = 1 if f2 else 0; b = 0 if f2 else 1
    for x,ph in ((8,a),(12,b),(18,a),(22,b)):
        f.rect(x,20,x+1,25+ph,dk)
    return f

def build_bat(f2):
    f = Frame(32); bd=(58,47,68); wg=(78,63,90); eye=(255,80,80)
    f.rect(14,14,18,21,bd); f.px(13,11,bd); f.px(18,11,bd)      # body+ears
    f.px(14,15,eye); f.px(17,15,eye)
    if not f2:
        f.rect(6,11,13,15,wg); f.rect(19,11,26,15,wg); f.rect(8,10,11,11,wg); f.rect(21,10,24,11,wg)
    else:
        f.rect(6,17,13,21,wg); f.rect(19,17,26,21,wg); f.rect(8,21,11,22,wg); f.rect(21,21,24,22,wg)
    return f

def build_skeleton(f2):
    f = Frame(32); bo=(232,232,224); sh=(168,168,160); eye=(30,34,50); bow=(122,90,48)
    f.rect(12,6,19,12,bo); f.px(14,9,eye); f.px(17,9,eye); f.rect(14,11,17,11,sh)  # skull
    f.rect(13,14,18,21,bo); f.px(14,16,sh); f.px(17,16,sh); f.px(14,18,sh); f.px(17,18,sh)  # ribs
    f.rect(10,14,11,19,bo); f.rect(20,14,21,19,bo)             # arms
    f.rect(22,9,22,21,bow); f.px(21,9,bow); f.px(21,21,bow)    # bow (ranged)
    s = 1 if f2 else 0
    f.rect(13,21,14,26-s,bo); f.rect(17,21,18,25+s,bo)
    return f

def build_demon(f2):
    f = Frame(32); r=(176,52,47); dk=(122,31,28); horn=(232,224,208); eye=(255,208,0); wg=(90,21,18)
    f.rect(11,7,20,15,r); f.rect(9,4,10,7,horn); f.rect(21,4,22,7,horn)  # head+horns
    f.px(13,10,eye); f.px(14,10,eye); f.px(17,10,eye); f.px(18,10,eye)
    f.rect(13,13,18,14,dk); f.px(13,13,horn); f.px(18,13,horn)           # mouth/fangs
    f.rect(10,15,21,24,dk); f.rect(12,17,19,21,r)                        # torso
    f.rect(11,24,14,29,dk); f.rect(17,24,20,29,dk)                       # legs
    if not f2:
        f.rect(4,10,9,20,wg); f.rect(22,10,27,20,wg); f.rect(3,9,4,12,wg); f.rect(27,9,28,12,wg)
    else:
        f.rect(5,12,10,22,wg); f.rect(21,12,26,22,wg); f.rect(4,11,5,14,wg); f.rect(26,11,27,14,wg)
    return f

def build_orc(f2):
    f = Frame(32); sk=(111,174,79); dk=(36,64,31); tusk=(240,240,208); ar=(90,58,36); arL=(138,106,68); eye=(224,64,64)
    f.rect(11,5,20,13,sk); f.rect(11,5,20,5,dk); f.px(14,9,eye); f.px(17,9,eye)  # head
    f.px(13,12,tusk); f.px(18,12,tusk)                                            # tusks
    f.rect(9,14,22,23,ar); f.rect(11,14,20,14,arL); f.rect(13,16,18,19,arL)       # torso armor
    f.rect(6,15,9,21,sk); f.rect(22,15,25,21,sk)                                  # big arms
    a = 1 if f2 else 0; b = 0 if f2 else 1
    f.rect(11,23,15,27+a,ar); f.rect(11,28+a,15,29+a,dk)
    f.rect(16,23,20,27+b,ar); f.rect(16,28+b,20,29+b,dk)
    return f

def build_ghost(f2):
    f = Frame(32); w=(223,239,255); e=(51,56,74); sh=(184,200,221)
    oy = 0 if f2 else -1
    f.rect(9,7+oy,22,10+oy,w); f.rect(8,10+oy,23,22+oy,w); f.rect(10,9+oy,21,9+oy,w)
    f.rect(9,12+oy,12,17+oy,sh)                                   # inner shade
    f.px(13,13+oy,e); f.px(14,13+oy,e); f.px(18,13+oy,e); f.px(19,13+oy,e)  # eyes
    # wavy hem alternates
    if not f2:
        for i,x in enumerate(range(8,23,3)): f.rect(x,22+oy,x+1,24+oy,w)
    else:
        for i,x in enumerate(range(9,24,3)): f.rect(x,22+oy,x+1,24+oy,w)
    return f

def build_ogre(f2):
    f = Frame(32); sk=(127,174,79); dk=(36,64,31); tusk=(240,240,208); belt=(74,47,26); belly=(147,194,95); wood=(90,58,30)
    f.rect(9,4,22,13,sk); f.rect(9,4,22,4,dk); f.px(13,8,(40,40,40)); f.px(18,8,(40,40,40))  # big head
    f.px(12,12,tusk); f.px(19,12,tusk)
    bb = 1 if f2 else 0
    f.rect(7,14,24,25+bb,sk); f.rect(9,16,22,23+bb,belly)          # huge belly (breathes)
    f.rect(9,14,24,15,belt)
    f.rect(24,5,26,16,wood); f.rect(23,4,26,5,(60,40,20))          # club
    f.rect(10,25+bb,14,30,belt); f.rect(17,25+bb,21,30,belt)       # stubby legs
    return f

def build_dragon(f2):
    f = Frame(32); r=(176,52,47); R=(224,112,90); D=(122,31,28); horn=(232,224,208); eye=(255,208,0)
    f.rect(4,18,10,21,r)                                           # tail
    f.rect(10,14,22,24,r); f.rect(12,17,20,22,R)                  # body + belly
    f.rect(17,8,26,15,r); f.rect(25,12,28,14,r)                   # head + snout
    f.rect(18,7,19,8,horn); f.rect(23,7,24,8,horn); f.px(22,11,eye); f.px(23,11,eye)
    f.rect(11,24,14,29,D); f.rect(18,24,21,29,D)                  # legs
    if not f2:                                                     # wings up
        f.rect(6,8,14,13,D); f.rect(18,8,26,13,D); f.rect(5,7,7,9,D); f.rect(25,7,27,9,D)
    else:                                                          # wings down
        f.rect(6,13,14,19,D); f.rect(18,13,26,19,D); f.rect(5,18,7,20,D); f.rect(25,18,27,20,D)
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
    MOBS = {"slime": build_slime, "goblin": build_goblin, "wolf": build_wolf,
            "bat": build_bat, "skeleton": build_skeleton, "demon": build_demon,
            "orc": build_orc, "ghost": build_ghost, "ogre": build_ogre, "dragon": build_dragon}
    for name, fn in MOBS.items():
        export(name, [fn(False), fn(True)], {"idle": [0, 1], "walk": [0, 1]}, 32)
        keys.append(name)
    export("portal", [build_portal(i) for i in range(4)], {"loop": [0, 1, 2, 3]}, 32)
    keys.append("portal")
    # manifest so the client loader discovers art without any code change
    with open(os.path.join(ASSETS, "manifest.json"), "w") as f:
        json.dump({"keys": keys}, f)
    print(f"manifest: {len(keys)} keys. done.")

if __name__ == "__main__":
    main()
