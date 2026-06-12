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

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-white md:bg-[#f8fafc] overflow-hidden relative font-sans">
      <div className="absolute top-[-5%] md:top-[-15%] left-[-10%] md:left-[-5%] w-[80vw] md:w-[45vw] h-[80vw] md:h-[45vw] bg-tmc-blue/10 md:bg-tmc-blue/15 blur-[80px] md:blur-[120px] rounded-full mix-blend-multiply animate-pulse" />
      <div className="absolute top-[20%] md:top-auto md:bottom-[-15%] right-[-10%] md:right-[-5%] w-[60vw] md:w-[40vw] h-[60vw] md:h-[40vw] bg-[#A78759]/10 md:bg-[#A78759]/15 blur-[80px] md:blur-[100px] rounded-full mix-blend-multiply" />

      <div className="w-full h-full md:h-auto md:max-w-[400px] bg-transparent md:bg-white/85 md:backdrop-blur-2xl md:rounded-[32px] md:shadow-[0_24px_60px_-15px_rgba(48,82,138,0.2)] border-none md:border md:border-white/60 px-6 pt-10 pb-12 md:p-8 relative z-10 mx-0 md:mx-4 transition-all duration-300 flex flex-col justify-center">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-tmc-blue/10 border border-slate-100 mb-4 p-2 transition-transform hover:scale-105">
            <img src={logoMost} alt="MOST Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="m-0 font-black text-3xl tracking-tight text-tmc-blue">EAM</h1>
          <p className="text-[#A78759] font-bold mt-1 tracking-[0.2em] text-[10px]">ENTERPRISE ASSET MANAGEMENT</p>
        </div>

        {activeView === 'login' && (
          <form onSubmit={handleLoginSubmit} className="animate-[slideUpFade_0.4s_ease-out_forwards]">
            <div className="text-center mb-6">
              <h3 className="font-bold text-xl text-slate-800 tracking-tight mb-1">Sign In</h3>
              <p className="text-slate-500 text-xs font-medium">Access your secure workspace.</p>
            </div>
            
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tmc-blue transition-colors"><UserIcon /></div>
                <input type="text" placeholder="Email or Username" required value={loginData.email} onChange={(e) => setLoginData({...loginData, email: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-tmc-blue focus:ring-[3px] focus:ring-tmc-blue/15 transition-all shadow-sm" />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tmc-blue transition-colors"><LockIcon /></div>
                <input type={showPassword ? "text" : "password"} placeholder="Password" required value={loginData.password} onChange={(e) => setLoginData({...loginData, password: e.target.value})} className="w-full pl-11 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-tmc-blue focus:ring-[3px] focus:ring-tmc-blue/15 transition-all shadow-sm" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-tmc-blue focus:outline-none transition-colors">{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
              </div>
            </div>

            <div className="flex justify-between items-center my-5 px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer appearance-none w-4 h-4 border-2 border-slate-300 rounded bg-white checked:bg-tmc-blue checked:border-tmc-blue focus:outline-none focus:ring-2 focus:ring-tmc-blue/20 transition-all cursor-pointer" checked={loginData.remember} onChange={(e) => setLoginData({...loginData, remember: e.target.checked})}/>
                  <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 14" fill="none"><path d="M3 8L6 11L11 3.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"></path></svg>
                </div>
                <span className="text-slate-500 font-medium text-xs group-hover:text-slate-700 transition-colors">Remember me</span>
              </label>
            </div>

            <button disabled={loading} type="submit" className="w-full py-3.5 text-white rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-tmc-blue/30 hover:shadow-tmc-blue/50 hover:-translate-y-0.5 transition-all duration-300 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed" style={{ background: 'linear-gradient(135deg, #30528A 0%, #1e3a68 100%)' }}>
              {loading ? "Authenticating..." : "Sign In ➔"}
            </button>

            <div className="flex flex-col items-center gap-3 mt-6 text-xs font-medium">
              <div><span className="text-slate-500 me-1">New user?</span><button type="button" onClick={() => setActiveView('register')} className="text-tmc-blue font-bold hover:text-[#A78759] transition-colors focus:outline-none">Request Access</button></div>
              <button type="button" onClick={() => setActiveView('forgot')} className="text-slate-400 hover:text-[#A78759] transition-colors focus:outline-none">Forgot password?</button>
            </div>
          </form>
        )}

        {activeView === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="animate-[slideUpFade_0.4s_ease-out_forwards]">
            <div className="text-center mb-5">
              <h3 className="font-bold text-xl text-slate-800 tracking-tight mb-1">Request Access</h3>
              <p className="text-slate-500 text-[11px] font-medium">Approval takes up to 24 hours.</p>
            </div>

            <div className="space-y-3">
              <input type="text" placeholder="Full Name" required value={regData.name} onChange={(e) => setRegData({...regData, name: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-tmc-blue focus:ring-[3px] focus:ring-tmc-blue/15 transition-all shadow-sm" />

              <div className="grid grid-cols-2 gap-3">
                <input type="email" placeholder="Email" required value={regData.email} onChange={(e) => setRegData({...regData, email: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-tmc-blue focus:ring-[3px] focus:ring-tmc-blue/15 transition-all shadow-sm" />
                <input type="text" placeholder="Username" required value={regData.username} onChange={(e) => setRegData({...regData, username: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-tmc-blue focus:ring-[3px] focus:ring-tmc-blue/15 transition-all shadow-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative group">
                  <input type={showRegPassword ? "text" : "password"} placeholder="Password" required value={regData.password} onChange={(e) => setRegData({...regData, password: e.target.value})} className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-tmc-blue focus:ring-[3px] focus:ring-tmc-blue/15 transition-all shadow-sm" />
                  <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-tmc-blue focus:outline-none">{showRegPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
                </div>
                <div className="relative group">
                  <input type={showRegConfirm ? "text" : "password"} placeholder="Confirm" required value={regData.confirm} onChange={(e) => setRegData({...regData, confirm: e.target.value})} className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-tmc-blue focus:ring-[3px] focus:ring-tmc-blue/15 transition-all shadow-sm" />
                  <button type="button" onClick={() => setShowRegConfirm(!showRegConfirm)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-tmc-blue focus:outline-none">{showRegConfirm ? <EyeOffIcon /> : <EyeIcon />}</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select required value={regData.role} onChange={(e) => setRegData({...regData, role: e.target.value})} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-tmc-blue focus:ring-[3px] focus:ring-tmc-blue/15 transition-all shadow-sm cursor-pointer appearance-none">
                  <option value="" disabled>-- Role --</option>
                  <option value="Branch Staff">Branch Staff</option>
                  <option value="Branch Manager">Branch Manager</option>
                  <option value="SPV Regional">SPV Regional</option>
                </select>
                <select required value={regData.branch} onChange={(e) => setRegData({...regData, branch: e.target.value})} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-tmc-blue focus:ring-[3px] focus:ring-tmc-blue/15 transition-all shadow-sm cursor-pointer appearance-none">
                  <option value="" disabled>-- Branch --</option>
                  {branches.map((b, idx) => (
                    <option key={idx} value={b?.name || b}>{b?.name || b}</option>
                  ))}
                </select>
              </div>
            </div>

            <button disabled={loading} type="submit" className="w-full mt-5 py-3 text-white rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-tmc-blue/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed" style={{ background: 'linear-gradient(135deg, #30528A 0%, #1e3a68 100%)' }}>
              {loading ? "Submitting..." : "Submit Request"}
            </button>

            <button type="button" onClick={() => setActiveView('login')} className="w-full mt-4 text-slate-400 text-[11px] font-bold hover:text-tmc-blue transition-colors focus:outline-none">
              ← Cancel & Back to Sign In
            </button>
          </form>
        )}

        {activeView === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="animate-[slideUpFade_0.4s_ease-out_forwards]">
            <div className="text-center mb-6">
              <div className="mx-auto bg-gradient-to-br from-[#A78759]/10 to-[#A78759]/30 w-12 h-12 rounded-full flex items-center justify-center text-[#A78759] mb-4"><MailIcon /></div>
              <h3 className="font-bold text-xl text-slate-800 tracking-tight mb-1">Reset Password</h3>
              <p className="text-slate-500 text-xs font-medium">We'll send a recovery link to your email.</p>
            </div>

            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#A78759] transition-colors"><MailIcon /></div>
                <input type="email" placeholder="name@most.co.id" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#A78759] focus:ring-[3px] focus:ring-[#A78759]/15 transition-all shadow-sm" />
              </div>

              <button disabled={loading} type="submit" className="w-full py-3.5 text-white rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-[#A78759]/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed" style={{ background: 'linear-gradient(135deg, #A78759 0%, #8c714a 100%)' }}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </div>

            <button type="button" onClick={() => setActiveView('login')} className="w-full mt-6 text-slate-400 text-xs font-bold hover:text-tmc-blue transition-colors focus:outline-none">
              ← Back to Sign In
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100/60 flex items-center justify-center gap-4">
          <button 
            onClick={() => setIsGuideOpen(true)}
            className="text-slate-400 hover:text-[#286086] flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            User Guide
          </button>
        </div>

      </div>
      
      <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}