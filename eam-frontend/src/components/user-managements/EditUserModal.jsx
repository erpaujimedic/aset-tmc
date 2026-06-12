import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import { createUser, updateUser, resetUserPassword, fetchSystemRoles } from '../../services/userService';
import useMasterStore from '../../store/masterStore';

export default function EditUserModal({ isOpen, onClose, user }) {
  const [formData, setFormData] = useState({
    name: '', email: '', username: '', phone: '', password: '', role: '', branch: [], status: 'Active', department: '', workGroup: ''
  });
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const { branches, fetchBranches } = useMasterStore();

  const [roleSearch, setRoleSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const roleRef = useRef(null);
  const branchRef = useRef(null);

  useEffect(() => {
    if (branches.length === 0) fetchBranches();
    
    const loadRoles = async () => {
      try {
        const data = await fetchSystemRoles();
        setRoles(data || []);
      } catch (error) {
        console.error("Gagal memuat roles:", error);
      }
    };
    loadRoles();
    
    if (user) {
      setFormData({
        name: user.name || '', email: user.email || '', username: user.username || '', 
        phone: user.phone || '', password: '', role: user.role || '', 
        branch: Array.isArray(user.branch) ? user.branch : (typeof user.branch === 'string' && user.branch ? [user.branch] : []), 
        status: user.status || 'Active', 
        department: user.department || '', workGroup: user.workGroup || ''
      });
      setRoleSearch(user.role || '');
    } else {
      setFormData({
        name: '', email: '', username: '', phone: '', password: '', role: '', branch: [], status: 'Active', department: '', workGroup: ''
      });
      setRoleSearch('');
    }
  }, [user, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (roleRef.current && !roleRef.current.contains(event.target)) setShowRoleDropdown(false);
      if (branchRef.current && !branchRef.current.contains(event.target)) setShowBranchDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const submitData = { ...formData };
      
      // Auto-generate username if it's empty to prevent unique constraint violation in database
      if (!submitData.username) {
        if (submitData.email) {
          submitData.username = submitData.email.split('@')[0] + Math.floor(Math.random() * 1000);
        } else {
          submitData.username = 'user' + Date.now();
        }
      }

      if (user) {
        await updateUser(user.id, submitData);
        Swal.fire('Berhasil', 'Data user berhasil diperbarui', 'success');
      } else {
        await createUser(submitData);
        Swal.fire('Berhasil', 'User baru berhasil ditambahkan', 'success');
      }
      onClose();
    } catch (e) {
      Swal.fire('Gagal', e.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    try {
      await resetUserPassword(user.id);
      Swal.fire('Terkirim!', 'Link reset password telah dibuat.', 'success');
    } catch (e) {
      Swal.fire('Gagal', 'Gagal mereset password', 'error');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-filter backdrop-blur-[3px] p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-[slideUp_0.3s_ease-out]">
        
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#286086] flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">{user ? 'Edit User Profile' : 'Add New User'}</h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Lengkapi formulir di bawah untuk mengatur akses akun.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* LEFT COLUMN: Basic Info */}
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"/></svg>
                  Informasi Dasar
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama Lengkap</label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors" placeholder="Masukkan nama lengkap" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Primary Email</label>
                      <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} disabled={!!user} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors disabled:opacity-50 disabled:cursor-not-allowed" placeholder="email@tmc.co.id" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">No. Telepon / WA</label>
                      <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors" placeholder="0812xxxx" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
                    <div className="flex gap-2">
                      <input type="password" placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} disabled={!!user} className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors disabled:text-slate-500 disabled:cursor-not-allowed" />
                      {user && (
                        <button onClick={handleReset} className="px-4 py-2 bg-rose-50 text-rose-600 font-bold text-xs rounded-xl border border-rose-100 hover:bg-rose-100 transition-colors whitespace-nowrap flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                          Reset Password
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">{user ? 'Tautan reset password akan dikirim ke email primary.' : 'Masukkan password untuk user baru.'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Roles & Branches */}
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  Akses & Organisasi
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status Akun</label>
                    <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] font-semibold text-slate-700">
                      <option value="Active">🟢 Active (Bisa Login)</option>
                      <option value="Not Active">🔴 Not Active (Disable)</option>
                    </select>
                  </div>

                  <div className="relative" ref={roleRef}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Sistem Role</label>
                    <input 
                      type="text" 
                      value={roleSearch}
                      onChange={(e) => {
                        setRoleSearch(e.target.value);
                        setFormData({...formData, role: e.target.value});
                        setShowRoleDropdown(true);
                      }}
                      onFocus={() => setShowRoleDropdown(true)}
                      placeholder="Ketik atau pilih role..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] font-semibold text-[#286086] transition-colors"
                    />
                    {showRoleDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl max-h-48 overflow-y-auto custom-scrollbar">
                        {roles.filter(r => r.toLowerCase().includes(roleSearch.toLowerCase())).map((r, idx) => (
                          <div 
                            key={idx} 
                            className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 text-slate-700 transition-colors"
                            onClick={() => {
                              setFormData({...formData, role: r});
                              setRoleSearch(r);
                              setShowRoleDropdown(false);
                            }}
                          >
                            {r}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Akses Cabang (Branch)</label>
                    <div className="flex flex-wrap gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl min-h-[50px] items-center relative" ref={branchRef}>
                      {formData.branch.map((b, i) => (
                        <span key={i} className="px-2.5 py-1 bg-[#286086] text-white text-xs rounded-md font-semibold flex items-center gap-1.5">
                          {b} 
                          <button onClick={() => setFormData({...formData, branch: formData.branch.filter((_, idx) => idx !== i)})} className="hover:text-red-300 w-4 h-4 rounded-full flex items-center justify-center bg-white/20">&times;</button>
                        </span>
                      ))}
                      
                      <div className="flex-1 min-w-[150px]">
                        <input 
                          type="text" 
                          value={branchSearch}
                          onChange={(e) => {
                            setBranchSearch(e.target.value);
                            setShowBranchDropdown(true);
                          }}
                          onFocus={() => setShowBranchDropdown(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && branchSearch.trim()) {
                              e.preventDefault();
                              const val = branchSearch.trim().toUpperCase();
                              if (!formData.branch.includes(val)) {
                                setFormData({...formData, branch: [...formData.branch, val]});
                              }
                              setBranchSearch('');
                              setShowBranchDropdown(false);
                            }
                          }}
                          placeholder="+ Tambah Akses Cabang..."
                          className="w-full bg-transparent border-none focus:ring-0 text-sm p-1 text-slate-500 font-medium outline-none"
                        />
                      </div>

                      {showBranchDropdown && (
                        <div className="absolute z-50 left-0 top-full w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl max-h-48 overflow-y-auto custom-scrollbar">
                          {['ALL', ...branches.map(b => b.name || b)]
                            .filter(b => b.toLowerCase().includes(branchSearch.toLowerCase()) && !formData.branch.includes(b))
                            .map((b, idx) => (
                              <div 
                                key={idx} 
                                className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 text-slate-700 transition-colors flex items-center gap-2"
                                onClick={() => {
                                  if (!formData.branch.includes(b)) {
                                    setFormData({...formData, branch: [...formData.branch, b]});
                                  }
                                  setBranchSearch('');
                                  setShowBranchDropdown(false);
                                }}
                              >
                                {b === 'ALL' ? '🌟 ALL (Seluruh Cabang)' : b}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">Ketik cabang lalu tekan Enter, atau pilih dari daftar dropdown.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status Akun</label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="radio" name="status" checked={formData.status === 'Active'} onChange={() => setFormData({...formData, status: 'Active'})} className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 border-slate-300 cursor-pointer" />
                        <span className="text-sm font-semibold text-slate-700 group-hover:text-emerald-600 transition-colors">Active</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="radio" name="status" checked={formData.status === 'Not Active'} onChange={() => setFormData({...formData, status: 'Not Active'})} className="w-4 h-4 text-rose-500 focus:ring-rose-500 border-slate-300 cursor-pointer" />
                        <span className="text-sm font-semibold text-slate-700 group-hover:text-rose-600 transition-colors">Not Active</span>
                      </label>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3 z-10 relative">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
            Batalkan
          </button>
          <button disabled={loading} onClick={handleSubmit} className="px-6 py-2.5 bg-[#286086] text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            )}
            Simpan Data User
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
