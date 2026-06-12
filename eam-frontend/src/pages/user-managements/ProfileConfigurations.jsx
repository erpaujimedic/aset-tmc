import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import useAuthStore from '../../store/authStore';
import { updateUser, resetUserPassword } from '../../services/userService';
import useI18nStore from '../../store/i18nStore';

export default function ProfileConfigurations() {
  const { t } = useI18nStore();
  const { user, login } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    branch: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.fullName || user.name || '',
        email: user.email || '',
        role: user.role || '',
        branch: Array.isArray(user.branch) ? user.branch.join(', ') : (user.branchName || user.branch || ''),
      });
    }
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      Swal.fire('Peringatan', 'Nama lengkap tidak boleh kosong!', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Kita panggil API update user (hanya update nama)
      await updateUser(user.id, { name: formData.name });
      
      // Update store lokal agar UI ter-refresh tanpa relogin
      const updatedUser = { ...user, fullName: formData.name, name: formData.name };
      login(updatedUser); // Update zustand state
      
      Swal.fire(t('success'), 'Profil Anda berhasil diperbarui!', 'success');
    } catch (error) {
      Swal.fire(t('failed'), error.response?.data?.detail || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    const result = await Swal.fire({
      title: 'Ubah Kata Sandi?',
      text: "Kami akan mengirimkan link untuk mengatur ulang kata sandi ke email Anda.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#286086',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Kirim Link!',
      cancelButtonText: t('cancel')
    });

    if (result.isConfirmed) {
      try {
        await resetUserPassword(user.id);
        Swal.fire(t('success'), `Link perubahan kata sandi telah dikirim ke ${formData.email}. Silakan cek kotak masuk Anda.`, 'success');
      } catch (error) {
        Swal.fire(t('failed'), error.response?.data?.detail || 'Terjadi kesalahan sistem', 'error');
      }
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
      <div className="w-full grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* KARTU PROFIL KIRI */}
        <div className="lg:col-span-1 flex flex-col gap-6 sticky top-0">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#286086] to-blue-400 flex items-center justify-center text-white text-4xl font-bold shadow-lg shadow-blue-900/20 mb-4 ring-4 ring-blue-50">
              {formData.name ? formData.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <h2 className="text-xl font-bold text-slate-800">{formData.name || 'TMC User'}</h2>
            <span className="px-3 py-1 bg-blue-50 text-[#286086] font-semibold text-xs rounded-full mt-2">
              {formData.role || 'Role Tidak Terdefinisi'}
            </span>
            <div className="mt-6 w-full pt-6 border-t border-slate-100 flex flex-col gap-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-medium">{t('status')}</span>
                <span className="text-emerald-500 font-bold flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Active
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-medium">Akses Wilayah</span>
                <span className="text-slate-700 font-bold max-w-[120px] truncate" title={formData.branch}>
                  {formData.branch || 'Nasional'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FORM PENGATURAN KANAN */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* INFORMASI DASAR */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                {t('basicInfo')}
              </h3>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-6 flex flex-col gap-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">{t('fullName')}</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#286086]/20 focus:border-[#286086] transition-all font-medium text-slate-800"
                  placeholder={t('enterFullName')}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">{t('emailAddress')}</label>
                <div className="relative">
                  <input 
                    type="email" 
                    value={formData.email}
                    disabled
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed"
                  />
                  <div className="absolute right-3 top-3 text-slate-400" title={t('emailCannotBeChanged')}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{t('emailDesc')}</p>
              </div>

              <div className="mt-4 flex justify-end">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-8 py-3 bg-[#286086] text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-900/20 hover:-translate-y-1 transition-all duration-300 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  )}
                  {t('saveChanges')}
                </button>
              </div>
            </form>
          </div>

          {/* KEAMANAN AKUN */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                {t('securityAuth')}
              </h3>
            </div>
            <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-800">{t('accountPassword')}</h4>
                <p className="text-sm text-slate-500 mt-1 max-w-md">{t('passwordDesc')}</p>
              </div>
              <button 
                onClick={handleChangePassword}
                className="px-5 py-2.5 border-2 border-rose-100 text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                {t('changePassword')}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
