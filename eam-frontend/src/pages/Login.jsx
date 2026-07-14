import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import useMasterStore from '../store/masterStore';
import useAuthStore from '../store/authStore';
import logoMost from '../assets/images/logo.png';
import { loginUser, registerUser, resetPassword, changePassword } from '../services/authService';
import CustomSelect from '../components/common/CustomSelect';

export default function LoginPage() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('login');
  const [loading, setLoading] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  
  // Tarik data & fungsi dari Zustand Store
  const branches = useMasterStore((state) => state.branches);
  const fetchBranches = useMasterStore((state) => state.fetchBranches);
  const loginSave = useAuthStore((state) => state.login);

  // Ambil data cabang otomatis saat halaman login dibuka
  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const [loginMethod, setLoginMethod] = useState('password'); // 'password' or 'totp'
  const [loginData, setLoginData] = useState({ email: '', password: '', otp: '', remember: false });
  const [regData, setRegData] = useState({ name: '', email: '', username: '', password: '', confirm: '', role: '', branch: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [migrateData, setMigrateData] = useState({ email: '', oldPassword: '', newPassword: '', confirmPassword: '' });

  // --- HANDLER LOGIN ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const passwordVal = loginMethod === 'password' ? loginData.password : null;
      const otpVal = loginMethod === 'totp' ? loginData.otp : null;
      const userData = await loginUser(loginData.email, passwordVal, otpVal);
      
      // Cek apakah butuh ganti password (migrasi dari Firebase ke Supabase)
      if (userData?.status === 'REQUIRE_PASSWORD_CHANGE') {
        Swal.fire({
          icon: 'info',
          title: 'Security Update',
          text: 'Kami mendeteksi Anda menggunakan sandi lama. Demi keamanan, silakan perbarui sandi Anda terlebih dahulu.',
          confirmButtonColor: '#30528A',
          backdrop: `rgba(15, 23, 42, 0.7)`
        });
        setMigrateData({ ...migrateData, email: userData.email, oldPassword: loginData.password });
        setActiveView('migrate');
        return;
      }

      loginSave(userData); 
      
      Swal.fire({
        icon: 'success',
        title: 'Welcome Back!',
        text: 'Login berhasil.',
        timer: 1500,
        showConfirmButton: false,
        backdrop: `rgba(15, 23, 42, 0.7)`
      });

      navigate('/dashboard'); 
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Authentication Failed',
        text: err,
        confirmButtonColor: '#EC363A',
        backdrop: `rgba(15, 23, 42, 0.7)`
      });
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER REGISTER ---
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (regData.password !== regData.confirm) {
      Swal.fire({ icon: 'warning', title: 'Oops...', text: 'Password tidak cocok!', confirmButtonColor: '#30528A' });
      return;
    }
    
    setLoading(true);
    try {
      // Mapping ke Pydantic Schema: RegisterRequest
      const payload = {
        fullName: regData.name,
        email: regData.email,
        username: regData.username,
        role: regData.role,
        branch: regData.branch,
        password: regData.password // Kirim password jika backend membutuhkannya untuk hashing
      };

      await registerUser(payload);
      
      Swal.fire({ 
        icon: 'success', 
        title: 'Request Sent!', 
        text: 'Permintaan akses berhasil dikirim. Menunggu persetujuan admin.', 
        confirmButtonColor: '#30528A' 
      });
      
      setActiveView('login');
      // Reset form register
      setRegData({ name: '', email: '', username: '', password: '', confirm: '', role: '', branch: '' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Registration Failed', text: err, confirmButtonColor: '#EC363A' });
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER FORGOT PASSWORD ---
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(forgotEmail);
      
      Swal.fire({ 
        icon: 'success', 
        title: 'Email Sent!', 
        text: `Link reset dikirim ke ${forgotEmail}`, 
        confirmButtonColor: '#A78759' 
      });
      
      setActiveView('login');
      setForgotEmail(''); // Reset field
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Action Failed', text: err, confirmButtonColor: '#EC363A' });
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER MIGRATE PASSWORD ---
  const handleMigrateSubmit = async (e) => {
    e.preventDefault();
    if (migrateData.newPassword !== migrateData.confirmPassword) {
      Swal.fire({ icon: 'warning', title: 'Oops...', text: 'Password baru tidak cocok!', confirmButtonColor: '#30528A' });
      return;
    }
    
    setLoading(true);
    try {
      await changePassword(migrateData.email, migrateData.oldPassword, migrateData.newPassword);
      
      Swal.fire({ 
        icon: 'success', 
        title: 'Update Berhasil!', 
        text: `Sandi Anda berhasil diperbarui ke sistem baru. Silakan login.`, 
        confirmButtonColor: '#30528A' 
      });
      
      setActiveView('login');
      setLoginData({ ...loginData, password: migrateData.newPassword });
      setMigrateData({ email: '', oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Update', text: err, confirmButtonColor: '#EC363A' });
    } finally {
      setLoading(false);
    }
  };

  // --- ICON SVG ---
  const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
  const LockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>;
  const MailIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>;
  const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
  const EyeOffIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>;
  const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>;

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#f8fafc] overflow-hidden relative font-sans">
      {/* Background Watermark (Single TMC Logo) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] opacity-[0.03] pointer-events-none flex items-center justify-center">
        <img src={logoMost} alt="TMC Logo Watermark" className="w-full h-full object-contain" />
      </div>

      <div className="w-full max-w-[420px] bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 relative z-10 mx-4 transition-all duration-300">
        
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2.5 mb-1.5">
            <img src={logoMost} alt="TMC Logo" className="w-11 h-11 object-contain" />
            <h1 className="m-0 font-extrabold text-[28px] tracking-tight text-[#1e3a8a]">ASSETS</h1>
          </div>
          <p className="text-[#A78759] font-bold tracking-[0.15em] text-[10px]">PESAT INTEGRATION</p>
        </div>

        {activeView === 'login' && (
          <form onSubmit={handleLoginSubmit} className="animate-[slideUpFade_0.4s_ease-out_forwards]">
            <div className="mb-6">
              <p className="text-slate-500 text-sm">Please sign-in to your account</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1.5 font-medium">Email or Username <span className="text-red-500">*</span></label>
                <div className="relative group">
                  <input type="text" placeholder="name@tirta.co.id" required value={loginData.email} onChange={(e) => setLoginData({...loginData, email: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-tmc-blue transition-colors" />
                </div>
              </div>

              {loginMethod === 'password' ? (
                <div>
                  <label className="block text-xs text-slate-600 mb-1.5 font-medium">Password <span className="text-red-500">*</span></label>
                  <div className="relative group">
                    <input type={showPassword ? "text" : "password"} placeholder="••••••••" required value={loginData.password} onChange={(e) => setLoginData({...loginData, password: e.target.value})} className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-tmc-blue transition-colors" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-tmc-blue focus:outline-none transition-colors">{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
                  </div>
                </div>
              ) : (
                <div className="animate-[slideUpFade_0.3s_ease-out] flex justify-between gap-2">
                  {[0,1,2,3,4,5].map((index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      maxLength={1}
                      required
                      value={loginData.otp[index] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        let newOtp = (loginData.otp || '').split('');
                        newOtp[index] = val;
                        setLoginData({...loginData, otp: newOtp.join('')});
                        if (val && index < 5) document.getElementById(`otp-${index + 1}`)?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !loginData.otp[index] && index > 0) {
                          document.getElementById(`otp-${index - 1}`)?.focus();
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
                        if (pastedData) {
                          setLoginData({...loginData, otp: pastedData});
                          const nextIndex = Math.min(pastedData.length, 5);
                          document.getElementById(`otp-${nextIndex}`)?.focus();
                        }
                      }}
                      className="w-[48px] h-[54px] bg-white border border-slate-200 rounded-xl text-center text-xl font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-tmc-blue focus:ring-[3px] focus:ring-tmc-blue/15 transition-all shadow-sm"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center my-4">
              <button type="button" onClick={() => setLoginMethod(prev => prev === 'password' ? 'totp' : 'password')} className="text-slate-500 hover:text-tmc-blue font-medium text-xs transition-colors flex items-center gap-1.5 focus:outline-none">
                <i className={`fa-solid ${loginMethod === 'password' ? 'fa-shield-halved' : 'fa-key'}`}></i>
                {loginMethod === 'password' ? 'Use Google Authenticator' : 'Use Password'}
              </button>
              
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-3.5 h-3.5 border-slate-300 rounded text-tmc-blue focus:ring-tmc-blue cursor-pointer" checked={loginData.remember} onChange={(e) => setLoginData({...loginData, remember: e.target.checked})}/>
                <span className="text-slate-500 font-medium text-xs group-hover:text-slate-700 transition-colors">Remember me</span>
              </label>
            </div>

            <button disabled={loading} type="submit" className="w-full py-2.5 text-white rounded-md font-medium text-sm transition-all duration-300 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed bg-[#1e3a8a] hover:bg-[#1e3a8a]/90">
              {loading ? "Authenticating..." : "Sign in"}
            </button>

            <div className="flex flex-col items-center gap-3 mt-5 text-xs font-medium">
              <button type="button" onClick={() => setActiveView('forgot')} className="text-slate-500 hover:text-tmc-blue transition-colors focus:outline-none">Forgot Password?</button>
              <div className="invisible pointer-events-none select-none" aria-hidden="true">
                <span className="text-slate-500 me-1">New user?</span>
                <span className="text-tmc-blue">Request Access</span>
              </div>
            </div>
          </form>
        )}

        {activeView === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="animate-[slideUpFade_0.4s_ease-out_forwards]">
            <div className="mb-6">
              <h3 className="font-bold text-lg text-slate-800 tracking-tight mb-1">Reset Password</h3>
              <p className="text-slate-500 text-sm">We'll send a recovery link to your email.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1.5 font-medium">Email <span className="text-red-500">*</span></label>
                <input type="email" placeholder="name@tirta.co.id" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-tmc-blue transition-colors" />
              </div>

              <button disabled={loading} type="submit" className="w-full py-2.5 mt-2 text-white rounded-md font-medium text-sm transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed bg-[#1e3a8a] hover:bg-[#1e3a8a]/90">
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </div>

            <button type="button" onClick={() => setActiveView('login')} className="w-full mt-5 text-slate-500 text-xs hover:text-tmc-blue transition-colors focus:outline-none">
              Back to Sign In
            </button>
          </form>
        )}

        {activeView === 'migrate' && (
          <form onSubmit={handleMigrateSubmit} className="animate-[slideUpFade_0.4s_ease-out_forwards]">
            
            <div className="mb-6">
              <h3 className="font-bold text-lg text-slate-800 tracking-tight mb-1">Security Update Required</h3>
              <p className="text-slate-500 text-sm">Silakan buat sandi baru untuk akun Anda.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1.5 font-medium">New Password <span className="text-red-500">*</span></label>
                <div className="relative group">
                  <input type={showRegPassword ? "text" : "password"} placeholder="••••••••" required value={migrateData.newPassword} onChange={(e) => setMigrateData({...migrateData, newPassword: e.target.value})} className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-tmc-blue transition-colors" />
                  <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-tmc-blue focus:outline-none">{showRegPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1.5 font-medium">Confirm New Password <span className="text-red-500">*</span></label>
                <div className="relative group">
                  <input type={showRegConfirm ? "text" : "password"} placeholder="••••••••" required value={migrateData.confirmPassword} onChange={(e) => setMigrateData({...migrateData, confirmPassword: e.target.value})} className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-tmc-blue transition-colors" />
                  <button type="button" onClick={() => setShowRegConfirm(!showRegConfirm)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-tmc-blue focus:outline-none">{showRegConfirm ? <EyeOffIcon /> : <EyeIcon />}</button>
                </div>
              </div>

              <button disabled={loading} type="submit" className="w-full py-2.5 mt-2 text-white rounded-md font-medium text-sm transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed bg-[#1e3a8a] hover:bg-[#1e3a8a]/90">
                {loading ? "Updating..." : "Update Password"}
              </button>
            </div>
            
            <button type="button" onClick={() => setActiveView('login')} className="w-full mt-5 text-slate-500 text-xs hover:text-tmc-blue transition-colors focus:outline-none">
              Cancel
            </button>
          </form>
        )}

      </div>
    </div>
  );
}