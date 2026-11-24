import React, { useState } from 'react'

const initialForm = {
  whatsapp: '',
  password: '',
}

const Login = () => {
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
    setSubmitError('')
  }

  const validate = () => {
    const e = {}
    if (!/^(\+62|62|0)8[0-9]{8,12}$/.test(form.whatsapp.replace(/[\s-]/g, '')))
      e.whatsapp = 'Masukkan nomor WhatsApp yang valid, contoh 081234567890.'
    if (!form.password) e.password = 'Kata sandi wajib diisi.'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setLoading(true)
    setSubmitError('')
    try {
      // TODO: ganti dengan request ke API kamu, contoh:
      // const res = await fetch('/api/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(form),
      // })
      // if (!res.ok) throw new Error('Login gagal')
      // lalu simpan token dan arahkan ke halaman utama
      await new Promise((r) => setTimeout(r, 800))
      console.log('Login berhasil', form.whatsapp)
    } catch {
      setSubmitError('Nomor WhatsApp atau kata sandi salah. Coba lagi.')
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
        <h1 className="text-2xl font-bold text-sky-950">Masuk</h1>
        <p className="mt-2 text-sm text-gray-600">
          Masuk untuk memesan galon dan melihat riwayat pesananmu.
        </p>

        {submitError && (
          <div role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
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
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Kata sandi
              </label>
              <a href="/lupa-sandi" className="text-sm font-medium text-sky-700 hover:text-sky-900">
                Lupa kata sandi?
              </a>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={`${inputClass('password')} pr-28`}
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Belum punya akun?{' '}
          <a href="/register" className="font-semibold text-sky-700 hover:text-sky-900">
            Daftar
          </a>
        </p>
      </div>
    </main>
  )
}

export default Login