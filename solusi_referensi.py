# -*- coding: utf-8 -*-
"""
Solusi referensi (untuk PANITIA) — verifikasi bahwa TF-IDF
benar memunculkan kata kunci di puncak ranking.

Ini juga contoh 'kunci jawaban' cara peserta menyelesaikan teka-teki.
Jalankan: python solusi_referensi.py corpus_diterima.txt
"""
import sys
import math
import re
from collections import Counter

STOPWORDS = {
    "yang", "di", "ke", "dari", "dan", "atau", "ini", "itu", "adalah",
    "dengan", "untuk", "pada", "dalam", "akan", "tidak", "sudah", "juga",
    "ada", "saya", "kamu", "kita", "mereka", "nya", "para", "agar",
}


def tokenize(baris):
    return [w for w in re.findall(r"[a-zA-Z]+", baris.lower()) if w not in STOPWORDS]


def tfidf(path):
    with open(path, encoding="utf-8") as f:
        dokumen = [tokenize(line) for line in f if line.strip()]

    N = len(dokumen)
    # IDF: di berapa banyak dokumen sebuah kata muncul
    df = Counter()
    for doc in dokumen:
        for w in set(doc):
            df[w] += 1

    # Skor TF-IDF MAKSIMUM per kata di seluruh dokumen.
    # (kata penting punya TF tinggi di SUATU baris DAN IDF tinggi)
    skor = {}
    for doc in dokumen:
        if not doc:
            continue
        tf = Counter(doc)
        panjang = len(doc)
        for w, c in tf.items():
            idf = math.log(N / (1 + df[w]))
            val = (c / panjang) * idf          # TF dinormalisasi x IDF
            if val > skor.get(w, 0):
                skor[w] = val
    return Counter(skor), N


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "corpus_diterima.txt"
    skor, N = tfidf(path)
    print(f"Korpus: {path}  ({N} dokumen/baris)\n")
    print(f"{'kata':<15}{'skor TF-IDF':>12}")
    print("-" * 27)
    for w, s in skor.most_common(12):
        print(f"{w:<15}{s:>12.3f}")
