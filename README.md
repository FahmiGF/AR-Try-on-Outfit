# Matahari AR Try-On

Virtual fitting room untuk toko pakaian **Matahari**. Pelanggan bisa mencoba pakaian langsung dari kamera browser (augmented reality), melihat rekomendasi ukuran, dan checkout — semuanya tanpa install aplikasi. Tersedia juga **dashboard admin** untuk memantau penjualan, stok, pesanan, dan aktivitas try-on.

> Prototipe internal. Seluruh produk, pesanan, dan analitik adalah data demo yang disimpan di `localStorage` perangkat.

---

## Fitur

### Storefront (`index.html`)
- Hero section, marquee promo, dan kartu produk dengan visual pakaian SVG.
- Filter kategori, pencarian (debounced), dan sorting (terpopuler, harga, rating).
- Modal produk: galeri warna, ukuran (otomatis menonaktifkan ukuran habis), badge diskon, dan deskripsi.
- **Rekomendasi ukuran** dari tinggi, berat, lingkar dada, dan preferensi fit (slim/regular/oversize).
- **AR try-on**:
  - Kamera via `getUserMedia` + deteksi pose **MediaPipe PoseLandmarker** dari CDN.
  - Pakaian SVG transparan digambar di `<canvas>`, mengikuti lebar bahu, panjang torso, dan kemiringan badan.
  - Kontrol warna, ukuran, skala, geser vertikal, dan opacity.
  - **Mode Mannequin** sebagai fallback saat kamera/model tidak tersedia.
  - Screenshot try-on bisa diunduh sebagai PNG.
  - Tidak ada video yang dikirim ke server — semua diproses di perangkat.
- Keranjang (drawer) dengan tambah/kurang qty, hapus item, dan kode promo:
  - `MATAHARI10` — diskon 10%
  - `HEMAT50` — potong Rp50.000
  - `GRATISONGKIR` — gratis ongkir
  - Gratis ongkir otomatis untuk belanja ≥ Rp300.000
- Checkout membuat pesanan baru, mengurangi stok, dan mengosongkan keranjang.
- Responsif untuk desktop, tablet, dan mobile.

### Admin (`admin.html`)
- Login PIN demo: **`2468`** (sesi disimpan di `sessionStorage`).
- **Ringkasan**: KPI pendapatan, pesanan, sesi try-on, konversi, grafik tren 7 hari, distribusi status pesanan, produk terpopuler, dan stok perlu perhatian.
- **Produk**: tabel katalog, pencarian & filter kategori, tambah/edit/hapus produk, editor warna, ukuran, dan stok per ukuran.
- **Pesanan**: daftar pesanan, filter status, dan ubah status (pending → paid → shipped → completed / cancelled).
- **Try-On**: tren AR vs mannequin, peringkat produk, dan log 20 sesi terakhir.
- Reset data demo dan logout.

---

## Stack

- **Vanilla JavaScript (ES modules)** — tanpa framework, tanpa build step.
- **Node.js static server** (`server.js`) di port `4000`.
- **MediaPipe Tasks Vision** (`@mediapipe/tasks-vision@0.10.14`) via CDN untuk pose detection.
- **Canvas 2D** untuk komposisi kamera + pakaian.
- **localStorage** sebagai satu sumber data untuk storefront dan admin.
- **node:test** untuk unit test logika murni.

---

## Menjalankan

```bash
cd matahari-ar-tryon
npm start
```

Buka:

- Storefront: <http://localhost:4000>
- Admin: <http://localhost:4000/admin.html> — PIN `2468`

Port bisa diganti:

```bash
PORT=5000 npm start
```

### Catatan kamera
- Browser hanya mengizinkan kamera pada `localhost` atau HTTPS.
- Izin kamera diminta saat modal try-on dibuka.
- Jika kamera ditolak / model gagal dimuat, aplikasi otomatis memakai **mode Mannequin**.

---

## Test

```bash
npm test
```

51 unit test mencakup katalog & filter, keranjang & promo, rekomendasi ukuran, transformasi pakaian AR, agregasi analitik, generator SVG, dan store/persistensi.

### Smoke test browser (opsional)
Proyek ini juga diuji end-to-end lewat Chrome DevTools Protocol:
- 40 pemeriksaan storefront (render, filter, pencarian, modal, keranjang, promo, checkout, AR, screenshot, kalkulator ukuran).
- 34 pemeriksaan admin (login, KPI, grafik, CRUD produk, status pesanan, log try-on).

---

## Struktur

```
.
├── index.html          # storefront
├── admin.html          # dashboard admin
├── styles.css          # styling storefront
├── admin.css           # styling admin
├── server.js           # static server (port 4000)
├── src/
│   ├── app.js          # logika storefront & wiring UI
│   ├── admin.js        # logika dashboard, chart, CRUD
│   ├── ar.js           # kamera + MediaPipe + render canvas
│   ├── catalog.js      # data produk & filter
│   ├── garments.js     # generator pakaian SVG
│   ├── sizing.js       # rekomendasi ukuran & transformasi AR
│   ├── cart.js         # operasi keranjang & promo
│   ├── analytics.js    # agregasi KPI & tren
│   └── store.js        # localStorage store bersama
└── tests/              # unit test node:test
```

---

## Data & penyimpanan

Semua state disimpan pada key `matahari-ar-tryon:v1`:

- `products` — 8 produk seed (`mt-001`–`mt-008`), termasuk warna, ukuran, stok.
- `orders` — 10 pesanan demo (`ORD-1034`–`ORD-1042`), plus pesanan baru dari checkout.
- `tryons` — riwayat sesi try-on (dipakai analitik admin).
- `cart`, `promo`, `orderSeq`.

Mengubah data di admin langsung terlihat di storefront (satu origin). Tombol **Reset data demo** mengembalikan semuanya ke kondisi awal.

---

## Lisensi

MIT
