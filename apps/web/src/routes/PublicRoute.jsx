import { Route, Routes, Navigate } from "react-router-dom"
import Beranda from "../pages/Beranda"

const PublicRoute = () => {
  return (
    <Routes>
        <Route index element={<Beranda/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  )
}

export default PublicRoute
