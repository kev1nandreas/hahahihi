import { defineConfig, loadEnv } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pbkdf2Sync } from "node:crypto";

// ---------------------------------------------------------------------------
// Plugin build-time: baca korpus + .env (kunci rahasia, daftar NRP), hitung
// hash PBKDF2 NRP, lalu sediakan sebagai virtual module `virtual:dataset`.
//
// Kunci rahasia (NRP_SECRET_KEY) & NRP asli HANYA dipakai saat build di server
// Vercel — tidak pernah masuk ke bundle browser. Yang dikirim ke klien hanya:
//   - isi korpus (corpus_*.txt)
//   - SALT + iterasi (perlu agar browser bisa hash NRP yang diketik user)
//   - daftar HASH PBKDF2 NRP diterima (bukan NRP asli)
//
// Ini sama persis dengan model lama (build_website.py) — situs static, jadi
// salt tetap ikut ke browser: obfuscation kuat (PBKDF2), bukan irreversible.
// ---------------------------------------------------------------------------
function baca(path) {
  return readFileSync(resolve(__dirname, path), "utf-8")
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim().length > 0);
}

function hashNrp(nrp, salt, iterations) {
  // HARUS identik dengan hashNRP_pbkdf2() di src/main.js (WebCrypto).
  return pbkdf2Sync(nrp, salt, iterations, 32, "sha256").toString("hex");
}

function datasetPlugin(env) {
  const VIRTUAL_ID = "virtual:dataset";
  const RESOLVED_ID = "\0" + VIRTUAL_ID;

  const salt = (env.NRP_SECRET_KEY || "").trim();
  const iterations = parseInt(env.PBKDF2_ITERATIONS || "200000", 10);
  const nrpDiterima = (env.NRP_DITERIMA || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  return {
    name: "dataset-virtual",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;

      if (!salt || salt.includes("isi-dengan")) {
        throw new Error(
          "NRP_SECRET_KEY belum diisi. Set di .env (lokal) atau Environment Variables Vercel."
        );
      }
      if (nrpDiterima.length === 0) {
        throw new Error(
          "NRP_DITERIMA kosong. Isi daftar NRP (pisah koma) di .env / Vercel."
        );
      }

      const data = {
        diterima: baca("corpus_diterima.txt"),
        ditolak: baca("corpus_ditolak.txt"),
        // Hanya HASH yang masuk bundle — NRP asli tidak ikut.
        hash_diterima: nrpDiterima.map((n) => hashNrp(n, salt, iterations)),
      };

      return (
        `export const DATA = ${JSON.stringify(data)};\n` +
        `export const SALT = ${JSON.stringify(salt)};\n` +
        `export const PBKDF2_ITERATIONS = ${iterations};\n`
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  // loadEnv tanpa prefix "" -> baca SEMUA var .env (termasuk yang non-VITE_).
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [datasetPlugin(env)],
  };
});
