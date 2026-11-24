import React, { useState } from 'react'

const initialForm = {
  nama: '',
  whatsapp: '',
  alamat: '',
  password: '',
  konfirmasi: '',
}

const Register = () => {
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const e = {}
    if (form.nama.trim().length < 3) e.nama = 'Nama minimal 3 karakter.'
    if (!/^(\+62|62|0)8[0-9]{8,12}$/.test(form.whatsapp.replace(/[\s-]/g, '')))
      e.whatsapp = 'Masukkan nomor WhatsApp yang valid, contoh 081234567890.'
    if (form.alamat.trim().length < 10)
      e.alamat = 'Tulis alamat lengkap agar kurir mudah menemukan rumahmu.'
    if (form.password.length < 8) e.password = 'Kata sandi minimal 8 karakter.'
    if (form.konfirmasi !== form.password) e.konfirmasi = 'Kata sandi tidak sama.'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setLoading(true)
    try {
      // TODO: ganti dengan request ke API kamu, contoh:
      // await fetch('/api/register', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(form),
      // })
      await new Promise((r) => setTimeout(r, 800))
      setSuccess(true)
      setForm(initialForm)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (name) =>
    `mt-1 block w-full rounded-lg border px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
      errors[name] ? 'border-red-500' : 'border-gray-300'
    }`

  return (
    <main className="flex min-h-screen items-center justify-center bg-sky-50 px-5 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <h1 className="text-2xl font-bold text-sky-950">Buat akun</h1>
        <p className="mt-2 text-sm text-gray-600">
          Daftar sekali, lalu pesan galon kapan saja tanpa isi data berulang.
        </p>

        {success && (
          <div
            role="status"
            className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            Akun berhasil dibuat. Silakan masuk untuk mulai memesan.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          <div>
            <label htmlFor="nama" className="text-sm font-medium text-gray-700">
              Nama lengkap
            </label>
            <input
              id="nama"
              name="nama"
              type="text"
              autoComplete="name"
              value={form.nama}
              onChange={handleChange}
              placeholder="Budi Santoso"
              aria-invalid={!!errors.nama}
              aria-describedby={errors.nama ? 'nama-error' : undefined}
              className={inputClass('nama')}
            />
            {errors.nama && (
              <p id="nama-error" className="mt-1 text-sm text-red-600">
                {errors.nama}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="whatsapp" className="text-sm font-medium text-gray-700">
              Nomor WhatsApp
            </label>
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.whatsapp}
              onChange={handleChange}
              placeholder="081234567890"
              aria-invalid={!!errors.whatsapp}
              aria-describedby={errors.whatsapp ? 'whatsapp-error' : undefined}
              className={inputClass('whatsapp')}
            />
            {errors.whatsapp && (
              <p id="whatsapp-error" className="mt-1 text-sm text-red-600">
                {errors.whatsapp}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="alamat" className="text-sm font-medium text-gray-700">
              Alamat pengantaran
            </label>
            <textarea
              id="alamat"
              name="alamat"
              rows={3}
              autoComplete="street-address"
              value={form.alamat}
              onChange={handleChange}
              placeholder="Jl. Contoh No. 12, RT 02/RW 05, Kelurahan, Kecamatan"
              aria-invalid={!!errors.alamat}
              aria-describedby={errors.alamat ? 'alamat-error' : undefined}
              className={inputClass('alamat')}
            />
            {errors.alamat && (
              <p id="alamat-error" className="mt-1 text-sm text-red-600">
                {errors.alamat}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              Kata sandi
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimal 8 karakter"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={`${inputClass('password')} pr-20`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 mt-1 px-3 text-sm font-medium text-sky-700 hover:text-sky-900"
              >
                {showPassword ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-600">
                {errors.password}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="konfirmasi" className="text-sm font-medium text-gray-700">
              Ulangi kata sandi
            </label>
            <input
              id="konfirmasi"
              name="konfirmasi"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.konfirmasi}
              onChange={handleChange}
              aria-invalid={!!errors.konfirmasi}
              aria-describedby={errors.konfirmasi ? 'konfirmasi-error' : undefined}
              className={inputClass('konfirmasi')}
            />
            {errors.konfirmasi && (
              <p id="konfirmasi-error" className="mt-1 text-sm text-red-600">
                {errors.konfirmasi}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Membuat akun...' : 'Buat akun'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Sudah punya akun?{' '}
          <a href="/login" className="font-semibold text-sky-700 hover:text-sky-900">
            Masuk
          </a>
        </p>
      </div>
    </main>
  )
}

export default Register