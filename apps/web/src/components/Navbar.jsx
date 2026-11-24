import React, { useEffect, useState } from 'react'

// Ganti dengan data depot kamu (samakan dengan di Beranda.jsx)
const WA_NUMBER = '6281234567890'
const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
  'Halo, saya mau pesan isi ulang galon.'
)}`

const links = [
  { label: 'Beranda', href: '#beranda' },
  { label: 'Tentang', href: '#tentang' },
  { label: 'Layanan', href: '#layanan' },
  { label: 'Kontak', href: '#kontak' },
]

// Navbar menempel di atas layar (fixed) dan posisinya tetap saat di-scroll.
// Di paling atas ia transparan; setelah di-scroll, latarnya jadi biru gelap
// buram supaya teks putih tetap terbaca di atas bagian putih.
const Navbar = () => {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 text-white transition-colors duration-300 ${
        scrolled || open ? 'bg-sky-950/85 shadow-sm backdrop-blur-md' : ''
      }`}
    >
      <nav
        aria-label="Navigasi utama"
        className="mx-auto flex h-20 max-w-[1600px] items-center justify-between px-6 md:px-10"
      >
        <a href="#beranda" className="text-xl font-semibold tracking-tight">
          Logo
        </a>

        {/* Menu desktop (di tengah) */}
        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 text-sm md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-white/90 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4">
          <a
            href={WA_LINK}
            target="_blank"
            rel="noreferrer"
            aria-label="Chat WhatsApp"
            className="hidden text-white/90 transition-colors hover:text-white sm:block"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 20.5l1.7-5.5A8.4 8.4 0 1121 11.5z" />
            </svg>
          </a>
          <a
            href="/login"
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-sky-950 transition-colors hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Login
          </a>

          {/* Tombol hamburger */}
          <button
            type="button"
            className="rounded-md p-1 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {/* Menu mobile */}
      <ul
        id="mobile-menu"
        className={`${open ? 'flex' : 'hidden'} flex-col border-t border-white/10 px-5 py-2 md:hidden`}
      >
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-white/90"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </header>
  )
}

export default Navbar