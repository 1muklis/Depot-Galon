import {Routes, Route, Navigate} from 'react-router-dom'
import Dashboard from '../pages/Dashboard'

const AdminRoute = () => {
  return (
    <Routes>
        <Route index element={<Navigate to="dashboard" replace />}/>
        <Route path="dashboard" element={<Dashboard/>}/> 
    </Routes>
      
    
  )
}

export default AdminRoute
