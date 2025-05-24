Berikut adalah versi Bahasa Indonesia dari `README.md` untuk aplikasi CV Reviewer Anda:

---

````markdown
# Aplikasi CV Reviewer

Aplikasi web yang menganalisis dan memberikan ulasan terhadap CV LinkedIn (ekspor dalam format PDF). Dibuat menggunakan Vite, React, dan Mantine, serta memanfaatkan OpenAI API untuk memberikan umpan balik secara otomatis.

## Fitur

- Unggah file PDF CV dari LinkedIn
- Ekstraksi teks otomatis dari PDF
- Analisis struktur, kejelasan, penggunaan kata kunci, dan relevansi dengan tujuan karier
- Umpan balik dan saran perbaikan dalam bahasa alami
- Antarmuka pengguna yang bersih dan responsif

## Teknologi yang Digunakan

- **Frontend**: React + Vite
- **UI Framework**: Mantine
- **Backend (opsional)**: Hono.js
- **Parsing PDF**: `pdfjs-dist`
- **Engine Review AI**: OpenAI GPT API

## Persiapan

### Prasyarat

- Node.js >= 18
- Kunci API dari OpenAI

### Instalasi

```bash
git clone https://github.com/namapenggunaanda/cv-reviewer-app.git
cd cv-reviewer-app
npm install
````

### Konfigurasi Lingkungan

Buat file `.env` di direktori root:

```env
VITE_OPENAI_API_KEY=api_key_openai_anda
```

> ⚠️ Jangan publikasikan kunci API Anda di frontend untuk aplikasi produksi. Gunakan backend proxy untuk keamanan.

### Menjalankan Secara Lokal

```bash
npm run dev
```

Buka [http://localhost:5173](http://localhost:5173) di browser.

## Cara Penggunaan

1. Unggah file PDF CV yang diekspor dari LinkedIn.
2. Aplikasi akan mengekstrak isi teks menggunakan `pdfjs-dist`.
3. Teks yang diekstrak dikirim ke OpenAI API untuk dianalisis.
4. Hasil ulasan ditampilkan dalam format terstruktur dan mudah dipahami.

## Struktur Folder

```
src/
├── components/       # Komponen React yang dapat digunakan kembali
├── hooks/            # Custom hooks React
├── utils/            # Fungsi utilitas
├── api/              # Logika interaksi dengan OpenAI API
├── App.tsx
└── main.tsx
```

## Lisensi

MIT License
```
