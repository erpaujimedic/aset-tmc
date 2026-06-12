import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { fetchSystemRoles, fetchRolePermissions, updateRolePermissions, createSystemRole, deleteSystemRole } from '../../services/userService';
import useI18nStore from '../../store/i18nStore';

export default function Roles() {
  const { t } = useI18nStore();
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('Admin System');
  const [selectAll, setSelectAll] = useState(false);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const data = await fetchSystemRoles();
        setRoles(data);
        if (data.length > 0) setSelectedRole(data[0]);
      } catch (error) {
        console.error("Gagal memuat roles:", error);
      }
    };
    loadRoles();
  }, []);

  useEffect(() => {
    if (!selectedRole) return;
    const loadPermissions = async () => {
      setLoading(true);
      try {
        const data = await fetchRolePermissions(selectedRole);
        setPermissions(data);
        
        // Cek apakah semua menyala
        const allOn = data.every(g => g.actions.every(a => a.enabled));
        setSelectAll(allOn);
      } catch (error) {
        console.error("Gagal memuat permissions:", error);
      } finally {
        setLoading(false);
      }
    };
    loadPermissions();
  }, [selectedRole]);

  const togglePermission = (moduleIdx, actionIdx) => {
    const newPerms = [...permissions];
    newPerms[moduleIdx].actions[actionIdx].enabled = !newPerms[moduleIdx].actions[actionIdx].enabled;
    setPermissions(newPerms);
    setSelectAll(newPerms.every(g => g.actions.every(a => a.enabled)));
  };

  const handleSelectAll = () => {
    const newVal = !selectAll;
    setSelectAll(newVal);
    const newPerms = permissions.map(g => ({
      ...g,
      actions: g.actions.map(a => ({ ...a, enabled: newVal }))
    }));
    setPermissions(newPerms);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateRolePermissions(selectedRole, permissions);
      Swal.fire(t('success'), `Hak akses untuk ${selectedRole} telah disimpan.`, 'success');
    } catch (error) {
      Swal.fire(t('failed'), 'Terjadi kesalahan saat menyimpan hak akses.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    const { value: roleName } = await Swal.fire({
      title: 'Tambah Jabatan Baru',
      input: 'text',
      inputLabel: 'Nama Jabatan',
      inputPlaceholder: 'Masukkan nama jabatan...',
      showCancelButton: true,
      confirmButtonText: t('add'),
      cancelButtonText: t('cancel'),
      confirmButtonColor: '#286086',
      inputValidator: (value) => {
        if (!value) return 'Nama jabatan tidak boleh kosong!';
        if (value.length < 2) return 'Nama jabatan terlalu pendek!';
      }
    });

    if (roleName) {
      try {
        const newRoles = await createSystemRole(roleName);
        setRoles(newRoles);
        setSelectedRole(roleName);
        Swal.fire(t('success'), `Jabatan ${roleName} berhasil ditambahkan!`, 'success');
      } catch (error) {
        Swal.fire(t('failed'), error.response?.data?.detail || 'Terjadi kesalahan sistem', 'error');
      }
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole || selectedRole.toLowerCase() === 'master admin') {
      Swal.fire('Ditolak', 'Master Admin adalah sistem inti dan tidak dapat dihapus!', 'error');
      return;
    }

    const result = await Swal.fire({
      title: `Hapus ${selectedRole}?`,
      text: t('cannotRevert'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: t('yesDelete'),
      cancelButtonText: t('cancel')
    });

    if (result.isConfirmed) {
      try {
        const newRoles = await deleteSystemRole(selectedRole);
        setRoles(newRoles);
        if (newRoles.length > 0) setSelectedRole(newRoles[0]);
        Swal.fire(t('deleted'), `Jabatan ${selectedRole} telah dihapus.`, 'success');
      } catch (error) {
        Swal.fire(t('failed'), error.response?.data?.detail || 'Terjadi kesalahan sistem', 'error');
      }
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
      
      {/* MAIN LAYOUT: DUAL PANE */}
      <div className="flex-1 flex gap-6 min-h-0">
        
        {/* LEFT PANE: ROLES LIST */}
        <div className="w-[320px] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
          <div className="p-4 border-b border-slate-100 bg-white z-10 relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-slate-800">{t('rolesList')}</h2>
              <button onClick={handleCreateRole} className="w-8 h-8 flex items-center justify-center bg-blue-50 text-[#286086] rounded-lg hover:bg-[#286086] hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
              <input 
                type="text" 
                placeholder={t('search')} 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {roles.filter(r => r.toLowerCase().includes(search.toLowerCase())).map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors duration-200 ${
                  selectedRole === role 
                    ? 'bg-[#286086] text-white shadow-md shadow-blue-900/20' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="font-semibold text-sm">{role}</span>
                {selectedRole === role && (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                )}
              </button>
            ))}
            {roles.filter(r => r.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <div className="p-4 text-center text-sm text-slate-400">{t('notFound')}</div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: PERMISSIONS */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white z-10 shadow-sm">
            <div>
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">{t('manageAccessFor')}</span>
              <h2 className="text-xl font-black text-[#286086] flex items-center gap-2 mt-1">
                {selectedRole}
                <button className="text-slate-400 hover:text-slate-600 transition-colors p-1" title="Edit Nama Role">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                </button>
                {selectedRole.toLowerCase() !== 'master admin' && (
                  <button onClick={handleDeleteRole} className="text-red-400 hover:text-red-600 transition-colors p-1 ml-1 bg-red-50 hover:bg-red-100 rounded-md" title="Hapus Role">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                )}
              </h2>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-600">{t('selectAll')}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={selectAll} onChange={handleSelectAll} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
              </label>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 custom-scrollbar">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {permissions.map((group, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80">
                    <h3 className="font-bold text-slate-700 text-sm">{group.module}</h3>
                  </div>
                  <div className="p-1.5">
                    {group.actions.map((action, aIdx) => (
                      <div key={aIdx} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                        <span className="text-sm font-medium text-slate-600">{action.name}</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={action.enabled} onChange={() => togglePermission(idx, aIdx)} />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#286086]"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 flex justify-end">
              <button disabled={loading} onClick={handleSave} className="px-5 py-2 bg-[#286086] text-white rounded-xl font-bold text-sm shadow-md shadow-blue-900/20 hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                {loading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                )}
                {t('saveChanges')}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
