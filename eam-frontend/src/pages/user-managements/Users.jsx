import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import EditUserModal from '../../components/user-managements/EditUserModal';
import { fetchAllUsers, deleteUser, resetUserPassword, fetchSystemRoles, importUsers } from '../../services/userService';
import api from '../../services/api';
import useMasterStore from '../../store/masterStore';
import useI18nStore from '../../store/i18nStore';
import useAuthStore from '../../store/authStore';
import ShimmerLoader from '../../components/ui/ShimmerLoader';

export default function Users() {
  const { t } = useI18nStore();
  const { user, hasPermission } = useAuthStore();
  
  const canCreate = hasPermission('User Managements - Users', 'Create');
  const canEdit = hasPermission('User Managements - Users', 'Edit');
  const canDelete = hasPermission('User Managements - Users', 'Delete');

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  // Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Filter States
  const [filterRole, setFilterRole] = useState('All Roles');
  const [filterBranch, setFilterBranch] = useState('All Branches');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [branchSearch, setBranchSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');

  // Master Data
  const [roles, setRoles] = useState([]);
  const { branches, fetchBranches } = useMasterStore();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';
      const isAdminSystem = ['Master Admin', 'Admin System'].includes(user?.role);
      const apiBranchParam = (isAdminSystem || isAllBranch) 
        ? null 
        : (Array.isArray(user?.branch) ? user.branch.join(',') : user?.branch);
        
      const data = await fetchAllUsers(apiBranchParam);
      setUsers(data);
    } catch (error) {
      console.error(error);
      Swal.fire({ icon: 'error', title: t('failed'), text: 'Failed to load users data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        if (branches.length === 0) await fetchBranches();
        const rolesData = await fetchSystemRoles();
        setRoles(rolesData || []);
      } catch (err) {
        console.error(err);
      }
      await loadUsers();
    };
    init();
  }, []);

  const handleDownloadTemplate = async () => {
    Swal.fire({ title: 'Downloading Template...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const response = await api.get('/users/import-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'User_Import_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      Swal.close();
    } catch (error) {
      console.error('Error downloading template:', error);
      Swal.fire('Failed', 'Failed to download template', 'error');
    }
  };

  const handleImportSubmit = async () => {
    const file = fileInputRef.current?.files[0];
    if (!file) {
      Swal.fire('Error', 'Silakan pilih file Excel terlebih dahulu', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    Swal.fire({ title: 'Mengimport Data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await importUsers(formData);
      Swal.fire('Sukses', res.message || 'User berhasil diimport', 'success');
      setIsImportModalOpen(false);
      loadUsers();
    } catch (error) {
      console.error('Import error:', error);
      Swal.fire('Gagal', error.response?.data?.detail || 'Gagal mengimport data', 'error');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    
    const matchRole = filterRole === 'All Roles' ? true : filterRole === u.role;
    const matchStatus = filterStatus === 'All Status' ? true : filterStatus === u.status;
    
    // Branch Match (u.branch can be string or array)
    let matchBranch = true;
    if (filterBranch !== 'All Branches') {
      const fbLower = filterBranch.toLowerCase();
      if (Array.isArray(u.branch)) {
        matchBranch = u.branch.some(b => b.toLowerCase() === fbLower || b.toLowerCase() === 'all');
      } else if (u.branch) {
        const ubLower = u.branch.toLowerCase();
        matchBranch = ubLower === fbLower || ubLower === 'all';
      } else {
        matchBranch = false;
      }
    }

    return matchSearch && matchRole && matchStatus && matchBranch;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    let aVal = a[key] || '';
    let bVal = b[key] || '';

    if (key === 'lastLogin') {
      aVal = aVal === 'Never' ? 0 : new Date(aVal).getTime();
      bVal = bVal === 'Never' ? 0 : new Date(bVal).getTime();
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <svg className="w-3 h-3 ml-1 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>;
    }
    return sortConfig.direction === 'asc' ? (
      <svg className="w-3 h-3 ml-1 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
    ) : (
      <svg className="w-3 h-3 ml-1 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
    );
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
      
      {/* FILTER BAR */}
      <div className="flex justify-between items-center w-full gap-3 mb-6 shrink-0 z-20">
        <div className="flex items-center flex-1 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm relative min-w-0">
          <div className="flex items-center w-full justify-between gap-2">
            
            <div className="flex items-center shrink-0 w-1/3 min-w-[200px]">
              <svg className="w-4 h-4 text-[#286086] ml-2 mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input 
                type="text" 
                placeholder={t('searchNameEmail') || 'Search by name or email...'} 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-2 py-1 bg-transparent text-sm font-bold text-slate-700 placeholder-slate-400 focus:outline-none"
              />
            </div>
            
            {openDropdown && (
              <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)}></div>
            )}

            <div className="w-px h-5 bg-slate-200 shrink-0 mx-1"></div>

            {/* Custom Branch Dropdown */}
            <div className="relative h-8 flex items-center shrink-0">
              <button 
                onClick={() => setOpenDropdown(openDropdown === 'branch' ? null : 'branch')}
                className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold px-3 outline-none cursor-pointer flex items-center gap-2 transition-colors relative z-50"
              >
                <span className="truncate max-w-[120px]">{filterBranch === 'All Branches' ? t('allBranches') || 'All Branches' : filterBranch}</span>
                <svg className={`w-3 h-3 transition-transform ${openDropdown === 'branch' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {openDropdown === 'branch' && (
                <div className="absolute top-full left-0 mt-3 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-[fadeIn_0.2s_ease-out] flex flex-col">
                  <div className="p-2 border-b border-slate-100 bg-slate-50/80 shrink-0">
                    <input 
                      type="text" 
                      placeholder="Search Branch..." 
                      value={branchSearch}
                      onChange={e => setBranchSearch(e.target.value)}
                      className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#286086]/50 focus:ring-2 focus:ring-[#286086]/10"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto custom-scrollbar py-1">
                    <div 
                      onClick={() => { setFilterBranch('All Branches'); setOpenDropdown(null); setBranchSearch(''); }}
                      className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterBranch === 'All Branches' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {t('allBranches') || 'All Branches'}
                    </div>
                    {branches.map(b => b.name || b).filter(b => b.toLowerCase().includes(branchSearch.toLowerCase())).map(b => (
                      <div 
                        key={b}
                        onClick={() => { setFilterBranch(b); setOpenDropdown(null); setBranchSearch(''); }}
                        className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors truncate ${filterBranch === b ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                        title={b}
                      >
                        {b}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-slate-200 shrink-0 mx-1"></div>

            {/* Custom Role Dropdown */}
            <div className="relative h-8 flex items-center shrink-0">
              <button 
                onClick={() => setOpenDropdown(openDropdown === 'role' ? null : 'role')}
                className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold px-3 outline-none cursor-pointer flex items-center gap-2 transition-colors relative z-50"
              >
                <span className="truncate max-w-[120px]">{filterRole === 'All Roles' ? t('allRoles') || 'All Roles' : filterRole}</span>
                <svg className={`w-3 h-3 transition-transform ${openDropdown === 'role' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {openDropdown === 'role' && (
                <div className="absolute top-full left-0 mt-3 w-48 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-[fadeIn_0.2s_ease-out] flex flex-col">
                  <div className="p-2 border-b border-slate-100 bg-slate-50/80 shrink-0">
                    <input 
                      type="text" 
                      placeholder="Search Role..." 
                      value={roleSearch}
                      onChange={e => setRoleSearch(e.target.value)}
                      className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#286086]/50 focus:ring-2 focus:ring-[#286086]/10"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto custom-scrollbar py-1">
                    <div 
                      onClick={() => { setFilterRole('All Roles'); setOpenDropdown(null); setRoleSearch(''); }}
                      className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterRole === 'All Roles' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {t('allRoles') || 'All Roles'}
                    </div>
                    {roles.filter(r => r.toLowerCase().includes(roleSearch.toLowerCase())).map(r => (
                      <div 
                        key={r}
                        onClick={() => { setFilterRole(r); setOpenDropdown(null); setRoleSearch(''); }}
                        className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors truncate ${filterRole === r ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                        title={r}
                      >
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-slate-200 shrink-0 mx-1"></div>

            {/* Custom Status Dropdown */}
            <div className="relative h-8 flex items-center shrink-0">
              <button 
                onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold px-3 outline-none cursor-pointer flex items-center gap-2 transition-colors relative z-50"
              >
                <span className="truncate max-w-[120px]">{filterStatus === 'All Status' ? t('allStatus') || 'All Status' : filterStatus}</span>
                <svg className={`w-3 h-3 transition-transform ${openDropdown === 'status' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {openDropdown === 'status' && (
                <div className="absolute top-full left-0 mt-3 w-40 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-[fadeIn_0.2s_ease-out]">
                  <div className="py-1">
                    <div 
                      onClick={() => { setFilterStatus('All Status'); setOpenDropdown(null); }}
                      className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterStatus === 'All Status' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {t('allStatus') || 'All Status'}
                    </div>
                    {['Active', 'Not Active'].map(s => (
                      <div 
                        key={s}
                        onClick={() => { setFilterStatus(s); setOpenDropdown(null); }}
                        className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterStatus === s ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => loadUsers()} 
            title={t('refreshData') || 'Refresh Data'}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 w-11 h-11 rounded-xl flex items-center justify-center shadow-sm transition-all shrink-0"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          {canCreate && (
            <>
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 h-11 rounded-xl font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Import Excel
              </button>
              <button 
                onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}
                className="bg-[#286086] hover:bg-[#1a4666] text-white px-5 h-11 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2 shrink-0">
                <span className="text-lg leading-none">+</span> {t('add')} User
              </button>
            </>
          )}
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm shadow-sm">
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center">User {renderSortIcon('name')}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('branch')}>
                  <div className="flex items-center">Branch Access {renderSortIcon('branch')}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('role')}>
                  <div className="flex items-center">Role {renderSortIcon('role')}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('lastLogin')}>
                  <div className="flex items-center">Last Login {renderSortIcon('lastLogin')}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('status')}>
                  <div className="flex items-center">Status {renderSortIcon('status')}</div>
                </th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sortedUsers.map((user) => (
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
                    {user.lastLogin !== 'Never' ? new Date(user.lastLogin).toLocaleString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
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
                      {canEdit && (
                        <>
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
                        </>
                      )}
                      {canDelete && (
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
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              
              {loading && (
                <tr>
                  <td colSpan="6" className="p-0">
                    <ShimmerLoader rowCount={5} columnCount={6} />
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

      {/* IMPORT MODAL */}
      {isImportModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-[slideUp_0.3s_ease-out]">
            <div className="bg-[#286086] p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black tracking-tight">Import Bulk User</h3>
                <p className="text-blue-100 text-xs mt-1 font-medium">Unggah file Excel untuk menambahkan banyak user</p>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6 flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <svg className="w-12 h-12 text-[#286086] mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <p className="text-sm font-bold text-slate-700 mb-1">Unggah Template Excel</p>
                <p className="text-xs text-slate-500 mb-4 text-center">Pastikan Anda menggunakan template yang disediakan.</p>
                
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".xlsx"
                  className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2.5 file:px-4
                    file:rounded-xl file:border-0
                    file:text-xs file:font-bold
                    file:bg-blue-50 file:text-[#286086]
                    hover:file:bg-blue-100 transition-colors
                    cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleImportSubmit}
                  className="w-full bg-[#286086] hover:bg-[#1a4666] text-white py-3 rounded-xl font-black text-sm shadow-lg shadow-blue-900/20 transition-all"
                >
                  Proses Import Data
                </button>
                <button 
                  onClick={handleDownloadTemplate}
                  className="w-full bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 py-3 rounded-xl font-bold text-sm transition-all"
                >
                  Download Template .xlsx
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
