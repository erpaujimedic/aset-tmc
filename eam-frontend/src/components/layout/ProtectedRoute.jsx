import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Kalau belum login, lempar paksa ke halaman "/" (Login)
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Kalau udah login, silakan lewat (tampilin kontennya)
  return <Outlet />;
}