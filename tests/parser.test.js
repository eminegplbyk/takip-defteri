// Çalıştır: npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../assets/js/parser.js');

const load = (week) => {
  const dir = path.join(__dirname, '..', 'sample-data', week);
  const files = fs.readdirSync(dir).map((name) => ({ name, text: fs.readFileSync(path.join(dir, name), 'utf8') }));
  const r = P.parseFiles(files);
  return { at: 0, followers: r.followers, following: r.following, recognized: r.recognized };
};

test('iki dosya da tanınır ve kullanıcı adları okunur', () => {
  const s = load('hafta-1');
  assert.strictEqual(s.recognized, 2);
  assert.strictEqual(s.followers.length, 8);
  assert.strictEqual(s.following.length, 7);
  // following.json'da ad "title" alanında
  assert.ok(s.following.some((x) => x.u === 'ornek.kaan'));
});

test('geri takip etmeyenler ve karşılıklılar', () => {
  const r = P.relations(load('hafta-1'));
  assert.deepStrictEqual(r.notback.map((x) => x.u).sort(), ['ornek.ipek', 'ornek.kaan', 'ornek.oguz']);
  assert.strictEqual(r.mutual.length, 4);
});

test('takipten çıkan, hesabı kapanan ve ad değiştiren ayrılır', () => {
  const d = P.diff(load('hafta-1'), load('hafta-2'));
  const by = Object.fromEntries(d.lost.map((x) => [x.u, x.reason]));
  assert.strictEqual(by['ornek.mert'], 'unfollow'); // hâlâ senin takip listende
  assert.strictEqual(by['ornek.elif'], 'gone');     // iki listeden de düştü
  assert.ok(!('ornek.burak' in by), 'ad değiştiren çıkan sayılmamalı');
  assert.deepStrictEqual(d.renames.map((r) => [r.from, r.to]), [['ornek.burak', 'ornek.burak.yeni']]);
  assert.deepStrictEqual(d.gained.map((x) => x.u), ['ornek.yeni']);
});

test('HTML formatı fark edilir', () => {
  const r = P.parseFiles([{ name: 'followers_1.html', text: '<html></html>' }]);
  assert.strictEqual(r.recognized, 0);
  assert.strictEqual(r.htmlSeen, true);
});

test('aynı tarihli iki kişi varsa ad eşleştirmesi yapılmaz', () => {
  const pairs = P.matchRenames([{ u: 'a', t: 1 }, { u: 'b', t: 1 }], [{ u: 'c', t: 1 }]);
  assert.strictEqual(pairs.length, 0);
});
