import { Route, Routes, Navigate } from 'react-router-dom'
import AdminRoute from './AdminRoute'
import AdminLayout from '../layouts/AdminLayot'
import PublicLayout from '../layouts/PublicLayout'
import PublicRoute from './PublicRoute'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'

const AppRoute = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path='/*' element={<PublicLayout/>}>
      <Route path='*' element={<PublicRoute/>}/>
      </Route>

      <Route path="/admin/*" element={<AdminLayout />}>
        <Route path="*" element={<AdminRoute />} />
      </Route>


    </Routes>
  )
}

export default AppRoute