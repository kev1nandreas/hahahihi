import { DATA, SALT, PBKDF2_ITERATIONS } from "virtual:dataset";

// ---- PRNG deterministik berbasis seed (mulberry32) ----
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
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Fisher-Yates shuffle dengan PRNG ber-seed
function shuffleSeeded(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// PBKDF2-HMAC-SHA256(nrp, SALT, iterasi) -> hex string.
// HARUS identik dengan hashNrp() di vite.config.js (Node crypto).
async function hashNRP_pbkdf2(nrp) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(nrp), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(SALT), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function tentukanJenis(nrp) {
  const h = await hashNRP_pbkdf2(nrp);
  return DATA.hash_diterima.includes(h) ? "diterima" : "ditolak";
}

async function unduh(nrp) {
  const msg = document.getElementById("msg");
  const jenis = await tentukanJenis(nrp);
  const seed = hashNRP(nrp);
  const rand = mulberry32(seed);
  const barisAcak = shuffleSeeded(DATA[jenis], rand);
  const isi = barisAcak.join("\n");

  const blob = new Blob([isi], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dataset_" + nrp + ".txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  msg.className = "msg ok";
  msg.textContent = "Dataset-mu sedang diunduh. Selamat menganalisis! 🔍";
}

document.getElementById("btn").addEventListener("click", async () => {
  const nrp = document.getElementById("nrp").value.trim();
  const msg = document.getElementById("msg");
  if (!nrp) {
    msg.className = "msg error";
    msg.textContent = "Masukkan NRP-mu dulu.";
    return;
  }
  await unduh(nrp);
});
document.getElementById("nrp").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btn").click();
});
