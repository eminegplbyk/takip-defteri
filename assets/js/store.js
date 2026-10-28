/*
 * Takip Defteri — store.js
 * Kayıt geçmişini, muaf tutulan hesapları ve tema tercihini
 * tarayıcının localStorage'ında saklar. Veri hiçbir sunucuya gitmez.
 */
(function (root) {
  'use strict';
  const KEY = 'takip-defteri-v2';
  const OLD_KEY = 'takip-defteri-v1';
  const MAX_SNAPSHOTS = 52; // yaklaşık bir yıllık haftalık kayıt

  // Kayıtlar yer kaplamasın diye kullanıcılar [ad, saniye] çifti olarak tutulur
  const pack = (list) => list.map((x) => (x.t ? [x.u, Math.round(x.t / 1000)] : [x.u]));
  const unpack = (list) =>
    (list || []).map((x) => (typeof x === 'string' ? { u: x, t: null } : { u: x[0], t: x[1] ? x[1] * 1000 : null }));

  function empty() { return { snapshots: [], exempt: [], closed: [], theme: 'system' }; }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        return { ...empty(), ...d };
      }
      // v1'den taşı: v1 sadece kullanıcı adı dizileri tutuyordu
      const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
      if (Array.isArray(old) && old.length) {
        const d = empty();
        d.snapshots = old.map((s) => ({ at: s.at, followers: s.followers, following: s.following }));
        write(d);
        return d;
      }
    } catch (e) { /* gizli pencere vb. */ }
    return empty();
  }

  function write(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
  }

  let db = read();

  const api = {
    available() {
      try { const k = '__td'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; }
    },
    snapshots() {
      return db.snapshots
        .map((s) => ({ at: s.at, followers: unpack(s.followers), following: unpack(s.following) }))
        .sort((a, b) => a.at - b.at);
    },
    /** Yeni kayıt ekler. Son kayıtla aynıysa eklemez. {added, index} döner. */
    add(snap, signature) {
      const list = api.snapshots();
      const last = list[list.length - 1];
      if (last && signature(last) === signature(snap)) return { added: false, index: list.length - 1 };
      db.snapshots.push({ at: snap.at, followers: pack(snap.followers), following: pack(snap.following) });
      db.snapshots.sort((a, b) => a.at - b.at);
      if (db.snapshots.length > MAX_SNAPSHOTS) db.snapshots = db.snapshots.slice(-MAX_SNAPSHOTS);
      write(db);
      return { added: true, index: api.snapshots().findIndex((s) => s.at === snap.at) };
    },
    remove(at) { db.snapshots = db.snapshots.filter((s) => s.at !== at); write(db); },
    clear() { db.snapshots = []; write(db); },

    // İşaret listeleri: 'exempt' (muaf: ünlü, marka) ve 'closed' (profilini kontrol ettin, hesap kapalı)
    marks(list) { return new Set((db[list] || []).map((u) => u.toLowerCase())); },
    toggleMark(list, u) {
      const k = u.toLowerCase();
      const cur = db[list] || [];
      const has = cur.some((x) => x.toLowerCase() === k);
      db[list] = has ? cur.filter((x) => x.toLowerCase() !== k) : cur.concat(u);
      write(db);
      return !has;
    },
    exempt() { return api.marks('exempt'); },
    toggleExempt(u) { return api.toggleMark('exempt', u); },

    theme() { return db.theme || 'system'; },
    setTheme(t) { db.theme = t; write(db); },

    /** Yedek dosyası içeriği */
    exportJSON() {
      return JSON.stringify({ app: 'takip-defteri', version: 2, exportedAt: new Date().toISOString(), ...db }, null, 2);
    },
    /** Yedekten geri yükler; mevcut kayıtlarla birleştirir. Eklenen kayıt sayısını döner. */
    importJSON(text) {
      const d = JSON.parse(text);
      if (!d || d.app !== 'takip-defteri' || !Array.isArray(d.snapshots)) throw new Error('Bu bir Takip Defteri yedeği değil.');
      const seen = new Set(db.snapshots.map((s) => s.at));
      let n = 0;
      for (const s of d.snapshots) if (s && s.at && !seen.has(s.at)) { db.snapshots.push(s); n++; }
      db.snapshots.sort((a, b) => a.at - b.at);
      const ex = new Set(db.exempt.map((u) => u.toLowerCase()));
      for (const u of d.exempt || []) if (!ex.has(u.toLowerCase())) db.exempt.push(u);
      db.closed = db.closed || [];
      const cl = new Set(db.closed.map((u) => u.toLowerCase()));
      for (const u of d.closed || []) if (!cl.has(u.toLowerCase())) db.closed.push(u);
      write(db);
      return n;
    },
  };

  root.TDStore = api;
})(typeof self !== 'undefined' ? self : this);
