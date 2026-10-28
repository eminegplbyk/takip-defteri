/*
 * Takip Defteri — app.js
 * Arayüz: dosya yükleme, sekmeler, grafik, arama/sıralama, geçmiş ve yedek.
 * Bağımlılıklar: TDParser (parser.js), TDStore (store.js), JSZip (opsiyonel, ZIP için)
 */
(function () {
  'use strict';
  const P = window.TDParser;
  const S = window.TDStore;
  const $ = (id) => document.getElementById(id);
  const key = (u) => String(u).toLowerCase();
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const fmtDate = (t) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtShort = (t) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const fmtDT = (t) => new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  /* ---------- örnek veri (açıkça "ornek." önekli, gerçek kişi değil) ---------- */
  function buildSample() {
    const first = ['deniz', 'ayse', 'mert', 'zeynep', 'can', 'elif', 'burak', 'selin', 'kaan', 'ipek', 'oguz', 'ece', 'emre', 'derya', 'baris', 'sena', 'onur', 'gizem', 'tolga', 'irem', 'umut', 'nazli', 'alp', 'melis', 'koray', 'busra', 'efe', 'dila', 'arda', 'ceren'];
    const suf = ['', '_k', '.y', '34', '_06', '.art', '_foto', '.dev'];
    const pool = [];
    for (let i = 0; pool.length < 90; i++) pool.push('ornek.' + first[i % first.length] + suf[Math.floor(i / first.length) % suf.length]);
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const day = 864e5, now = Date.now();
    const followSince = new Map(pool.map((u, i) => [u, now - (400 - i * 3) * day]));
    let F = new Set(pool.slice(0, 52));
    const G = new Set(pool.slice(20, 80));
    const snaps = [];
    for (let w = 5; w >= 0; w--) {
      const at = now - w * 7 * day - 2 * 3600e3;
      if (w === 3) { F.delete(pool[30]); G.delete(pool[30]); } // hesabını kapatan biri
      if (w === 2) { // adını değiştiren biri: takip tarihi aynı kalır
        const o = pool[25], n = 'ornek.yeni_adi';
        followSince.set(n, followSince.get(o));
        if (F.delete(o)) F.add(n);
        if (G.delete(o)) G.add(n);
      }
      if (w < 5) {
        // her hafta birkaç kişi çıkar, birkaç kişi gelir
        const arr = [...F];
        for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) { const u = arr[Math.floor(rnd() * arr.length)]; if (u !== 'ornek.yeni_adi') F.delete(u); }
        for (let k = 0; k < 2 + Math.floor(rnd() * 4); k++) {
          const u = pool[52 + Math.floor(rnd() * 38)];
          if (!F.has(u)) { F.add(u); followSince.set(u, at - day); }
        }
      }
      snaps.push({
        at,
        followers: [...F].map((u) => ({ u, t: followSince.get(u) })),
        following: [...G].map((u) => ({ u, t: followSince.get(u) - 30 * day })),
      });
    }
    return snaps;
  }

  /* ---------- durum ---------- */
  const TABS = [
    { id: 'lost', hash: 'cikanlar', label: 'Takipten çıkanlar', tone: 'lost', needsPrev: true, hint: 'Karşılaştırılan kayıtta seni takip eden ama şimdi etmeyenler. Instagram\'ın dosyası dondurulmuş hesapları ayırmıyor, o yüzden bazıları sadece hesabını kapatmış olabilir. Profiline bakıp kapalıysa "Hesap kapalı" diye işaretle. Adını değiştirenleri buraya saymıyorum.' },
    { id: 'gained', hash: 'yeniler', label: 'Yeni takipçiler', tone: 'gain', needsPrev: true, hint: 'Karşılaştırılan kayıttan bu yana seni takip etmeye başlayanlar. Daha önce de takip edip bir süre kaybolanları "Geri döndü" diye işaretliyorum; bunlar genelde hesabını dondurup tekrar açanlardır.' },
    { id: 'notback', hash: 'geri-takip-etmeyen', label: 'Geri takip etmeyenler', tone: '', hint: 'Senin takip ettiğin ama seni takip etmeyen hesaplar. Instagram\'ın dosyasında dondurulmuş hesaplar da bulunabiliyor. Profiline baktığında hesap kapalıysa "Hesap kapalı" de, ünlü ya da markaysa "Muaf tut" de. İkisi de listeden gizlenir ve bir dahaki yüklemede hatırlanır.' },
    { id: 'fans', hash: 'takip-etmediklerin', label: 'Senin takip etmediklerin', tone: '', hint: 'Seni takip eden ama senin takip etmediğin hesaplar.' },
    { id: 'mutual', hash: 'karsilikli', label: 'Karşılıklı', tone: '', tile: false, hint: 'Hem senin takip ettiğin hem de seni takip eden hesaplar.' },
    { id: 'log', hash: 'gunluk', label: 'Değişim günlüğü', tone: '', tile: false, hint: 'Tüm kayıtların boyunca kim geldi, kim gitti. En yeni değişim en üstte.' },
  ];
  const PAGE = 150;

  const state = {
    sample: true,
    snaps: [],
    cur: 0,          // gösterilen kayıt
    cmp: -1,         // karşılaştırılan kayıt (-1: yok)
    tab: 'lost',
    q: '',
    sort: 'az',
    showExempt: false,
    reason: 'all',
    limit: PAGE,
    tileVals: {},
  };

  function useSnaps(snaps, sample) {
    state.sample = sample;
    state.snaps = snaps;
    state.cur = snaps.length - 1;
    state.cmp = snaps.length > 1 ? snaps.length - 2 : -1;
    $('banner').hidden = !sample;
    $('sampleBtn').hidden = sample || !S.snapshots().length;
    $('mineBtn').hidden = !sample || !S.snapshots().length;
  }

  /* ---------- yardımcılar ---------- */
  let toastTimer;
  function toast(msg, tone) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (tone || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = 'toast'), 2600);
  }
  function showStatus(kind, msg) {
    const s = $('status');
    s.className = 'status ' + kind;
    s.textContent = msg;
    s.hidden = !msg;
  }
  function countUp(el, to, id) {
    const from = state.tileVals[id] ?? 0;
    state.tileVals[id] = to;
    if (reduceMotion || from === to || typeof to !== 'number') { el.textContent = to; return; }
    const t0 = performance.now(), dur = 450;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg, 'ok'); }
    catch (e) {
      // yedek yol: geçici textarea ile seçtir
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      toast(ok ? okMsg : 'Kopyalanamadı. Tarayıcın panoya erişime izin vermiyor.', ok ? 'ok' : 'err');
    }
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- dosya okuma ---------- */
  async function collect(fileList) {
    const files = [];
    let backup = null;
    for (const f of fileList) {
      if (/\.zip$/i.test(f.name)) {
        if (!window.JSZip) throw new Error('ZIP açıcı yüklenemedi. ZIP\'i bilgisayarında açıp JSON dosyalarını seçebilirsin.');
        const z = await JSZip.loadAsync(f);
        for (const n of Object.keys(z.files)) {
          if (z.files[n].dir) continue;
          if (/(followers(_\d+)?|following)\.(json|html?)$/i.test(n)) files.push({ name: n, text: await z.files[n].async('string') });
        }
      } else {
        const text = await f.text();
        if (/\.json$/i.test(f.name) && text.includes('"app"') && text.includes('takip-defteri')) backup = text;
        else files.push({ name: f.name, text });
      }
    }
    return { files, backup };
  }

  async function handle(fileList) {
    if (!fileList || !fileList.length) return;
    showStatus('info', 'Dosyalar okunuyor…');
    try {
      const { files, backup } = await collect(fileList);
      if (backup) {
        const n = S.importJSON(backup);
        useSnaps(S.snapshots(), false);
        showStatus('ok', `Yedek geri yüklendi. ${n} yeni kayıt eklendi.`);
        render();
        return;
      }
      const r = P.parseFiles(files);
      if (!r.recognized) {
        showStatus('err', r.htmlSeen
          ? 'Bu dosya HTML formatında. Instagram\'dan indirirken formatı JSON seçip tekrar indir.'
          : 'Takipçi dosyası bulamadım. ZIP\'in içinde followers_1.json ve following.json olmalı.');
        return;
      }
      if (!r.followers.length || !r.following.length) {
        showStatus('err', !r.followers.length
          ? 'Takipçi listesi (followers_1.json) eksik. İki dosyayı birlikte yükle.'
          : 'Takip edilenler listesi (following.json) eksik. İki dosyayı birlikte yükle.');
        return;
      }
      const snap = { at: Date.now(), followers: r.followers, following: r.following };
      let snaps, idx, added;
      if (S.available()) {
        const res = S.add(snap, P.signature);
        snaps = S.snapshots(); idx = res.index; added = res.added;
      } else {
        snaps = [snap]; idx = 0; added = true;
      }
      useSnaps(snaps, false);
      state.cur = idx;
      state.cmp = idx > 0 ? idx - 1 : -1;
      state.tab = state.cmp >= 0 ? 'lost' : 'notback';
      state.limit = PAGE;
      const parts = [`${r.followers.length} takipçi, ${r.following.length} takip edilen yüklendi.`];
      if (!added) parts.push('Bu veri son kayıtla aynı, yeniden kaydetmedim.');
      if (state.cmp >= 0) parts.push(`${fmtDT(snaps[state.cmp].at)} kaydıyla karşılaştırılıyor.`);
      else parts.push('Bu ilk kaydın. Bir sonraki yüklemede kimin çıktığını göstereceğim.');
      if (!S.available()) parts.push('Tarayıcın kayıt tutmaya izin vermiyor, geçmiş saklanmayacak.');
      showStatus('ok', parts.join(' '));
      render();
      $('results').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    } catch (e) {
      showStatus('err', e.message || 'Dosya okunamadı.');
    }
  }

  /* ---------- hesaplama ---------- */
  function compute() {
    const cur = state.snaps[state.cur];
    const prev = state.cmp >= 0 ? state.snaps[state.cmp] : null;
    const rel = P.relations(cur);
    const d = prev ? P.diff(prev, cur) : { lost: [], gained: [], renames: [] };
    // daha önceki kayıtlarda takipçi olup arada kaybolanlar
    const earlier = new Set();
    if (prev) for (let i = 0; i < state.cmp; i++) for (const x of state.snaps[i].followers) earlier.add(key(x.u));
    const gained = d.gained.map((x) => ({ ...x, returned: earlier.has(key(x.u)) }));
    const closed = S.marks('closed');
    const lostAll = d.lost.map((x) => (closed.has(key(x.u)) ? { ...x, reason: 'closed' } : x));
    const lost = state.reason === 'all' ? lostAll
      : state.reason === 'sure' ? lostAll.filter((x) => x.reason === 'unfollow')
      : lostAll.filter((x) => x.reason !== 'unfollow');
    const ex = S.exempt();
    const notbackAll = rel.notback;
    const hiddenNB = (x) => ex.has(key(x.u)) || closed.has(key(x.u));
    return {
      cur, prev, ex, closed,
      lost, gained, lostAll, renames: d.renames,
      sureCount: lostAll.filter((x) => x.reason === 'unfollow').length,
      notback: state.showExempt ? notbackAll : notbackAll.filter((x) => !hiddenNB(x)),
      exemptCount: notbackAll.filter((x) => ex.has(key(x.u))).length,
      closedCount: notbackAll.filter((x) => closed.has(key(x.u))).length,
      fans: rel.fans, mutual: rel.mutual,
    };
  }

  function sorted(list) {
    const q = state.q;
    let out = q ? list.filter((x) => key(x.u).includes(q)) : list.slice();
    const byName = (a, b) => key(a.u).localeCompare(key(b.u), 'tr');
    const byTime = (a, b) => (a.t || 0) - (b.t || 0);
    if (state.sort === 'az') out.sort(byName);
    else if (state.sort === 'za') out.sort((a, b) => byName(b, a));
    else if (state.sort === 'new') out.sort((a, b) => byTime(b, a));
    else if (state.sort === 'old') out.sort(byTime);
    return out;
  }

  /* ---------- çizim ---------- */
  function render() {
    if (!state.snaps.length) return;
    const C = compute();
    renderSelectors();
    renderChart();
    renderTiles(C);
    renderTabs();
    renderList(C);
    renderHistory();
  }

  function renderSelectors() {
    const curSel = $('curSel'), cmpSel = $('cmpSel');
    curSel.innerHTML = ''; cmpSel.innerHTML = '';
    state.snaps.forEach((s, i) => {
      const label = fmtDT(s.at) + (i === state.snaps.length - 1 ? ' (en yeni)' : '');
      curSel.add(new Option(label, i, false, i === state.cur));
    });
    cmpSel.add(new Option('Karşılaştırma yok', -1, false, state.cmp === -1));
    state.snaps.forEach((s, i) => {
      if (i === state.cur) return;
      cmpSel.add(new Option(fmtDT(s.at), i, false, i === state.cmp));
    });
    $('selRow').hidden = state.snaps.length < 2;
  }

  function renderChart() {
    const box = $('chart');
    const snaps = state.snaps;
    $('chartCard').hidden = snaps.length < 2;
    if (snaps.length < 2) return;
    const W = Math.max(280, box.clientWidth || 600), H = 170;
    const pad = { l: 40, r: 14, t: 14, b: 26 };
    const fs = snaps.map((s) => s.followers.length), gs = snaps.map((s) => s.following.length);
    let lo = Math.min(...fs, ...gs), hi = Math.max(...fs, ...gs);
    const span = Math.max(4, hi - lo);
    lo = Math.max(0, Math.floor(lo - span * 0.15)); hi = Math.ceil(hi + span * 0.15);
    const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (snaps.length - 1);
    const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
    const path = (arr) => arr.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    const area = path(fs) + ` L${x(fs.length - 1).toFixed(1)} ${H - pad.b} L${x(0).toFixed(1)} ${H - pad.b} Z`;
    const step = Math.ceil(snaps.length / Math.max(2, Math.floor((W - pad.l) / 70)));
    let ticks = '';
    snaps.forEach((s, i) => {
      if (i % step === 0 || i === snaps.length - 1) {
        ticks += `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === snaps.length - 1 ? 'end' : 'middle'}" class="ax">${fmtShort(s.at)}</text>`;
      }
    });
    const grid = [lo, Math.round((lo + hi) / 2), hi].map((v) =>
      `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end" class="ax">${v}</text>`).join('');
    let pts = '';
    snaps.forEach((s, i) => {
      const on = i === state.cur;
      pts += `<g class="pt${on ? ' on' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="${fmtDate(s.at)} kaydını göster: ${fs[i]} takipçi">
        <rect x="${x(i) - 14}" y="${pad.t}" width="28" height="${H - pad.t - pad.b}" fill="transparent"/>
        <circle cx="${x(i)}" cy="${y(gs[i])}" r="3" class="dot-g"/>
        <circle cx="${x(i)}" cy="${y(fs[i])}" r="${on ? 6 : 4}" class="dot-f"/>
        ${on ? `<text x="${Math.min(W - pad.r, Math.max(pad.l, x(i)))}" y="${y(fs[i]) - 12}" text-anchor="${i === 0 ? 'start' : i === snaps.length - 1 ? 'end' : 'middle'}" class="val">${fs[i]}</text>` : ''}
      </g>`;
    });
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Takipçi sayısının kayıtlara göre değişimi">
      ${grid}
      <path d="${area}" class="area"/>
      <path d="${path(gs)}" class="line-g"/>
      <path d="${path(fs)}" class="line-f"/>
      ${ticks}${pts}</svg>`;
    box.querySelectorAll('.pt').forEach((g) => {
      const pick = () => { const i = +g.dataset.i; state.cur = i; state.cmp = i > 0 ? i - 1 : -1; state.limit = PAGE; render(); };
      g.addEventListener('click', pick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    const df = fs[fs.length - 1] - fs[0];
    $('chartNote').textContent = `${fmtShort(snaps[0].at)} – ${fmtShort(snaps[snaps.length - 1].at)} arası takipçi değişimi: ${df > 0 ? '+' : ''}${df}`;
  }

  function renderTiles(C) {
    const tiles = $('tiles');
    if (!tiles.children.length) {
      for (const t of TABS.filter((t) => t.tile !== false)) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'tile ' + t.tone; b.dataset.tab = t.id;
        b.innerHTML = `<span class="n">0</span><span class="l">${t.label}</span>`;
        b.onclick = () => setTab(t.id);
        tiles.appendChild(b);
      }
    }
    for (const b of tiles.children) {
      const t = TABS.find((x) => x.id === b.dataset.tab);
      b.setAttribute('aria-pressed', String(state.tab === t.id));
      const n = b.querySelector('.n');
      let sub = b.querySelector('.s');
      if (!sub) { sub = document.createElement('span'); sub.className = 's'; b.appendChild(sub); }
      sub.textContent = '';
      if (t.needsPrev && !C.prev) { n.textContent = '–'; state.tileVals[t.id] = 0; continue; }
      const v = t.id === 'lost' ? C.lostAll.length : C[t.id].length;
      countUp(n, v, t.id);
      if (t.id === 'lost' && v) { const c = C.lostAll.filter((x) => x.reason === 'closed').length; if (c) sub.textContent = `${c} kapalı hesap`; }
      if (t.id === 'notback' && (C.closedCount || C.exemptCount) && !state.showExempt) sub.textContent = `${C.closedCount + C.exemptCount} gizlendi`;
      if (t.id === 'gained' && C.gained.some((x) => x.returned)) sub.textContent = `${C.gained.filter((x) => x.returned).length} geri dönen`;
    }
    $('base').innerHTML =
      `<span>Takipçi <b>${C.cur.followers.length}</b></span><span>Takip edilen <b>${C.cur.following.length}</b></span><span>Karşılıklı <b>${C.mutual.length}</b></span>` +
      (C.prev ? `<span>Karşılaştırma: <b>${fmtDate(C.prev.at)}</b> → <b>${fmtDate(C.cur.at)}</b></span>` : '');
  }

  function renderTabs() {
    const tabs = $('tabs');
    tabs.innerHTML = '';
    for (const t of TABS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tab'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(state.tab === t.id));
      b.textContent = t.label;
      b.onclick = () => setTab(t.id);
      tabs.appendChild(b);
    }
    const t = TABS.find((x) => x.id === state.tab);
    $('hint').textContent = t.hint;
    $('exWrap').hidden = state.tab !== 'notback';
    $('reasonWrap').hidden = state.tab !== 'lost';
    $('reason').value = state.reason;
    $('sort').disabled = state.tab === 'log';
  }

  function row(x, opts) {
    const li = document.createElement('li');
    const av = document.createElement('span');
    av.className = 'av'; av.textContent = (x.u.replace(/^ornek\./, '').replace(/[^a-z0-9]/gi, '')[0] || '?');
    const who = document.createElement('div'); who.className = 'who';
    const a = document.createElement('a');
    a.href = 'https://www.instagram.com/' + encodeURIComponent(x.u) + '/';
    a.target = '_blank'; a.rel = 'noopener'; a.textContent = '@' + x.u;
    who.appendChild(a);
    if (x.t && opts.dateLabel) {
      const s = document.createElement('small'); s.textContent = opts.dateLabel + fmtDate(x.t); who.appendChild(s);
    }
    if (opts.note) { const s = document.createElement('small'); s.textContent = opts.note; who.appendChild(s); }
    li.append(av, who);
    for (const p of opts.pills || []) {
      const el = document.createElement('span'); el.className = 'pill ' + p[0]; el.textContent = p[1]; li.appendChild(el);
    }
    if (opts.closed !== undefined) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mini' + (opts.closed ? ' on' : '');
      b.textContent = opts.closed ? 'Hesap kapalı ✓' : 'Hesap kapalı';
      b.title = opts.closed ? 'İşareti kaldır' : 'Profiline baktın ve hesap dondurulmuş ya da silinmiş görünüyorsa işaretle';
      b.onclick = () => {
        const on = S.toggleMark('closed', x.u);
        toast(on ? `@${x.u} kapalı hesap olarak işaretlendi` : `@${x.u} işareti kaldırıldı`, 'ok');
        render();
      };
      li.appendChild(b);
    }
    if (opts.exempt !== undefined) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mini' + (opts.exempt ? ' on' : '');
      b.textContent = opts.exempt ? 'Muaf ✓' : 'Muaf tut';
      b.title = opts.exempt ? 'Muafiyeti kaldır' : 'Bu hesabı "geri takip etmeyenler" listesinde gösterme';
      b.onclick = () => {
        const on = S.toggleExempt(x.u);
        toast(on ? `@${x.u} muaf tutuldu` : `@${x.u} tekrar listede`, 'ok');
        render();
      };
      li.appendChild(b);
    }
    return li;
  }

  function lostOpts(x) {
    if (x.reason === 'closed') return { pills: [['muted', 'Hesap kapalı']], note: 'Profiline bakıp kapalı olarak işaretledin. Takipten çıkmış sayılmaz.' };
    if (x.reason === 'unfollow') return { pills: [['lost', 'Çıktı ya da hesabı kapalı']], note: 'Hâlâ senin takip listende. Takipten çıkmış olabilir ama Instagram dondurulmuş hesapları da bu şekilde gösterebiliyor. Profiline bakıp emin ol.' };
    if (x.reason === 'gone') return { pills: [['warn', 'Senin listenden de düştü']], note: 'Hesabını silmiş, seni engellemiş ya da sen takipten çıkmış olabilirsin.' };
    return { pills: [['muted', 'Belirsiz']], note: 'Sen takip etmiyordun, o yüzden takipten mi çıktı yoksa hesabını mı kapattı bilemiyorum.' };
  }
  function gainedOpts(x) {
    return x.returned
      ? { pills: [['gain', 'Geri döndü']], note: 'Daha önce de takip ediyordu, arada listeden düşmüştü. Büyük ihtimalle hesabını dondurup tekrar açtı.' }
      : { pills: [['gain', 'Yeni']] };
  }
  function renderRenames(C) {
    const box = $('renames');
    const show = (state.tab === 'lost' || state.tab === 'gained') && C.renames.length;
    box.hidden = !show;
    if (!show) return;
    box.innerHTML = `<b>${C.renames.length} hesap adını değiştirmiş.</b> Bunları çıkan ya da yeni gelen saymadım: ` +
      C.renames.map((r) => `<span class="rn">@${esc(r.from)} → @${esc(r.to)}</span>`).join(', ');
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function renderList(C) {
    const ul = $('list'); ul.innerHTML = '';
    $('more').hidden = true;
    const t = TABS.find((x) => x.id === state.tab);
    const empty = (msg) => { ul.innerHTML = `<li class="empty">${msg}</li>`; $('count').textContent = ''; };
    $('renames').hidden = true;

    if (state.tab === 'log') return renderLog(ul);
    if (t.needsPrev && !C.prev) {
      return empty(state.snaps.length < 2
        ? 'Bu ilk kaydın. Birkaç gün sonra verini tekrar indirip yüklediğinde aradaki farkı burada göreceksin.'
        : 'Karşılaştırmak için yukarıdan bir kayıt seç.');
    }
    renderRenames(C);
    const items = sorted(C[state.tab]);
    const hid = [];
    if (state.tab === 'notback' && !state.showExempt) {
      if (C.closedCount) hid.push(`${C.closedCount} kapalı hesap`);
      if (C.exemptCount) hid.push(`${C.exemptCount} muaf`);
    }
    $('count').textContent = `${items.length} hesap` + (hid.length ? ` · gizlenen: ${hid.join(', ')}` : '');
    if (!items.length) {
      return empty(state.q ? 'Aramana uyan kullanıcı yok.'
        : state.tab === 'lost' ? (state.reason === 'all' ? 'Bu aralıkta kimse takipten çıkmamış.' : 'Bu filtreye uyan hesap yok.')
        : state.tab === 'gained' ? 'Bu aralıkta yeni takipçi yok.'
        : 'Bu listede kimse yok.');
    }
    const frag = document.createDocumentFragment();
    for (const x of items.slice(0, state.limit)) {
      const opts = {};
      if (state.tab === 'lost') Object.assign(opts, lostOpts(x), { closed: C.closed.has(key(x.u)) });
      if (state.tab === 'gained') Object.assign(opts, gainedOpts(x), { dateLabel: 'Takip tarihi: ' });
      if (state.tab === 'fans') opts.dateLabel = 'Seni takip ettiği tarih: ';
      if (state.tab === 'mutual' || state.tab === 'notback') opts.dateLabel = 'Senin takip ettiğin tarih: ';
      if (state.tab === 'notback') { opts.closed = C.closed.has(key(x.u)); opts.exempt = C.ex.has(key(x.u)); }
      frag.appendChild(row(x, opts));
    }
    ul.appendChild(frag);
    const rest = items.length - state.limit;
    if (rest > 0) { $('more').hidden = false; $('more').textContent = `${Math.min(PAGE, rest)} hesap daha göster (${rest} kaldı)`; }
  }

  function renderLog(ul) {
    const snaps = state.snaps;
    if (snaps.length < 2) {
      ul.innerHTML = '<li class="empty">Günlük için en az iki kayıt gerekiyor. Verini birkaç gün arayla tekrar yükle.</li>';
      $('count').textContent = '';
      return;
    }
    let total = 0;
    const frag = document.createDocumentFragment();
    for (let i = snaps.length - 1; i > 0; i--) {
      const d = P.diff(snaps[i - 1], snaps[i]);
      const q = state.q;
      const lost = d.lost.filter((x) => !q || key(x.u).includes(q));
      const gained = d.gained.filter((x) => !q || key(x.u).includes(q));
      const head = document.createElement('li');
      head.className = 'group';
      head.innerHTML = `<b>${fmtShort(snaps[i - 1].at)} → ${fmtDate(snaps[i].at)}</b>
        <span class="pill lost">−${d.lost.length}</span><span class="pill gain">+${d.gained.length}</span>` +
        (d.renames.length ? `<span class="pill muted">${d.renames.length} ad değişikliği</span>` : '');
      frag.appendChild(head);
      const earlier = new Set();
      for (let j = 0; j < i - 1; j++) for (const x of snaps[j].followers) earlier.add(key(x.u));
      const renames = d.renames.filter((r) => !q || key(r.from).includes(q) || key(r.to).includes(q));
      if (!lost.length && !gained.length && !renames.length) {
        const li = document.createElement('li'); li.className = 'quiet';
        li.textContent = q ? 'Aramana uyan değişiklik yok.' : 'Değişiklik yok.'; frag.appendChild(li);
      }
      for (const x of lost) frag.appendChild(row(x, lostOpts(x)));
      for (const x of gained) frag.appendChild(row(x, gainedOpts({ ...x, returned: earlier.has(key(x.u)) })));
      for (const r of renames) frag.appendChild(row({ u: r.to, t: r.t }, { pills: [['muted', 'Ad değiştirdi']], note: `Eski adı @${r.from}` }));
      total += d.lost.length + d.gained.length;
    }
    ul.appendChild(frag);
    $('count').textContent = `${snaps.length - 1} aralıkta ${total} değişiklik`;
  }

  function renderHistory() {
    const box = $('hist'); box.innerHTML = '';
    const real = S.snapshots();
    $('histCount').textContent = real.length ? `(${real.length})` : '';
    if (!real.length) {
      box.innerHTML = '<p class="hint flush">Henüz kayıt yok. İlk dosyanı yüklediğinde burada görünecek.</p>';
      return;
    }
    real.slice().reverse().forEach((s) => {
      const r = document.createElement('div'); r.className = 'hrow';
      r.innerHTML = `<span><b>${fmtDT(s.at)}</b> · ${s.followers.length} takipçi · ${s.following.length} takip</span>`;
      const actions = document.createElement('div'); actions.className = 'hact';
      const show = document.createElement('button'); show.type = 'button'; show.className = 'btn ghost small'; show.textContent = 'Göster';
      show.onclick = () => {
        useSnaps(S.snapshots(), false);
        const i = state.snaps.findIndex((x) => x.at === s.at);
        state.cur = i; state.cmp = i > 0 ? i - 1 : -1; state.limit = PAGE;
        showStatus('', ''); render();
        $('results').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      };
      const del = document.createElement('button'); del.type = 'button'; del.className = 'btn ghost small danger'; del.textContent = 'Sil';
      let armed = false, timer;
      del.onclick = () => {
        if (!armed) { armed = true; del.textContent = 'Emin misin?'; timer = setTimeout(() => { armed = false; del.textContent = 'Sil'; }, 3000); return; }
        clearTimeout(timer);
        S.remove(s.at);
        const left = S.snapshots();
        if (!state.sample) { if (left.length) useSnaps(left, false); else useSnaps(buildSample(), true); }
        toast('Kayıt silindi', 'ok');
        render();
      };
      actions.append(show, del); r.appendChild(actions); box.appendChild(r);
    });
  }

  function setTab(id, fromHash) {
    state.tab = id; state.limit = PAGE;
    const t = TABS.find((x) => x.id === id);
    if (!fromHash && t && location.hash !== '#' + t.hash) history.replaceState(null, '', '#' + t.hash);
    render();
  }

  /* ---------- tema ---------- */
  const THEMES = { system: 'Tema: sistem', light: 'Tema: açık', dark: 'Tema: koyu' };
  function applyTheme(t) {
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    $('themeBtn').textContent = THEMES[t];
  }

  /* ---------- olaylar ---------- */
  function bind() {
    $('pick').onclick = () => $('file').click();
    $('file').onchange = (e) => { handle([...e.target.files]); e.target.value = ''; };
    const d = $('drop');
    let depth = 0;
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());
    d.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; d.classList.add('over'); });
    d.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; d.classList.remove('over'); } });
    d.addEventListener('drop', (e) => { e.preventDefault(); depth = 0; d.classList.remove('over'); handle([...e.dataTransfer.files]); });

    let qTimer;
    $('q').addEventListener('input', (e) => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { state.q = e.target.value.trim().toLowerCase().replace(/^@/, ''); state.limit = PAGE; render(); }, 120);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); $('q').focus(); }
      if (e.key === 'Escape' && document.activeElement === $('q')) { $('q').value = ''; state.q = ''; render(); }
    });
    $('sort').onchange = (e) => { state.sort = e.target.value; render(); };
    $('reason').onchange = (e) => { state.reason = e.target.value; render(); };
    $('showEx').onchange = (e) => { state.showExempt = e.target.checked; render(); };
    $('more').onclick = () => { state.limit += PAGE; render(); };
    $('curSel').onchange = (e) => {
      const i = +e.target.value; state.cur = i;
      if (state.cmp === i) state.cmp = i > 0 ? i - 1 : -1;
      state.limit = PAGE; render();
    };
    $('cmpSel').onchange = (e) => { state.cmp = +e.target.value; state.limit = PAGE; render(); };

    $('copy').onclick = () => {
      const C = compute();
      const list = state.tab === 'log' ? [] : sorted(C[state.tab] || []);
      if (!list.length) return toast('Kopyalanacak hesap yok', 'err');
      copyText(list.map((x) => '@' + x.u).join('\n'), `${list.length} kullanıcı adı kopyalandı`);
    };
    $('csv').onclick = () => {
      const C = compute();
      const list = state.tab === 'log' ? [] : sorted(C[state.tab] || []);
      if (!list.length) return toast('Dışa aktarılacak hesap yok', 'err');
      const t = TABS.find((x) => x.id === state.tab);
      const csv = 'kullanici_adi,profil,tarih\n' + list.map((x) =>
        `${x.u},https://www.instagram.com/${x.u}/,${x.t ? new Date(x.t).toISOString().slice(0, 10) : ''}`).join('\n');
      download(`takip-defteri-${t.hash}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
      toast('CSV indiriliyor', 'ok');
    };
    $('sampleBtn').onclick = () => { useSnaps(buildSample(), true); showStatus('', ''); state.tab = 'lost'; render(); };
    $('mineBtn').onclick = () => { useSnaps(S.snapshots(), false); showStatus('', ''); render(); };

    $('exportBtn').onclick = () => {
      if (!S.snapshots().length) return toast('Yedeklenecek kayıt yok', 'err');
      download(`takip-defteri-yedek-${new Date().toISOString().slice(0, 10)}.json`, S.exportJSON(), 'application/json');
      toast('Yedek indiriliyor', 'ok');
    };
    $('copyBackupBtn').onclick = () => {
      if (!S.snapshots().length) return toast('Yedeklenecek kayıt yok', 'err');
      copyText(S.exportJSON(), 'Yedek panoya kopyalandı');
    };
    $('importBtn').onclick = () => $('importFile').click();
    $('importFile').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try {
        const n = S.importJSON(await f.text());
        useSnaps(S.snapshots(), false); render();
        toast(`${n} kayıt geri yüklendi`, 'ok');
      } catch (err) { toast(err.message || 'Yedek okunamadı', 'err'); }
    };
    let clearArmed = false;
    $('clearBtn').onclick = () => {
      if (!clearArmed) {
        clearArmed = true; $('clearBtn').textContent = 'Tüm geçmiş silinsin mi? Tekrar bas';
        setTimeout(() => { clearArmed = false; $('clearBtn').textContent = 'Tüm geçmişi sil'; }, 3000);
        return;
      }
      S.clear(); clearArmed = false; $('clearBtn').textContent = 'Tüm geçmişi sil';
      useSnaps(buildSample(), true); render(); toast('Geçmiş silindi', 'ok');
    };

    $('themeBtn').onclick = () => {
      const order = ['system', 'light', 'dark'];
      const next = order[(order.indexOf(S.theme()) + 1) % order.length];
      S.setTheme(next); applyTheme(next);
    };

    window.addEventListener('hashchange', () => {
      const t = TABS.find((x) => '#' + x.hash === location.hash);
      if (t && t.id !== state.tab) setTab(t.id, true);
    });
    let rTimer;
    window.addEventListener('resize', () => { clearTimeout(rTimer); rTimer = setTimeout(renderChart, 150); });
  }

  /* ---------- başlat ---------- */
  function start() {
    applyTheme(S.theme());
    bind();
    const mine = S.snapshots();
    if (mine.length) useSnaps(mine, false); else useSnaps(buildSample(), true);
    const fromHash = TABS.find((x) => '#' + x.hash === location.hash);
    if (fromHash) state.tab = fromHash.id;
    else if (!state.sample && state.cmp < 0) state.tab = 'notback';
    render();
  }
  start();
})();
