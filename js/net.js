/* ============================================================
 * net.js — Network layer
 *
 * The game talks to a NetAdapter, never to sockets directly.
 *  - LocalNet : offline / same-keyboard co-op
 *  - WSNet    : online multiplayer via the relay server (server.py)
 *
 * Online model (host-authoritative over a relay):
 *  - The first client in a room is the HOST. It simulates all
 *    enemies (the world map itself is deterministic from
 *    WORLD_SEED, so only entity state is synced).
 *  - Everyone broadcasts their own player state ~10x/sec.
 *  - Host broadcasts enemy snapshots ~10x/sec, plus events:
 *    enemy deaths, enemy projectiles, damage to remote players.
 *  - Clients send 'hit' events when they damage an enemy; the
 *    host applies them authoritatively.
 *  - If the host leaves, the server promotes the next client,
 *    which adopts the last-known enemy state and continues.
 *
 * Protocol (JSON text frames, 'from' added by the server):
 *  C→S  {t:'join', room, name}
 *  C→S  {t:'state', players:[{k,cls,x,y,f,lv,hp,mhp,d,afk}]}
 *  C→S  {t:'enemies', list:[{i,x,y,hp}]}          (host only)
 *  C→S  {t:'hit', i, dmg}                          (→ host applies)
 *  C→S  {t:'edead', i, xp, x, y, killer, boss}     (host only)
 *  C→S  {t:'eproj', x, y, vx, vy, dmg, boss}       (host only)
 *  C→S  {t:'pdmg', target, amount}                 (host only)
 *  S→C  {t:'welcome', id, host, peers:[{id,name}]}
 *  S→C  {t:'peer'|{t:'leave'}, id, name}
 *  S→C  {t:'host', id}
 * ============================================================ */

class NetAdapter {
  connect() {}
  disconnect() {}
  send(obj) {}
  sync(players) {}
  get isOnline() { return false; }
  get isHost() { return true; }   // offline: we always simulate enemies
  get playerCount() { return 0; }
}

/* Offline / local co-op: nothing to transmit. */
class LocalNet extends NetAdapter {
  constructor() {
    super();
    this.localPlayers = 0;
    this.status = 'off';
    this.id = 'local';
  }
  sync(players) {
    this.localPlayers = players.length;
  }
  get playerCount() { return this.localPlayers; }
}

/* Online multiplayer over the WebSocket relay (server.py). */
class WSNet extends NetAdapter {
  constructor(game) {
    super();
    this.game = game;
    this.ws = null;
    this.id = null;
    this.name = null;
    this.host = false;
    this.peers = new Map();      // clientId -> {name}
    this.status = 'off';         // off | connecting | on | error
    this.lastSend = 0;
  }

  get isOnline() { return this.status === 'on'; }
  get isHost() { return this.status !== 'on' || this.host; }

  get playerCount() {
    let n = this.game.players.length;
    for (const [, arr] of this.game.remotePlayers) n += arr.length;
    return n;
  }

  connect(url, room, name) {
    this.status = 'connecting';
    this.name = name;
    UI.updateOnlinePanel();
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.status = 'error';
      UI.updateOnlinePanel();
      return;
    }
    this.ws.onopen = () => this.send({ t: 'join', room, name });
    this.ws.onmessage = ev => {
      try { this.handle(JSON.parse(ev.data)); } catch (e) { /* ignore bad frame */ }
    };
    this.ws.onclose = () => {
      this.status = this.status === 'connecting' ? 'error' : 'off';
      // only reset the game if we are still its active adapter
      if (this.game.net === this) this.game.onNetDisconnect();
      UI.updateOnlinePanel();
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.status = 'off';
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  handle(m) {
    const g = this.game;
    switch (m.t) {
      case 'welcome':
        this.id = m.id;
        this.host = m.host;
        this.status = 'on';
        for (const pr of m.peers) this.peers.set(pr.id, { name: pr.name });
        if (!this.host) g.clearEnemiesForClientMode();
        UI.toast(t('online.on') + (this.host ? ' ★ ' + t('online.host') : ''));
        UI.updateOnlinePanel();
        g.sfx('levelup');
        break;
      case 'peer':
        this.peers.set(m.id, { name: m.name });
        UI.toast(t('online.joined', { name: m.name }), 'info');
        g.sfx('pickup');
        break;
      case 'leave': {
        const peer = this.peers.get(m.id);
        this.peers.delete(m.id);
        g.remotePlayers.delete(m.id);
        g.onPeerLeft(m.id);
        UI.toast(t('online.left', { name: peer ? peer.name : '?' }), 'info');
        break;
      }
      case 'host': {
        const wasHost = this.host;
        this.host = (m.id === this.id);
        if (!wasHost && this.host) g.becomeHost();
        break;
      }
      case 'state':
        g.applyRemoteState(m.from, m.players);
        break;
      case 'enemies':
        if (!this.host) g.applyEnemySnapshot(m.list);
        break;
      case 'hit':
        if (this.host) g.applyNetHit(m.i, m.dmg, m.from);
        break;
      case 'edead':
        if (!this.host) g.handleEnemyDead(m.i, m.xp, m.x, m.y, m.killer, m.boss, null);
        break;
      case 'eproj':
        g.spawnNetEnemyProjectile(m);
        break;
      case 'pdmg':
        if (m.target && m.target.indexOf(this.id + ':') === 0) {
          const idx = +m.target.split(':')[1];
          const p = g.players[idx];
          if (p && !p.dead) p.takeDamage(m.amount);
        }
        break;
      case 'chat':
        g.onChat(m);
        break;
      case 'trade_req': case 'trade_ok': case 'trade_no':
      case 'trade_set': case 'trade_accept': case 'trade_cancel':
        if (m.to && m.to.indexOf(this.id + ':') === 0) g.onTradeMsg(m);
        break;
    }
  }

  sync(players) {
    if (this.status !== 'on') return;
    const now = performance.now();
    if (now - this.lastSend < 100) return;
    this.lastSend = now;

    this.send({
      t: 'state',
      players: players.map((p, i) => ({
        k: i, cls: p.clsId,
        x: Math.round(p.x), y: Math.round(p.y),
        f: p.face.x < 0 ? -1 : 1,
        lv: p.level,
        hp: Math.round(p.hp), mhp: p.derived.maxHp,
        d: p.dead ? 1 : 0, afk: p.afk ? 1 : 0,
      })),
    });

    if (this.host) {
      this.send({
        t: 'enemies',
        list: this.game.enemies
          .filter(e => !e.dead && !e.remote)
          .map(e => ({ i: e.idx, x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp) })),
      });
    }
  }

  sendHit(i, dmg)          { this.send({ t: 'hit', i, dmg: Math.round(dmg) }); }
  sendEdead(o)             { this.send(Object.assign({ t: 'edead' }, o)); }
  sendEproj(o)             { this.send(Object.assign({ t: 'eproj' }, o)); }
  sendPdmg(target, amount) { this.send({ t: 'pdmg', target, amount: Math.round(amount) }); }
}
