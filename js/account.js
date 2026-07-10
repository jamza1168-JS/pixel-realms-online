/* ============================================================
 * account.js — Player accounts + cloud character save (Stage 1a)
 *
 * Online play can sign in to an account; the character (stats,
 * inventory, gold, storage) is stored on the server, so it follows
 * the login instead of the browser. Offline play keeps localStorage.
 * Accounts live on the same origin that served the page (server.py).
 * ============================================================ */

const Account = {
  token: localStorage.getItem('pixelrealms_token') || null,
  username: localStorage.getItem('pixelrealms_account') || null,
  // public player name (globally unique, shown in-game). The username is
  // private and used only for login; heroName is what other players see.
  heroName: localStorage.getItem('pixelrealms_heroname') || null,
  character: null,        // last character loaded from the server
  _lastSave: 0,

  get loggedIn() { return !!this.token; },

  /* Accounts API is same-origin (served by server.py); null offline. */
  base() {
    return (location.protocol === 'http:' || location.protocol === 'https:') ? '' : null;
  },
  available() { return this.base() !== null; },

  async _post(path, body, auth) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && this.token) headers['Authorization'] = 'Bearer ' + this.token;
    const res = await fetch(this.base() + path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* ignore */ }
    return { status: res.status, data };
  },

  _setSession(token, username, heroName) {
    this.token = token; this.username = username;
    this._setHeroName(heroName || null);
    localStorage.setItem('pixelrealms_token', token);
    localStorage.setItem('pixelrealms_account', username);
  },

  _setHeroName(name) {
    this.heroName = name || null;
    if (name) localStorage.setItem('pixelrealms_heroname', name);
    else localStorage.removeItem('pixelrealms_heroname');
  },

  _clearSession() {
    this.token = null; this.username = null; this.character = null;
    this._setHeroName(null);
    localStorage.removeItem('pixelrealms_token');
    localStorage.removeItem('pixelrealms_account');
  },

  async register(u, p) {
    if (this.base() === null) return { ok: false, error: 'offline' };
    try {
      const { status, data } = await this._post('/api/register', { username: u, password: p });
      if (status === 200 && data.token) { this._setSession(data.token, data.username, data.hero_name); return { ok: true }; }
      return { ok: false, error: data.error || 'error' };
    } catch (e) { return { ok: false, error: 'offline' }; }
  },

  async login(u, p) {
    if (this.base() === null) return { ok: false, error: 'offline' };
    try {
      const { status, data } = await this._post('/api/login', { username: u, password: p });
      if (status === 200 && data.token) { this._setSession(data.token, data.username, data.hero_name); return { ok: true }; }
      return { ok: false, error: data.error || 'error' };
    } catch (e) { return { ok: false, error: 'offline' }; }
  },

  async logout() {
    try { await this._post('/api/logout', {}, true); } catch (e) { /* ignore */ }
    this._clearSession();
  },

  /* Claim this account's public player name (fixed once set). */
  async claimHeroName(name) {
    if (!this.token || this.base() === null) return { ok: false, error: 'offline' };
    try {
      const { status, data } = await this._post('/api/hero-name', { name }, true);
      if (status === 200 && data.ok) { this._setHeroName(data.name); return { ok: true, name: data.name }; }
      return { ok: false, error: data.error || 'error' };
    } catch (e) { return { ok: false, error: 'offline' }; }
  },

  /* Fetch the stored character (or null). Clears the token if the
   * server no longer recognizes it (e.g. after a restart). */
  async loadCharacter() {
    if (!this.token || this.base() === null) return null;
    try {
      const res = await fetch(this.base() + '/api/character', {
        headers: { 'Authorization': 'Bearer ' + this.token },
      });
      if (res.status === 401) { this._clearSession(); return null; }
      const data = await res.json();
      this.character = data.character || null;
      if (data.hero_name) this._setHeroName(data.hero_name);
      return this.character;
    } catch (e) { return null; }
  },

  /* Push the current save blob to the server (throttled unless forced). */
  async saveCharacter(data, force) {
    if (!this.token || this.base() === null) return;
    const now = Date.now();
    if (!force && now - this._lastSave < 8000) return;
    this._lastSave = now;
    try {
      const res = await fetch(this.base() + '/api/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.token },
        body: JSON.stringify({ character: data }),
        keepalive: !!force,
      });
      if (res.status === 401) this._clearSession();
    } catch (e) { /* best-effort */ }
  },
};
