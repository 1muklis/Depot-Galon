import React from 'react'

const stats = [
  { label: 'Total pendapatan', value: 'Rp 48,2 jt', change: '+12,5%', up: true },
  { label: 'Pesanan', value: '1.284', change: '+8,2%', up: true },
  { label: 'Pengguna baru', value: '326', change: '+3,1%', up: true },
  { label: 'Pesanan dibatalkan', value: '27', change: '-1,4%', up: false },
]

const weekly = [
  { day: 'Sen', value: 45 },
  { day: 'Sel', value: 62 },
  { day: 'Rab', value: 38 },
  { day: 'Kam', value: 75 },
  { day: 'Jum', value: 90 },
  { day: 'Sab', value: 68 },
  { day: 'Min', value: 52 },
]

const orders = [
  { id: '#ORD-1042', customer: 'Budi Santoso', total: 'Rp 350.000', status: 'Selesai' },
  { id: '#ORD-1041', customer: 'Siti Rahma', total: 'Rp 1.200.000', status: 'Diproses' },
  { id: '#ORD-1040', customer: 'Andi Wijaya', total: 'Rp 89.000', status: 'Menunggu' },
  { id: '#ORD-1039', customer: 'Dewi Lestari', total: 'Rp 540.000', status: 'Selesai' },
  { id: '#ORD-1038', customer: 'Rizky Pratama', total: 'Rp 215.000', status: 'Dibatalkan' },
]

const statusStyle = {
  Selesai: 'bg-emerald-100 text-emerald-700',
  Diproses: 'bg-sky-100 text-sky-700',
  Menunggu: 'bg-amber-100 text-amber-700',
  Dibatalkan: 'bg-rose-100 text-rose-700',
}

const Dashboard = () => {
  const max = Math.max(...weekly.map((w) => w.value))

  return (
    <div className="space-y-6">
      {/* Kartu statistik */}
      <section aria-label="Ringkasan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{s.value}</p>
            <p
              className={`mt-1 text-sm font-medium ${
                s.up ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {s.change}{' '}
              <span className="font-normal text-slate-400">dari minggu lalu</span>
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Grafik batang sederhana */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-1">
          <h2 className="text-base font-semibold text-slate-900">Penjualan mingguan</h2>
          <div className="mt-6 flex h-48 items-end gap-3">
            {weekly.map((w) => (
              <div key={w.day} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-md bg-indigo-500"
                  style={{ height: `${(w.value / max) * 100}%` }}
                  title={`${w.day}: ${w.value}`}
                />
                <span className="text-xs text-slate-500">{w.day}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Tabel pesanan terbaru */}
        <section className="rounded-xl border border-slate-200 bg-white xl:col-span-2">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-base font-semibold text-slate-900">Pesanan terbaru</h2>
            <a
              href="/admin/orders"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Lihat semua
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">ID</th>
                  <th className="px-5 py-3 font-medium">Pelanggan</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{o.id}</td>
                    <td className="px-5 py-3 text-slate-600">{o.customer}</td>
                    <td className="px-5 py-3 text-slate-600">{o.total}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[o.status]}`}
                      >
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Dashboard