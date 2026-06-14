import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import useMasterStore from '../store/masterStore';
import useAuthStore from '../store/authStore';
import logoMost from '../assets/images/logo.png';
import { loginUser, registerUser, resetPassword } from '../services/authService';
import UserGuideModal from '../components/ui/UserGuideModal';

export default function LoginPage() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('login');
  const [loading, setLoading] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

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

  const [loginData, setLoginData] = useState({ email: '', password: '', remember: false });
  const [regData, setRegData] = useState({ name: '', email: '', username: '', password: '', confirm: '', role: '', branch: '' });
  const [forgotEmail, setForgotEmail] = useState('');

  // --- HANDLER LOGIN ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userData = await loginUser(loginData.email, loginData.password);
      loginSave(userData);

      Swal.fire({
        icon: 'success',
        title: 'Welcome Back!',
        text: 'Login berhasil.',
        timer: 1500,
        showConfirmButton: false,
        backdrop: `rgba(15, 23, 42, 0.7)`
      });

      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      if (redirect) {
        navigate(redirect);
      } else {
        navigate('/dashboard');
      }
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

  // --- ICON SVG ---
  const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
  const LockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>;
  const MailIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>;
  const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
  const EyeOffIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>;
  const BookIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f8fafc] relative font-sans overflow-hidden">
      
      {/* User Guide Button (Top Right) */}
      <div className="absolute top-6 right-6 z-20">
        <button 
          onClick={() => setIsGuideOpen(true)} 
          className="text-slate-400 hover:text-tmc-blue transition-colors p-2.5 rounded-full hover:bg-slate-200/50"
          title="User Guide"
        >
          <BookIcon />
        </button>
      </div>

      {/* Elegant Transparent Logo Background */}
      <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
        <img src={logoMost} alt="Background Logo" className="w-[60vw] max-w-[600px] opacity-[0.04] grayscale object-contain" />
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-[420px] bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 sm:p-10 relative z-10 mx-4">
        
        {/* Header / Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center gap-3">
            <img src={logoMost} alt="Logo" className="w-10 h-10 object-contain" />
            <h1 className="m-0 font-bold text-2xl tracking-tight text-tmc-blue leading-none">EAM</h1>
          </div>
          <span className="text-[10px] font-bold text-[#A78759] tracking-[0.2em] uppercase mt-2 text-center">PESAT Integration</span>
        </div>

        {activeView === 'login' && (
          <form onSubmit={handleLoginSubmit} className="animate-[fadeIn_0.3s_ease-out]">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-800">EAM Administrator</h2>
              <p className="text-sm text-slate-500 mt-1">Please sign-in to your account</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Email or Username <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required 
                  value={loginData.email} 
                  onChange={(e) => setLoginData({...loginData, email: e.target.value})} 
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-tmc-blue focus:ring-1 focus:ring-tmc-blue transition-colors" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={loginData.password} 
                    onChange={(e) => setLoginData({...loginData, password: e.target.value})} 
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-tmc-blue focus:ring-1 focus:ring-tmc-blue transition-colors" 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-tmc-blue focus:outline-none">
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
            </div>

            <button 
              disabled={loading} 
              type="submit" 
              className="w-full mt-8 py-2.5 bg-[#1e4b7a] hover:bg-[#15385e] text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <div className="mt-5 flex flex-col items-center gap-3 text-xs font-medium">
              <button type="button" onClick={() => setActiveView('forgot')} className="text-tmc-blue hover:text-[#15385e] transition-colors focus:outline-none">
                Forgot Password?
              </button>
              <div className="text-slate-400">
                Need access? <button type="button" onClick={() => setActiveView('register')} className="text-tmc-blue hover:underline focus:outline-none ml-1">Request here</button>
              </div>
            </div>
          </form>
        )}

        {activeView === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="animate-[fadeIn_0.3s_ease-out]">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-800">Request Access</h2>
              <p className="text-sm text-slate-500 mt-1">Fill in the details below</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700">Full Name <span className="text-red-500">*</span></label>
                <input type="text" required value={regData.name} onChange={(e) => setRegData({...regData, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-tmc-blue focus:ring-1 focus:ring-tmc-blue transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
                  <input type="email" required value={regData.email} onChange={(e) => setRegData({...regData, email: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-tmc-blue focus:ring-1 focus:ring-tmc-blue transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">Username <span className="text-red-500">*</span></label>
                  <input type="text" required value={regData.username} onChange={(e) => setRegData({...regData, username: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-tmc-blue focus:ring-1 focus:ring-tmc-blue transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showRegPassword ? "text" : "password"} required value={regData.password} onChange={(e) => setRegData({...regData, password: e.target.value})} className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-tmc-blue focus:ring-1 focus:ring-tmc-blue transition-colors" />
                    <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-tmc-blue"><EyeIcon /></button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">Confirm <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showRegConfirm ? "text" : "password"} required value={regData.confirm} onChange={(e) => setRegData({...regData, confirm: e.target.value})} className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-tmc-blue focus:ring-1 focus:ring-tmc-blue transition-colors" />
                    <button type="button" onClick={() => setShowRegConfirm(!showRegConfirm)} className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-tmc-blue"><EyeIcon /></button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">Role <span className="text-red-500">*</span></label>
                  <select required value={regData.role} onChange={(e) => setRegData({...regData, role: e.target.value})} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-tmc-blue focus:ring-1 focus:ring-tmc-blue transition-colors cursor-pointer">
                    <option value="" disabled>Select Role</option>
                    <option value="Branch Staff">Branch Staff</option>
                    <option value="Branch Manager">Branch Manager</option>
                    <option value="SPV Regional">SPV Regional</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">Branch <span className="text-red-500">*</span></label>
                  <select required value={regData.branch} onChange={(e) => setRegData({...regData, branch: e.target.value})} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-tmc-blue focus:ring-1 focus:ring-tmc-blue transition-colors cursor-pointer">
                    <option value="" disabled>Select Branch</option>
                    {branches.map((b, idx) => (
                      <option key={idx} value={b?.name || b}>{b?.name || b}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button disabled={loading} type="submit" className="w-full mt-6 py-2.5 bg-[#1e4b7a] hover:bg-[#15385e] text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
              {loading ? "Submitting..." : "Submit Request"}
            </button>

            <div className="mt-4 text-center">
              <button type="button" onClick={() => setActiveView('login')} className="text-xs text-slate-500 hover:text-tmc-blue transition-colors focus:outline-none">
                Back to Sign in
              </button>
            </div>
          </form>
        )}

        {activeView === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="animate-[fadeIn_0.3s_ease-out]">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-800">Reset Password</h2>
              <p className="text-sm text-slate-500 mt-1">Enter email to receive reset link</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Email Address <span className="text-red-500">*</span></label>
                <input 
                  type="email" 
                  required 
                  value={forgotEmail} 
                  onChange={(e) => setForgotEmail(e.target.value)} 
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-tmc-blue focus:ring-1 focus:ring-tmc-blue transition-colors" 
                />
              </div>

              <button disabled={loading} type="submit" className="w-full py-2.5 bg-[#1e4b7a] hover:bg-[#15385e] text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </div>

            <div className="mt-6 text-center">
              <button type="button" onClick={() => setActiveView('login')} className="text-xs text-slate-500 hover:text-tmc-blue transition-colors focus:outline-none">
                Back to Sign in
              </button>
            </div>
          </form>
        )}

      </div>
      
      {/* User Guide Button Moved to Top Right */}

      <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}