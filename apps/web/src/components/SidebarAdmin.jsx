import React, { useState } from 'react'

const menus = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
  },
  {
    label: 'Pengguna',
    href: '/admin/users',
    icon: 'M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 10a4 4 0 100-8 4 4 0 000 8zM21 20v-2a4 4 0 00-3-3.87M16 2.13a4 4 0 010 7.75',
  },
  {
    label: 'Produk',
    href: '/admin/products',
    icon: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8',
  },
  {
    label: 'Pesanan',
    href: '/admin/orders',
    icon: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18M16 10a4 4 0 01-8 0',
  },
  {
    label: 'Laporan',
    href: '/admin/reports',
    icon: 'M18 20V10M12 20V4M6 20v-6',
  },
  {
    label: 'Pengaturan',
    href: '/admin/settings',
    icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
  },
]

const Icon = ({ d }) => (
  <svg
    className="h-5 w-5 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
)

const SidebarAdmin = () => {
  const [active, setActive] = useState('Dashboard')
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Tombol buka sidebar (mobile) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buka sidebar"
        className="fixed left-4 top-4 z-40 rounded-lg bg-slate-900 p-2 text-white shadow lg:hidden"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* Overlay (mobile) */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <span className="text-lg font-bold text-white">
            Admin<span className="text-indigo-400">Panel</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup sidebar"
            className="rounded p-1 text-slate-400 hover:text-white lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Menu */}
        <nav aria-label="Navigasi admin" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {menus.map((menu) => {
              const isActive = active === menu.label
              return (
                <li key={menu.label}>
                  <a
                    href={menu.href}
                    onClick={() => {
                      setActive(menu.label)
                      setOpen(false)
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon d={menu.icon} />
                    {menu.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Profil admin */}
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
              A
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">Admin</p>
              <p className="truncate text-xs text-slate-400">admin@contoh.com</p>
            </div>
            <button
              type="button"
              aria-label="Keluar"
              className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

export default SidebarAdmin