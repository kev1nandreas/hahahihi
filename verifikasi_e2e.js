// Verifikasi end-to-end memakai PRNG + hashing yang SAMA PERSIS dengan index.html.
// Jalankan: node verifikasi_e2e.js
const fs = require("fs");
const crypto = require("crypto");

// SALT + iterasi dibaca dari index.html (yg sudah disuntik build dari .env)
const _html = fs.readFileSync("index.html", "utf8");
const SALT = _html.match(/const SALT = "([^"]+)"/)[1];
const PBKDF2_ITERATIONS = parseInt(_html.match(/PBKDF2_ITERATIONS = (\d+)/)[1]);
// Replikasi Web Crypto PBKDF2 (param identik dgn index.html: sha256, 32 byte)
function hashNRPpbkdf2(nrp) {
  return crypto.pbkdf2Sync(
    Buffer.from(nrp, "utf8"), Buffer.from(SALT, "utf8"),
    PBKDF2_ITERATIONS, 32, "sha256"
  ).toString("hex");
}

// NRP diterima dibaca dari .env (tidak di-hardcode) supaya file ini aman publik.
const _env = fs.readFileSync(".env", "utf8");
const NRP_DITERIMA = (_env.match(/^NRP_DITERIMA=(.*)$/m)?.[1] || "")
  .split(",").map(s => s.trim()).filter(Boolean);

// muat DATA dari data.js dengan mengekstrak objek JSON-nya
const _raw = fs.readFileSync("data.js", "utf8");
const DATA = JSON.parse(_raw.slice(_raw.indexOf("{"), _raw.lastIndexOf("}") + 1));

// ---- salinan fungsi dari index.html ----
function hashNRP(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^= h >>> 16) >>> 0;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleSeeded(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- TF-IDF (max-per-kata, ternormalisasi) untuk verifikasi ----
const STOP = new Set(["yang","di","ke","dari","dan","atau","ini","itu","adalah",
  "dengan","untuk","pada","dalam","akan","tidak","sudah","juga","ada","saya",
  "kamu","kita","mereka","nya","para","agar"]);
function tokenize(line) {
  return (line.toLowerCase().match(/[a-z]+/g) || []).filter(w => !STOP.has(w));
}
function ranking(lines) {
  const docs = lines.map(tokenize).filter(d => d.length);
  const N = docs.length;
  const df = {};
  for (const d of docs) for (const w of new Set(d)) df[w] = (df[w]||0)+1;
  const skor = {};
  for (const d of docs) {
    const tf = {}; for (const w of d) tf[w]=(tf[w]||0)+1;
    for (const w in tf) {
      const idf = Math.log(N/(1+df[w]));
      const val = (tf[w]/d.length)*idf;
      if (val > (skor[w]||0)) skor[w]=val;
    }
  }
  return Object.entries(skor).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]);
}

function fileFor(nrp, jenis) {
  return shuffleSeeded(DATA[jenis], mulberry32(hashNRP(nrp)));
}

// replikasi tentukanJenis() di index.html:
// hash cocok daftar diterima -> diterima; SELAIN ITU -> ditolak.
function tentukanJenis(nrp) {
  return DATA.hash_diterima.includes(hashNRPpbkdf2(nrp)) ? "diterima" : "ditolak";
}

const A = NRP_DITERIMA[0], B = NRP_DITERIMA[1];   // dua-duanya diterima (dari .env)
const fA = fileFor(A, "diterima"), fB = fileFor(B, "diterima");

console.log(`NRP ${A} vs ${B} (sama-sama DITERIMA)`);
console.log("  Urutan berbeda?  ", JSON.stringify(fA) !== JSON.stringify(fB));
console.log("  Isi set sama?    ", JSON.stringify([...fA].sort()) === JSON.stringify([...fB].sort()));
const rA = ranking(fA), rB = ranking(fB);
console.log("  Top-5 TF-IDF A:  ", rA.join(", "));
console.log("  Top-5 TF-IDF B:  ", rB.join(", "));
console.log("  Ranking identik? ", JSON.stringify(rA) === JSON.stringify(rB));

// determinisme: NRP sama -> file sama tiap kali
const fA2 = fileFor(A, "diterima");
console.log("  Deterministik?   ", JSON.stringify(fA) === JSON.stringify(fA2));

// cek jenis ditolak juga (NRP asing -> ditolak)
const rT = ranking(fileFor("9999999999", "ditolak"));
console.log("  Top-5 DITOLAK:   ", rT.join(", "));

console.log("\n--- Verifikasi HASHING NRP (PBKDF2 x" + PBKDF2_ITERATIONS + ") ---");
console.log("  NRP terdaftar [0] ->", tentukanJenis(A));
console.log("  NRP terdaftar [last] ->", tentukanJenis(NRP_DITERIMA[NRP_DITERIMA.length - 1]));
console.log("  NRP asing 9999999999 ->", tentukanJenis("9999999999"), "(harus ditolak)");
console.log("  Salah ketik (potong 1 digit) ->", tentukanJenis(A.slice(0, -1)), "(harus ditolak)");
console.log("  data.js bocor NRP plaintext?",
  NRP_DITERIMA.some(n => _raw.includes(n)) ? "YA (BURUK)" : "tidak (BAIK)");
console.log("  data.js bocor SALT/kunci?  ",
  _raw.includes(SALT) ? "YA (BURUK)" : "tidak (BAIK)");

console.log("\n--- Verifikasi DECOY (kata lawan ada tapi tenggelam) ---");
function countWord(lines, words) {
  const set = new Set(words);
  let c = 0;
  for (const l of lines) for (const w of tokenize(l)) if (set.has(w)) c++;
  return c;
}
const lawanDiterima = ["ditolak","semangat","belum","coba","lagi"];
console.log("  'ditolak'-dkk hadir di corpus diterima? ",
  countWord(DATA.diterima, lawanDiterima), "kemunculan");
console.log("  ...muncul di top-5 TF-IDF diterima?     ",
  rA.some(w => lawanDiterima.includes(w)) ? "YA (BURUK)" : "tidak (BAIK)");
