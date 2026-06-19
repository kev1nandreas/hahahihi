# Dataset Misteri — TF-IDF Oprec

Situs static untuk membagikan dataset teka-teki. Peserta memasukkan NRP,
lalu mengunduh file `.txt` yang **urutannya diacak per-NRP** namun hasil
**TF-IDF-nya tetap sama**. NRP yang diterima mendapat kata kunci "diterima",
selain itu mendapat versi "ditolak".

Dibangun dengan **Vite** dan dideploy ke **Vercel**. Kunci rahasia + daftar
NRP disimpan di **environment variables** (tidak di kode sumber).

## File

| File | Keterangan |
|---|---|
| `index.html` | Entry Vite (UI). |
| `src/main.js` | Logika klien: hash NRP, tentukan jenis, acak per-NRP, unduh. |
| `vite.config.js` | Plugin build-time: baca env + korpus, hitung hash PBKDF2, sediakan `virtual:dataset`. |
| `corpus_*.txt` | Korpus master (sumber data). |
| `generate_datasets.py` | Membuat korpus master (`corpus_*.txt`). |
| `solusi_referensi.py` | Kunci jawaban (cek TF-IDF). |
| `verifikasi_e2e.js` | Uji end-to-end (Node). |
| `.env` | **RAHASIA** — kunci + daftar NRP. **Tidak di-commit.** |

## Environment variables

Salin `.env.example` → `.env` (lokal), atau set di **Vercel → Project →
Settings → Environment Variables**:

| Var | Keterangan |
|---|---|
| `NRP_SECRET_KEY` | Kunci/salt PBKDF2. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PBKDF2_ITERATIONS` | Iterasi PBKDF2 (default `200000`). |
| `NRP_DITERIMA` | Daftar NRP diterima, pisah koma. NRP lain otomatis = ditolak. |

Var ini **hanya** dipakai saat build (di server Vercel). Kunci rahasia & NRP
asli **tidak** masuk ke bundle browser — yang ikut hanya hash PBKDF2, korpus,
dan salt.

## Lokal

```bash
npm install
cp .env.example .env      # isi NRP_SECRET_KEY, NRP_DITERIMA
npm run dev               # dev server
npm run build             # output ke dist/
npm run preview           # cek hasil build
```

(Opsional) regenerate korpus: `python generate_datasets.py`.

## Deploy ke Vercel

1. Push repo ke GitHub.
2. Vercel → **New Project** → import repo. Framework auto-detect: **Vite**.
3. **Settings → Environment Variables**: tambah `NRP_SECRET_KEY`,
   `PBKDF2_ITERATIONS`, `NRP_DITERIMA`.
4. **Deploy.** Tiap ganti NRP/kunci: ubah env var → **Redeploy**.

CLI: `npm i -g vercel && vercel` (lalu `vercel env add ...` & `vercel --prod`).

## ⚠️ Keamanan

- `.env` **tidak pernah** di-commit (lihat `.gitignore`).
- Bundle hanya berisi **hash PBKDF2** NRP — bukan NRP asli.
- Karena situs static, salt ikut ke browser: ini **obfuscation kuat**
  (PBKDF2 200k iterasi), bukan irreversible mutlak. Untuk rahasia penuh,
  butuh backend.
