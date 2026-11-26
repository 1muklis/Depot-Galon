import React from 'react'
import { Outlet } from 'react-router-dom'
import SidebarAdmin from '../components/SidebarAdmin'
import HeaderAdmin from '../components/HeaderAdmin'

const AdminLayout = () => {
  return (
    <div className="min-h-screen bg-slate-100">
      <SidebarAdmin />

      {/* Area kanan: digeser selebar sidebar di layar besar */}
      <div className="flex min-h-screen flex-col lg:ml-64">
        <HeaderAdmin />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout