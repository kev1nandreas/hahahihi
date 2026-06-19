# -*- coding: utf-8 -*-
"""
Build website static: meng-embed isi corpus + HASH NRP ke dalam data.js,
dan menyuntikkan SALT + iterasi PBKDF2 ke index.html.

Kunci rahasia (salt) diambil dari file .env (NRP_SECRET_KEY) -> tidak
ditulis di kode sumber dan tidak ikut ke git.

NRP di-hash dengan PBKDF2-HMAC-SHA256 iterasi tinggi sehingga walau salt
terlihat di browser, mem-brute-force rentang NRP jadi sangat lambat & mahal.

Jalankan SETELAH generate_datasets.py:
    python build_website.py
"""
import json
import hashlib
import os
import sys

# Daftar NRP diterima dibaca dari .env (NRP_DITERIMA), bukan hardcode di sini,
# supaya file ini aman dipublikasikan tanpa membocorkan daftar NRP.


def load_env(path=".env"):
    """Parser .env minimal (tanpa dependency eksternal)."""
    env = {}
    if not os.path.exists(path):
        sys.exit(f"ERROR: file {path} tidak ditemukan. "
                 f"Salin .env.example -> .env lalu isi NRP_SECRET_KEY.")
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def hash_nrp(nrp, salt, iterations):
    """PBKDF2-HMAC-SHA256(nrp, salt, iterations) -> hex string.
    HARUS identik dengan implementasi di index.html."""
    dk = hashlib.pbkdf2_hmac(
        "sha256", nrp.encode("utf-8"), salt.encode("utf-8"), iterations
    )
    return dk.hex()


def baca(path):
    with open(path, encoding="utf-8") as f:
        return [line.rstrip("\n") for line in f if line.strip()]


def inject_index(salt, iterations, path="index.html"):
    """Sisipkan salt + iterasi ke index.html via penanda komentar."""
    with open(path, encoding="utf-8") as f:
        html = f.read()
    blok = (
        "/* BUILD-INJECT-START */\n"
        f'  const SALT = "{salt}";\n'
        f"  const PBKDF2_ITERATIONS = {iterations};\n"
        "  /* BUILD-INJECT-END */"
    )
    import re
    baru = re.sub(
        r"/\* BUILD-INJECT-START \*/.*?/\* BUILD-INJECT-END \*/",
        blok, html, flags=re.DOTALL,
    )
    if baru == html and "BUILD-INJECT-START" not in html:
        sys.exit("ERROR: penanda BUILD-INJECT tidak ada di index.html.")
    with open(path, "w", encoding="utf-8") as f:
        f.write(baru)


def main():
    env = load_env()
    salt = env.get("NRP_SECRET_KEY", "")
    if not salt or "isi-dengan" in salt:
        sys.exit("ERROR: NRP_SECRET_KEY di .env belum diisi dengan kunci asli.")
    iterations = int(env.get("PBKDF2_ITERATIONS", "200000"))

    nrp_diterima = [n.strip() for n in env.get("NRP_DITERIMA", "").split(",") if n.strip()]
    if not nrp_diterima:
        sys.exit("ERROR: NRP_DITERIMA di .env kosong. Isi daftar NRP (pisah koma).")

    data = {
        "diterima": baca("corpus_diterima.txt"),
        "ditolak": baca("corpus_ditolak.txt"),
        # Hanya HASH PBKDF2 yang disimpan. NRP asli tidak ada di sini.
        "hash_diterima": [hash_nrp(n, salt, iterations) for n in nrp_diterima],
    }
    js = "// AUTO-GENERATED oleh build_website.py — jangan edit manual.\n"
    js += "const DATA = " + json.dumps(data, ensure_ascii=False) + ";\n"
    with open("data.js", "w", encoding="utf-8") as f:
        f.write(js)

    inject_index(salt, iterations)

    print(f"data.js dibuat: {len(data['diterima'])} baris diterima, "
          f"{len(data['ditolak'])} baris ditolak, "
          f"{len(nrp_diterima)} hash diterima (PBKDF2 x{iterations}).")
    print("index.html: SALT + iterasi sudah disuntikkan.")
    print("Selesai. Pastikan .env TIDAK ikut di-commit / di-publish.")


if __name__ == "__main__":
    main()
