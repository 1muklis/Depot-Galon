# Galon Delivery API

Express 4 + TypeScript (ESM) + Prisma 6 + PostgreSQL.

## Setup
```bash
npm install
cp .env.example .env            # isi DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (>=32 karakter), SEED_ADMIN_PASSWORD
# letakkan skema Anda di prisma/schema.prisma dan tambahkan baris berikut pada blok datasource:
#   url = env("DATABASE_URL")
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev                     # http://localhost:3000/docs
npm test                        # integration (tanpa DB). E2E: set E2E_DB=1 + DB yang sudah di-seed
```

## Konvensi
- Base URL `/api/v1`; envelope `{ success, data, meta? }` / `{ success:false, error:{ code, message, details? } }`.
- Validasi Zod di `middlewares/validate.ts`; error domain via `AppError`.
- Modul sederhana (zona, slot, kategori, brand, banner) memakai `core/utils/crud.ts`.

## Alur pesanan
`PENDING_PAYMENT → PAID → PROCESSING → READY_FOR_DELIVERY → ON_DELIVERY → DELIVERED → COMPLETED`
- COD: pembayaran COD langsung memindahkan order ke `PROCESSING`; uang dicatat lunas saat kurir `deliver` dengan `codCollected=true`.
- Stok: di-*reserve* saat checkout, dikurangi permanen saat `DELIVERED`, dilepas saat batal.
- Galon: isi ulang menukar galon kosong yang dipegang customer; kekurangan dikenai deposit (`depositAmount`). Saldo di `CustomerProfile`.
- Order yang sudah dibayar tidak dibatalkan langsung; lewat `/refunds` (approve → process).

## Catatan produksi
- Integrasi gateway (`integrations/payment/*`) ditulis dari dokumentasi publik; **verifikasi endpoint, field, dan signature dengan sandbox masing-masing** sebelum live.
- Refund ke gateway dicatat saja (dana dikembalikan lewat dashboard gateway/manual).
- Jobs berjalan di dalam proses API; untuk multi-instance aktifkan `ENABLE_JOBS` hanya di satu instance.
- Upload memakai disk lokal (`integrations/storage`); ganti ke S3/GCS dengan mengimplementasikan `StorageProvider`.
