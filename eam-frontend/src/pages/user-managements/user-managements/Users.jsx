import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import EditUserModal from '../../components/user-managements/EditUserModal';
import { fetchAllUsers, deleteUser, resetUserPassword, fetchSystemRoles } from '../../services/userService';
import useMasterStore from '../../store/masterStore';
import useI18nStore from '../../store/i18nStore';

const FilterDropdown = ({ label, value, onChange, options, placeholder }) => {
  const { t } = useI18nStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between px-4 py-2 bg-slate-50 border rounded-xl text-sm cursor-pointer min-w-[160px] transition-colors ${isOpen || value.length > 0 ? 'border-[#286086] ring-1 ring-[#286086]' : 'border-slate-200 hover:border-slate-300'}`}
      >
        <span className={value.length > 0 ? 'text-[#286086] font-bold truncate max-w-[120px]' : 'text-slate-600'}>
          {value.length === 0 ? label : value.length === 1 ? value[0] : `${value.length} ${t('selected')}`}
        </span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[300px]">
          <div className="p-2 border-b border-slate-100">
            <input 
              type="text" 
              autoFocus
              placeholder={t('search')} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#286086]"
            />
          </div>
          <div className="overflow-y-auto custom-scrollbar p-1">
            <div 
              onClick={() => { onChange([]); setIsOpen(false); setSearch(''); }}
              className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${value.length === 0 ? 'bg-blue-50 text-[#286086] font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {label}
            </div>
            {filteredOptions.map((opt, i) => {
              const isSelected = value.includes(opt);
              return (
                <label 
                  key={i}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors hover:bg-slate-50 group"
                >
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => {
                        if (isSelected) {
                          onChange(value.filter(v => v !== opt));
                        } else {
                          onChange([...value, opt]);
                        }
                      }}
                      className="peer appearance-none w-4 h-4 border-2 border-slate-300 rounded bg-white checked:bg-[#30528A] checked:border-[#30528A] transition-all cursor-pointer" 
                    />
                    <svg className="absolute w-2.5 h-2.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 14" fill="none"><path d="M3 8L6 11L11 3.5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"></path></svg>
                  </div>
                  <span className={`transition-colors ${isSelected ? 'text-[#286086] font-bold' : 'text-slate-600 group-hover:text-slate-900'}`}>
                    {opt}
                  </span>
                </label>
              );
            })}
            {filteredOptions.length === 0 && <div className="px-3 py-4 text-xs text-center text-slate-400">{t('notFound')}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default function Users() {
  const { t } = useI18nStore();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterRole, setFilterRole] = useState([]);
  const [filterBranch, setFilterBranch] = useState([]);
  const [filterStatus, setFilterStatus] = useState([]);

  // Master Data
  const [roles, setRoles] = useState([]);
  const { branches, fetchBranches } = useMasterStore();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch (error) {
      console.error(error);
      Swal.fire({ icon: 'error', title: t('failed'), text: 'Failed to load users data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    if (branches.length === 0) fetchBranches();
    fetchSystemRoles().then(data => setRoles(data || [])).catch(console.error);
  }, []);

  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    
    const matchRole = filterRole.length === 0 ? true : filterRole.includes(u.role);
    const matchStatus = filterStatus.length === 0 ? true : filterStatus.includes(u.status);
    
    // Branch Match (u.branch can be string or array)
    let matchBranch = true;
    if (filterBranch.length > 0) {
      const fbLowerArr = filterBranch.map(b => b.toLowerCase());
      if (Array.isArray(u.branch)) {
        matchBranch = u.branch.some(b => fbLowerArr.includes(b.toLowerCase()) || b.toLowerCase() === 'all');
      } else if (u.branch) {
        const ubLower = u.branch.toLowerCase();
        matchBranch = fbLowerArr.includes(ubLower) || ubLower === 'all';
      } else {
        matchBranch = false;
      }
    }

    return matchSearch && matchRole && matchStatus && matchBranch;
  });

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
      
      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
          <input 
            type="text" 
            placeholder={t('searchNameEmail')} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors"
          />
        </div>
        
        <FilterDropdown 
          label={t('allBranches')} 
          value={filterBranch} 
          onChange={setFilterBranch} 
          options={branches.map(b => b.name || b)} 
        />
        
        <FilterDropdown 
          label={t('allRoles')} 
          value={filterRole} 
          onChange={setFilterRole} 
          options={roles} 
        />
        
        <FilterDropdown 
          label={t('allStatus')} 
          value={filterStatus} 
          onChange={setFilterStatus} 
          options={['Active', 'Not Active']} 
        />
        
        <button 
          onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}
          className="ml-auto px-4 py-2 bg-[#286086] text-white rounded-xl font-bold text-sm shadow-md shadow-blue-900/20 hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 whitespace-nowrap">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          {t('add')} User
        </button>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm shadow-sm">
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Branch Access</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Last Login</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-[#286086] font-bold flex items-center justify-center flex-shrink-0">
                        {user.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{user.name}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(user.branch) ? user.branch.map((b, i) => (
                        <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-semibold border border-slate-200">
                          {b}
                        </span>
                      )) : typeof user.branch === 'string' ? (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-semibold border border-slate-200">
                          {user.branch}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-700">
                    {user.role}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                    {user.lastLogin}
                  </td>
                  <td className="px-6 py-4">
                    {user.status !== 'Not Active' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Not Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                        className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Edit User">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                      </button>
                      <button 
                        onClick={async () => {
                          const res = await Swal.fire({ title: 'Reset Password?', text: `${t('sendResetLink')} ${user.email}?`, icon: 'warning', showCancelButton: true });
                          if (res.isConfirmed) {
                            try {
                              await resetUserPassword(user.id);
                              Swal.fire(t('resetLinkSentTitle'), t('resetLinkSentDesc'), 'success');
                            } catch (e) {
                              Swal.fire(t('failedReset'), t('failedResetDesc'), 'error');
                            }
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Reset Password">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                      </button>
                      <button 
                        onClick={async () => {
                          const res = await Swal.fire({ title: t('sureDelete'), text: `${t('sureDelete')} ${user.name}?`, icon: 'error', showCancelButton: true, confirmButtonText: t('yesDelete'), cancelButtonText: t('cancel'), confirmButtonColor: '#EC363A' });
                          if (res.isConfirmed) {
                            try {
                              await deleteUser(user.id);
                              Swal.fire(t('deleted'), 'User deleted successfully', 'success');
                              loadUsers();
                            } catch (e) {
                              Swal.fire(t('failed'), 'Failed to delete user', 'error');
                            }
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Delete User">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {loading && (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-slate-400 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-[#286086] border-t-transparent animate-spin"></div>
                      {t('loadingData')}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
          {filteredUsers.length === 0 && (
            <div className="p-10 text-center flex flex-col items-center justify-center text-slate-500">
              <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
              <p className="font-semibold text-lg">{t('dataNotFound')}</p>
            </div>
          )}
        </div>
      </div>

      <EditUserModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          loadUsers(); // Refresh data after close
        }} 
        user={selectedUser} 
      />

    </div>
  );
}
