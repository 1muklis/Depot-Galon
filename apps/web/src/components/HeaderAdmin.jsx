import React from 'react'
import { useLocation } from 'react-router-dom'

const titles = {
  '/admin': 'Dashboard',
  '/admin/users': 'Pengguna',
  '/admin/products': 'Produk',
  '/admin/orders': 'Pesanan',
  '/admin/reports': 'Laporan',
  '/admin/settings': 'Pengaturan',
}

const HeaderAdmin = () => {
  const { pathname } = useLocation()
  const title = titles[pathname] ?? 'Admin'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 pl-16 pr-4 backdrop-blur sm:pr-6 lg:px-8">
      <h1 className="truncate text-lg font-semibold text-slate-900">{title}</h1>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Pencarian (disembunyikan di layar kecil) */}
        <div className="relative hidden md:block">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            placeholder="Cari..."
            aria-label="Cari"
            className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        {/* Notifikasi */}
        <button
          type="button"
          aria-label="Notifikasi"
          className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
          </svg>
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
        </button>

        {/* Profil */}
        <button
          type="button"
          aria-label="Menu profil"
          className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
            A
          </span>
          <span className="hidden text-sm font-medium text-slate-700 sm:block">
            Admin
          </span>
        </button>
      </div>
    </header>
  )
}

export default HeaderAdmin