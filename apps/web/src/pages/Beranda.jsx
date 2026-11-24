import React from 'react'

// Ganti dengan data depot kamu
const WA_NUMBER = '6281234567890' // format internasional, tanpa + atau 0 di depan
const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
  'Halo, saya mau pesan isi ulang galon.'
)}`

// Taruh fotomu di folder public/ dengan nama hero.jpg (atau ganti path di bawah)
const HERO_PHOTO = '/hero.jpg'

const layanan = [
  { title: 'Antar ke rumah', desc: 'Pesan lewat WhatsApp, galon diantar sampai depan pintu. Tidak perlu angkat-angkat.' },
  { title: 'Isi ulang di depot', desc: 'Bawa galonmu sendiri, tunggu sebentar, air siap dibawa pulang.' },
  { title: 'Galon baru & tutup', desc: 'Butuh galon kosong, tutup, atau kran? Tersedia juga.' },
]

const langkah = [
  { title: 'Chat WhatsApp', desc: 'Kirim jumlah galon dan alamatmu.' },
  { title: 'Kami konfirmasi', desc: 'Kamu dapat kabar jam antar dan total biaya.' },
  { title: 'Galon sampai', desc: 'Tukar galon kosong, bayar tunai atau transfer.' },
]

const harga = [
  { name: 'Isi ulang di depot', price: 'Rp 6.000', note: 'per galon 19 liter' },
  { name: 'Antar ke rumah', price: 'Rp 8.000', note: 'per galon, sudah termasuk ongkir*', featured: true },
  { name: 'Galon baru (kosong)', price: 'Rp 45.000', note: 'per galon + tutup' },
]

// Lapisan (atas ke bawah): gelap tipis di atas (agar menu terbaca) -> gelap di kiri (agar judul terbaca)
// -> foto -> gradasi cadangan. Kalau foto belum ada, gradasi biru yang tampil.
const heroBg = {
  backgroundImage: [
    'linear-gradient(180deg, rgba(3,27,52,0.35) 0%, rgba(3,27,52,0) 22%)',
    'linear-gradient(90deg, rgba(3,27,52,0.7) 0%, rgba(3,27,52,0.3) 45%, rgba(3,27,52,0) 75%)',
    `url('${HERO_PHOTO}')`,
    'radial-gradient(55% 55% at 78% 35%, rgba(110,220,250,0.85) 0%, rgba(110,220,250,0) 70%)',
    'radial-gradient(45% 60% at 8% 85%, rgba(14,100,180,0.9) 0%, rgba(14,100,180,0) 70%)',
    'linear-gradient(135deg, #031b34 0%, #0a3d6b 55%, #1b8fc4 100%)',
  ].join(', '),
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
}

// Lencana bergerigi (12 sudut) untuk ikon centang di samping judul
const badgePoints = Array.from({ length: 180 }, (_, i) => {
  const a = (i / 180) * 2 * Math.PI
  const r = 44 + 4 * Math.cos(12 * a)
  return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`
}).join(' ')

const Beranda = () => {
  return (
    <main className="bg-white text-gray-800">
      {/* HERO: foto memenuhi layar, navbar transparan menumpang di atasnya */}
      <section id="beranda" style={heroBg} className="relative min-h-svh overflow-hidden text-white">
        <div className="relative z-10 mx-auto flex min-h-svh max-w-[1600px] flex-col px-6 md:px-10">
          {/* teks */}
          <div className="flex flex-1 flex-col justify-center pb-16 pt-24">
            <h1 className="text-5xl font-normal leading-[0.95] tracking-tighter sm:text-7xl lg:text-[clamp(72px,13svh,128px)]">
              Air Segar
              <br />
              <span className="text-white/50">sampai di</span>
              <br />
              <span className="inline-flex items-center gap-5">
                Depan Pintu
                <svg className="hidden h-[0.6em] w-[0.6em] shrink-0 sm:block" viewBox="0 0 100 100" aria-hidden="true">
                  <polygon points={badgePoints} className="fill-white/25" />
                  <path d="M33 51l12 12 22-24" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </h1>

            <div className="mt-10 flex flex-wrap items-center gap-6">
              <a
                href={WA_LINK}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-3 bg-black px-9 py-4 font-medium text-white transition-colors hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Pesan Sekarang
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17L17 7M8 7h9v9" />
                </svg>
              </a>
              <p className="max-w-[240px] text-sm leading-snug text-white/90">
                Depot isi ulang yang siap antar galon ke rumahmu, dengan harga jelas dan air yang bersih.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* LAYANAN */}
      <section id="layanan" className="mx-auto max-w-6xl scroll-mt-4 px-5 py-16 md:py-20">
        <h2 className="text-4xl font-semibold tracking-tight text-sky-950">Layanan kami</h2>
        <p className="mt-3 max-w-xl text-gray-600">Pilih cara yang paling nyaman buat kamu.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {layanan.map((item) => (
            <div key={item.title} className="rounded-2xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-sky-900">{item.title}</h3>
              <p className="mt-2 text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CARA PESAN */}
      <section className="mx-3 rounded-3xl bg-slate-950 text-white md:mx-5">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <h2 className="text-4xl font-semibold tracking-tight">Cara pesan</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {langkah.map((item, i) => (
              <li key={item.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white font-semibold text-slate-950">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1 text-white/70">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* HARGA */}
      <section id="harga" className="mx-auto max-w-6xl scroll-mt-4 px-5 py-16 md:py-20">
        <h2 className="text-4xl font-semibold tracking-tight text-sky-950">Harga</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {harga.map((item) => (
            <div
              key={item.name}
              className={`rounded-2xl p-6 ${
                item.featured ? 'bg-sky-600 text-white' : 'border border-gray-200'
              }`}
            >
              <h3 className={`font-medium ${item.featured ? 'text-sky-50' : 'text-gray-700'}`}>{item.name}</h3>
              <p className="mt-3 text-4xl font-semibold tracking-tight">{item.price}</p>
              <p className={`mt-1 text-sm ${item.featured ? 'text-sky-100' : 'text-gray-500'}`}>{item.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-gray-500">*Gratis ongkir untuk radius 3 km dari depot.</p>
      </section>

      {/* TENTANG */}
      <section id="tentang" className="scroll-mt-4 bg-sky-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:py-20">
          <div>
            <h2 className="text-4xl font-semibold tracking-tight text-sky-950">Tentang depot kami</h2>
            <p className="mt-4 text-gray-600">
              Kami melayani kebutuhan air minum keluarga dan usaha di lingkungan sekitar. Setiap
              galon dicuci dan dibilas sebelum diisi, supaya air yang sampai di rumahmu tetap segar.
            </p>
          </div>
          <ul className="space-y-3 self-center">
            {['Galon dibilas sebelum diisi', 'Air disaring bertahap', 'Pengantaran rapi dan tepat waktu'].map((text) => (
              <li key={text} className="flex items-center gap-3 text-gray-700">
                <svg className="h-5 w-5 shrink-0 text-sky-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" />
                </svg>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* KONTAK */}
      <section id="kontak" className="scroll-mt-4 border-t border-gray-200">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-12 text-sm text-gray-600 md:grid-cols-3">
          <div>
            <h3 className="font-semibold text-sky-950">Alamat</h3>
            <p className="mt-2">Jl. Contoh No. 12, Bandung, Jawa Barat</p>
          </div>
          <div>
            <h3 className="font-semibold text-sky-950">Jam buka</h3>
            <p className="mt-2">Setiap hari, 07.00 – 20.00 WIB</p>
          </div>
          <div>
            <h3 className="font-semibold text-sky-950">WhatsApp</h3>
            <p className="mt-2">0812-3456-7890</p>
          </div>
        </div>
        <p className="border-t border-gray-100 py-5 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Depot Air Isi Ulang. Semua hak dilindungi.
        </p>
      </section>
    </main>
  )
}

export default Beranda