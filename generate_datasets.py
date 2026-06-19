# -*- coding: utf-8 -*-
"""
Generator dataset TF-IDF untuk teka-teki "diterima / ditolak".

Konsep:
- Setiap BARIS = 1 dokumen.
- Kata KUNCI (jawaban) muncul di SEDIKIT baris -> IDF tinggi -> skor TF-IDF tinggi.
- Kata NOISE (umum) muncul di BANYAK baris -> IDF rendah -> tenggelam.
- Stopwords ditebar di mana-mana untuk menjebak peserta yg tidak preprocessing.

Output: dua file korpus 'master' (urutan belum diacak).
Pengacakan urutan per-NRP dilakukan di website (JS), bukan di sini.
"""

import os
import random


def load_env(path=".env"):
    """Parser .env minimal (tanpa dependency eksternal)."""
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def parse_keywords(raw, default):
    """Pisah daftar kata via koma. Kosong -> pakai default."""
    kata = [k.strip() for k in (raw or "").split(",") if k.strip()]
    return kata or default


# ---------------------------------------------------------------------------
# 1. Kata kunci jawaban (yang HARUS muncul di puncak ranking TF-IDF).
#    Dibaca dari .env (KEYWORD_DITERIMA / KEYWORD_DITOLAK, pisah koma) supaya
#    jawaban tidak di-hardcode di kode sumber. Kosong -> pakai default.
# ---------------------------------------------------------------------------
_env = load_env()
KEYWORDS = {
    "diterima": parse_keywords(
        _env.get("KEYWORD_DITERIMA"),
        ["selamat", "diterima", "lolos", "berhasil", "bergabung"],
    ),
    "ditolak": parse_keywords(
        _env.get("KEYWORD_DITOLAK"),
        ["semangat", "ditolak", "belum", "coba", "lagi"],
    ),
}

# Lawan dari setiap jenis -> dipakai sebagai DECOY.
# Kata-kata ini DISEBAR di banyak baris (TF=1, DF tinggi -> IDF rendah)
# sehingga ADA secara fisik di file (anti Ctrl+F) tapi TENGGELAM di TF-IDF.
LAWAN = {"diterima": "ditolak", "ditolak": "diterima"}

# ---------------------------------------------------------------------------
# 2. Kata noise umum -> sengaja muncul SANGAT sering di banyak baris
#    sehingga IDF-nya kecil dan tidak mengganggu jawaban.
# ---------------------------------------------------------------------------
NOISE = [
    "data", "proses", "sistem", "informasi", "kegiatan", "panitia", "acara",
    "kampus", "mahasiswa", "kelompok", "tugas", "materi", "jadwal", "ruang",
    "waktu", "tim", "anggota", "laporan", "dokumen", "berkas", "form",
    "nilai", "angka", "huruf", "kata", "kalimat", "teks", "baris", "kolom",
    "tabel", "grafik", "gambar", "warna", "bentuk", "ukuran", "jumlah",
]

# Stopwords bahasa Indonesia (penjebak — peserta menengah harus membuang ini)
STOPWORDS = [
    "yang", "di", "ke", "dari", "dan", "atau", "ini", "itu", "adalah",
    "dengan", "untuk", "pada", "dalam", "akan", "tidak", "sudah", "juga",
    "ada", "saya", "kamu", "kita", "mereka", "nya", "para", "agar",
]

random.seed(42)  # master deterministik; pengacakan per-anak ada di website


def buat_baris_noise(decoy=None):
    """
    Baris berisi noise + stopwords. Jika `decoy` diberikan, sisipkan TEPAT
    SATU kata decoy (TF=1) di baris ini. Karena decoy disebar ke banyak
    baris, DF-nya tinggi -> IDF rendah -> skornya tenggelam di TF-IDF.
    """
    n = random.randint(8, 16)
    kata = []
    for _ in range(n):
        if random.random() < 0.45:
            kata.append(random.choice(STOPWORDS))
        else:
            kata.append(random.choice(NOISE))
    if decoy is not None:
        kata.append(decoy)        # tepat satu kemunculan -> TF=1
        random.shuffle(kata)
    return " ".join(kata)


def buat_baris_kunci(jenis):
    """
    Baris yang mengandung kata kunci dengan TF tinggi (diulang beberapa kali
    dalam baris yg sama) supaya skor TF-IDF kata kunci menonjol.
    """
    kw = random.choice(KEYWORDS[jenis])
    n = random.randint(8, 16)
    # kata kunci diulang 3-5x dalam baris ini -> TF tinggi
    repeat_kunci = random.randint(3, 5)
    kata = [kw] * repeat_kunci
    for _ in range(n - repeat_kunci):
        if random.random() < 0.4:
            kata.append(random.choice(STOPWORDS))
        else:
            kata.append(random.choice(NOISE))
    random.shuffle(kata)
    return " ".join(kata)


def buat_korpus(jenis, total_baris=400, rasio_kunci=0.08, rasio_decoy=0.35):
    """
    total_baris  : jumlah dokumen (baris) total
    rasio_kunci  : proporsi baris yang mengandung kata kunci (kecil -> IDF tinggi)
    rasio_decoy  : proporsi baris noise yang menyelipkan kata kunci LAWAN
                   sebagai decoy (besar -> DF decoy tinggi -> IDF rendah)
    """
    decoy_words = KEYWORDS[LAWAN[jenis]]   # kata kunci lawan
    baris = []
    n_kunci = int(total_baris * rasio_kunci)
    sisa = total_baris - n_kunci
    n_decoy = int(sisa * rasio_decoy)

    for _ in range(n_kunci):
        baris.append(buat_baris_kunci(jenis))
    # baris noise yang menyisipkan satu decoy; decoy disebar merata
    for i in range(n_decoy):
        baris.append(buat_baris_noise(decoy=decoy_words[i % len(decoy_words)]))
    # sisanya noise murni
    for _ in range(sisa - n_decoy):
        baris.append(buat_baris_noise())

    random.shuffle(baris)
    return baris


def tulis(nama_file, baris):
    with open(nama_file, "w", encoding="utf-8") as f:
        f.write("\n".join(baris))
    print(f"  -> {nama_file} ({len(baris)} baris)")


if __name__ == "__main__":
    print("Membuat korpus master...")
    tulis("corpus_diterima.txt", buat_korpus("diterima"))
    tulis("corpus_ditolak.txt",  buat_korpus("ditolak"))
    print("Selesai. File master ini yang akan dipakai website untuk diacak per-NRP.")
