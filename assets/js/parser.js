/*
 * Takip Defteri — parser.js
 * Instagram "Download your information" (JSON) dosyalarını okur ve
 * iki kayıt arasındaki farkları hesaplar. DOM'a bağımlı değildir;
 * hem tarayıcıda (window.TDParser) hem Node'da (require) çalışır.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TDParser = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const key = (u) => String(u).toLowerCase();

  /** Tek bir Instagram kaydından {u, t} çıkarır. t: milisaniye ya da null. */
  function userOf(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const s = (Array.isArray(entry.string_list_data) && entry.string_list_data[0]) || {};
    let u = s.value || '';
    // 2025 sonrası following.json'da kullanıcı adı "title" alanında
    if (!u && entry.title) u = entry.title;
    if (!u && s.href) {
      const m = String(s.href).match(/instagram\.com\/(?:_u\/)?([^\/?#]+)/i);
      if (m) u = decodeURIComponent(m[1]);
    }
    u = String(u).trim().replace(/^@/, '');
    if (!u) return null;
    return { u, t: s.timestamp ? Number(s.timestamp) * 1000 : null };
  }

  /** Dosyadaki kayıt dizisini bulur (followers_1.json dizi, following.json nesne). */
  function entriesOf(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      for (const k of Object.keys(data)) if (Array.isArray(data[k])) return data[k];
    }
    return [];
  }

  /** Dosya adına ve içeriğine göre türü belirler: 'followers' | 'following' | null */
  function kindOf(name, data) {
    const n = String(name).toLowerCase().split('/').pop();
    if (/^followers(_\d+)?\.json$/.test(n)) return 'followers';
    if (n === 'following.json') return 'following';
    if (data && !Array.isArray(data) && Array.isArray(data.relationships_following)) return 'following';
    return null;
  }

  /** Aynı kullanıcıyı bir kez tutar (büyük/küçük harf duyarsız). */
  function uniq(list) {
    const m = new Map();
    for (const x of list) if (x && !m.has(key(x.u))) m.set(key(x.u), x);
    return [...m.values()];
  }

  /**
   * Dosya içeriklerini toplar.
   * @param {{name:string,text:string}[]} files
   * @returns {{followers:{u,t}[], following:{u,t}[], recognized:number, htmlSeen:boolean}}
   */
  function parseFiles(files) {
    const out = { followers: [], following: [], recognized: 0, htmlSeen: false };
    for (const f of files) {
      if (/\.html?$/i.test(f.name) && /follow/i.test(f.name)) { out.htmlSeen = true; continue; }
      if (!/\.json$/i.test(f.name)) continue;
      let data;
      try { data = JSON.parse(f.text); } catch (e) { continue; }
      const kind = kindOf(f.name, data);
      if (!kind) continue;
      out.recognized++;
      for (const e of entriesOf(data)) { const x = userOf(e); if (x) out[kind].push(x); }
    }
    out.followers = uniq(out.followers);
    out.following = uniq(out.following);
    return out;
  }

  /** Bir kaydın içerik imzası; aynı veriyi iki kez kaydetmemek için. */
  function signature(snap) {
    const s = (a) => a.map((x) => key(x.u)).sort().join(',');
    return s(snap.followers) + '|' + s(snap.following);
  }

  /** Tek kayıt içindeki ilişkiler. */
  function relations(snap) {
    const F = new Set(snap.followers.map((x) => key(x.u)));
    const G = new Set(snap.following.map((x) => key(x.u)));
    return {
      notback: snap.following.filter((x) => !F.has(key(x.u))),
      fans: snap.followers.filter((x) => !G.has(key(x.u))),
      mutual: snap.following.filter((x) => F.has(key(x.u))),
    };
  }

  /**
   * Ad değişikliklerini bulur. Instagram takip tarihini (timestamp) kullanıcı
   * adı değişse de korur; giden ve gelen listede aynı tarihli tek bir çift
   * varsa bu büyük ihtimalle aynı hesaptır.
   */
  function matchRenames(gone, came) {
    const byT = (list) => {
      const m = new Map();
      for (const x of list) if (x.t) m.set(x.t, m.has(x.t) ? null : x); // aynı tarihte birden çok kişi varsa eşleştirme
      return m;
    };
    const a = byT(gone), b = byT(came);
    const pairs = [];
    for (const [t, from] of a) { const to = b.get(t); if (from && to) pairs.push({ from: from.u, to: to.u, t }); }
    return pairs;
  }

  /**
   * İki kayıt arasındaki değişim. prev daha eski kayıttır.
   * lost[].reason:
   *   'unfollow' — hesap hâlâ senin takip listende: takipten çıkmış ya da hesabını
   *                dondurmuş olabilir (Instagram dosyası bu ikisini ayırmaz)
   *   'gone'     — hesap senin takip listenden de düşmüş: silinmiş olabilir,
   *                seni engellemiş olabilir ya da sen takipten çıkmış olabilirsin
   *   'unknown'  — sen takip etmiyordun; takipten çıkmış ya da hesabı kapalı olabilir
   */
  function diff(prev, cur) {
    const curF = new Set(cur.followers.map((x) => key(x.u)));
    const curG = new Set(cur.following.map((x) => key(x.u)));
    const prevF = new Set(prev.followers.map((x) => key(x.u)));
    const prevG = new Set(prev.following.map((x) => key(x.u)));

    let lost = prev.followers.filter((x) => !curF.has(key(x.u)));
    let gained = cur.followers.filter((x) => !prevF.has(key(x.u)));
    let youUnfollowed = prev.following.filter((x) => !curG.has(key(x.u)));
    let youFollowed = cur.following.filter((x) => !prevG.has(key(x.u)));

    const renames = matchRenames(lost, gained);
    for (const r of matchRenames(youUnfollowed, youFollowed)) {
      if (!renames.some((x) => key(x.from) === key(r.from))) renames.push(r);
    }
    const fromSet = new Set(renames.map((r) => key(r.from)));
    const toSet = new Set(renames.map((r) => key(r.to)));
    // Ad değiştirenler "çıktı/geldi" diye sayılmasın
    lost = lost.filter((x) => !fromSet.has(key(x.u)));
    gained = gained.filter((x) => !toSet.has(key(x.u)));
    youUnfollowed = youUnfollowed.filter((x) => !fromSet.has(key(x.u)));
    youFollowed = youFollowed.filter((x) => !toSet.has(key(x.u)));

    lost = lost.map((x) => {
      const k = key(x.u);
      const reason = curG.has(k) ? 'unfollow' : prevG.has(k) ? 'gone' : 'unknown';
      return { ...x, reason, still: curG.has(k) };
    });
    return { lost, gained, youUnfollowed, youFollowed, renames };
  }

  /**
   * Bir kullanıcının daha önceki kayıtlarda seni takip edip etmediği.
   * Geri dönen takipçileri (ör. hesabını dondurup açanları) işaretlemek için.
   */
  function wasFollowerBefore(snaps, uptoIndex, username) {
    const k = key(username);
    for (let i = 0; i < uptoIndex; i++) if (snaps[i].followers.some((x) => key(x.u) === k)) return snaps[i].at;
    return null;
  }

  return { userOf, entriesOf, kindOf, uniq, parseFiles, signature, relations, diff, matchRenames, wasFollowerBefore };
});
