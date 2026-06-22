import axios from 'axios';
import useAuthStore from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 180000,
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
    if (user) {
      config.headers['X-User-Name'] = user.name || user.username || '';
      config.headers['X-User-Role'] = user.role || '';
      config.headers['X-User-Branch'] = user.branch || '';
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🔥 RESPONSE INTERCEPTOR: Auto-Logout kalau Token Expired (401/403)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error.config;
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Abaikan redirect jika error berasal dari endpoint login
      if (originalRequest && originalRequest.url && originalRequest.url.includes('/auth/verify-login')) {
        return Promise.reject(error);
      }

      console.warn('⚠️ Sesi berakhir atau tidak valid. Memaksa logout...');
      
      // Bersihkan state login
      useAuthStore.getState().logout();
      
      // Tendang ke halaman login tanpa pake React Router, tapi cuma jika belum di login
      if (window.location.pathname !== '/') {
        import('sweetalert2').then(Swal => {
          Swal.default.fire({
            icon: 'warning',
            title: 'Sesi Berakhir',
            text: 'Sesi Anda telah kedaluwarsa atau tidak valid. Silakan masuk kembali.',
            confirmButtonColor: '#286086',
            confirmButtonText: 'Login Kembali'
          }).then(() => {
            window.location.href = '/'; 
          });
        });
      }
    }
    return Promise.reject(error);
  }
);

api.downloadFile = async (endpoint, defaultFilename = 'download') => {
  const Swal = (await import('sweetalert2')).default;
  Swal.fire({ title: 'Downloading...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  try {
    const response = await api.get(endpoint, { responseType: 'blob' });
    let filename = defaultFilename;
    const disposition = response.headers['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(disposition);
      if (matches != null && matches[1]) { 
        filename = matches[1].replace(/['"]/g, '');
      }
    }
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    Swal.close();
  } catch (err) {
    console.error(err);
    Swal.fire('Error', 'Gagal mengunduh file', 'error');
  }
};

export default api;