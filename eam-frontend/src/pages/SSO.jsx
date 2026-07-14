import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import useAuthStore from '../store/authStore';

export default function SSO() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loginSave = useAuthStore((state) => state.login);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const email = searchParams.get('email');
    const secret = searchParams.get('sso_secret');

    if (!email || !secret) {
      Swal.fire({
        icon: 'error',
        title: 'SSO Failed',
        text: 'Missing credentials for Single Sign-On',
      });
      navigate('/');
      return;
    }

    const processSSO = async () => {
      try {
        const backendUrl = '/api';
        const res = await axios.post(`${backendUrl}/auth/sso-login`, {
          email: email,
          sso_secret: secret
        });

        const data = res.data;
        // Save to localStorage just like standard login
        localStorage.setItem('token', data.token);
        const userData = {
          id: data.id,
          name: data.fullName,
          email: data.email,
          role: data.role,
          branch: data.branch,
          token: data.token
        };
        localStorage.setItem('user', JSON.stringify(userData));
        
        // IMPORTANT: Update Zustand store so ProtectedRoute knows we're authenticated!
        loginSave(userData);

        Swal.fire({
          icon: 'success',
          title: 'SSO Success',
          text: `Welcome back, ${data.fullName}!`,
          timer: 1500,
          showConfirmButton: false,
        });

        // Redirect to dashboard
        navigate('/dashboard');

      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'SSO Error',
          text: err.response?.data?.detail || 'Gagal login via SSO',
        });
        navigate('/');
      }
    };

    processSSO();
  }, [searchParams, navigate]);

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <h2 className="text-xl font-semibold text-slate-700">Connecting securely to EAM...</h2>
    </div>
  );
}
