import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      Swal.fire('Warning', 'Please enter your registered email address', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Simulasi API call karena endpoint public belum tersedia di backend
      await new Promise(resolve => setTimeout(resolve, 1500));
      Swal.fire({
        icon: 'success',
        title: 'Reset Link Sent',
        text: `If the email ${email} is registered in our system, you will receive a password reset link shortly.`,
        confirmButtonColor: '#286086'
      });
      setEmail('');
    } catch (error) {
      Swal.fire('Error', 'Failed to send reset link', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden animate-[slideUpFade_0.4s_ease-out]">
        
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-blue-50 text-[#286086] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Reset Password</h2>
          <p className="text-sm text-slate-500 font-medium px-4 mb-8">
            Enter your registered email address and we'll send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-left">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/></svg>
                </div>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com" 
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-all"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-[#286086] hover:bg-[#1a415b] text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:shadow-blue-900/30 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin"></div> Sending...</>
              ) : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-8">
            <Link to="/" className="text-sm font-bold text-slate-500 hover:text-[#286086] transition-colors flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
