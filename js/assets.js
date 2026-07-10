/* ============================================================
 * assets.js — optional PNG spritesheet loader + animation
 *
 * At boot, reads assets/manifest.json and loads each listed
 * spritesheet (assets/<key>.png + <key>.json = {frameW, frames, anims}).
 * Frames are sliced into canvases. `drawSprite()` prefers a loaded,
 * animated frame and falls back to the procedural SPRITES canvas, so
 * the game works unchanged until art exists — and upgrades sprite by
 * sprite as sheets are added (see tools/art/generate.py).
 * ============================================================ */

const Assets = {
  data: {},          // key -> { frames:[canvas], anims:{}, size }
  loaded: false,

  load() {
    return fetch('assets/manifest.json')
      .then(r => (r.ok ? r.json() : { keys: [] }))
      .then(m => Promise.all((m.keys || []).map(k => this._one(k))))
      .then(() => { this.loaded = true; })
      .catch(() => { this.loaded = true; });
  },

  _img(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
  },

  async _one(key) {
    try {
      const meta = await fetch('assets/' + key + '.json').then(r => (r.ok ? r.json() : null));
      if (!meta) return;
      const img = await this._img('assets/' + key + '.png');
      const s = meta.frameW, n = meta.frames || Math.max(1, Math.floor(img.width / s));
      const frames = [];
      for (let i = 0; i < n; i++) {
        const c = document.createElement('canvas');
        c.width = s; c.height = s;
        c.getContext('2d').drawImage(img, i * s, 0, s, s, 0, 0, s, s);
        frames.push(c);
      }
      this.data[key] = { frames, anims: meta.anims || {}, size: s };
    } catch (e) { /* leave on procedural fallback */ }
  },

  /* Pick the current frame for a sprite: walk vs idle (or a plain loop),
   * indexed by the entity's rolling animT. Returns a canvas or null. */
  frame(key, moving, animT) {
    const d = this.data[key];
    if (!d) return null;
    const a = d.anims || {};
    const loop = a.loop;
    const seq = loop || (moving && a.walk ? a.walk : (a.idle || [0]));
    const rate = loop ? 4 : 6;
    const idx = seq[Math.floor((animT || 0) * rate) % seq.length];
    return d.frames[idx] || d.frames[0] || null;
  },
};

/* Draw a sprite by key, honoring facing + animation, with procedural
 * fallback. `size` is the on-screen square (keeps existing footprint). */
function drawSprite(g2d, key, faceLeft, sx, sy, size, moving, animT) {
  const fr = Assets.frame(key, moving, animT);
  if (fr) {
    if (faceLeft) {
      g2d.save();
      g2d.translate(sx + size, sy);
      g2d.scale(-1, 1);
      g2d.drawImage(fr, 0, 0, size, size);
      g2d.restore();
    } else {
      g2d.drawImage(fr, sx, sy, size, size);
    }
    return true;
  }
  const s = SPRITES[key + (faceLeft ? '_f' : '')] || SPRITES[key];
  if (s) g2d.drawImage(s, sx, sy, size, size);
  return false;
}

// begin loading immediately; the render path falls back until frames arrive
Assets.load();
