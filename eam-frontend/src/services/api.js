import axios from 'axios';
import useAuthStore from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 🔥 REQUEST INTERCEPTOR: Inject Token Otomatis
api.interceptors.request.use(
  (config) => {
    // Tarik state user dari Zustand (bisa dipanggil di luar React component)
    const user = useAuthStore.getState().user;
    
    // Asumsi dari FastAPI lo balikin field 'token' atau 'access_token'
    const token = user?.token || user?.access_token; 
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🔥 RESPONSE INTERCEPTOR: Auto-Logout kalau Token Expired (401/403)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn('⚠️ Sesi berakhir atau tidak valid. Memaksa logout...');
      
      // Bersihkan state login
      useAuthStore.getState().logout();
      
      // Tendang ke halaman login tanpa pake React Router (karena ini di luar komponen)
      window.location.href = '/'; 
    }
    return Promise.reject(error);
  }
);

export default api;