import React, { useState } from 'react';
import useSWR from 'swr';
import api from '../services/api';
import useAuthStore from '../store/authStore';

const fetcher = url => api.get(url).then(res => res.data.data);

const ShimmerLoader = () => (
  <div className="animate-pulse flex flex-col space-y-4 w-full">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-12 bg-slate-200 rounded-lg w-full"></div>
    ))}
  </div>
);

const AuditLogs = () => {
  const { user } = useAuthStore();
  const [filterModule, setFilterModule] = useState('All');
  const [filterAction, setFilterAction] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Build Query Params based on user role
  const queryParams = new URLSearchParams({
    role: user?.role || '',
    branch: user?.branch || '',
    user_name: user?.name || user?.username || '',
    limit: 1000
  });

  if (filterModule !== 'All') queryParams.append('module', filterModule);
  if (filterAction !== 'All') queryParams.append('action_type', filterAction);

  const { data: logs, error, isLoading, mutate } = useSWR(`/audit-logs?${queryParams.toString()}`, fetcher, { revalidateOnFocus: false });

  const exportToExcel = () => {
    if (!logs || logs.length === 0) return;
    
    // Create CSV content
    const headers = ['Tanggal', 'User', 'Role', 'Cabang', 'Modul', 'Tindakan', 'Deskripsi'];
    const rows = logs.map(l => [
      `"${new Date(l.created_at).toLocaleString('id-ID', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}"`,
      `"${l.user_name || ''}"`,
      `"${l.user_role || ''}"`,
      `"${l.branch || ''}"`,
      `"${l.module || ''}"`,
      `"${l.action_type || ''}"`,
      `"${(l.description || '').replace(/"/g, '""')}"`
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join("\\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `Audit_Logs_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionColor = (action) => {
    switch (action.toUpperCase()) {
      case 'CREATE': return 'bg-green-100 text-green-700 border-green-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
      case 'DISPATCH': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'RECEIVE': return 'bg-teal-100 text-teal-700 border-teal-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Pagination logic
  const validLogs = logs || [];
  const totalPages = Math.ceil(validLogs.length / itemsPerPage);
  const currentLogs = validLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="absolute inset-0 flex flex-col p-3 pb-24 md:p-6 lg:p-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="flex flex-col w-full gap-3 mb-4 md:mb-6 shrink-0 z-20">
        
        {/* MAIN TOOLBAR */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center w-full gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm relative z-50">
          
          {/* LEFT: Refresh & KPI */}
          <div className="flex items-center gap-2 relative z-50 flex-1 min-w-0">
            <button
              onClick={() => mutate()}
              title="Refresh Data"
              className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all shrink-0"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>

            <div className="hidden xl:flex items-center gap-2 px-3 border-l border-slate-200/60 h-8 ml-2">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Total</span>
                <span className="text-[10px] font-extrabold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-100">{validLogs.length}</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Filters & Actions */}
          <div className="flex items-center justify-center sm:justify-start w-full xl:w-auto gap-2 shrink-0 overflow-x-auto custom-scrollbar">
            <select 
              value={filterModule} 
              onChange={(e) => { setFilterModule(e.target.value); setCurrentPage(1); }}
              className="w-full sm:w-36 bg-slate-50 border border-slate-100 text-slate-700 rounded-xl px-3 py-1.5 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#286086]/20 h-10 shadow-inner"
            >
              <option value="All">Semua Modul</option>
              <option value="Assets">Assets</option>
              <option value="Movements">Movements</option>
              <option value="Tickets">Tickets</option>
              <option value="Users">Users</option>
            </select>

            <select 
              value={filterAction} 
              onChange={(e) => { setFilterAction(e.target.value); setCurrentPage(1); }}
              className="w-full sm:w-36 bg-slate-50 border border-slate-100 text-slate-700 rounded-xl px-3 py-1.5 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#286086]/20 h-10 shadow-inner"
            >
              <option value="All">Semua Tindakan</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="DISPATCH">DISPATCH</option>
              <option value="RECEIVE">RECEIVE</option>
            </select>

            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

            <button 
              onClick={exportToExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all shrink-0 h-10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden relative z-10">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-20">
              <tr>
                <th className="px-5 py-4">Waktu</th>
                <th className="px-5 py-4">Pengguna</th>
                <th className="px-5 py-4">Cabang</th>
                <th className="px-5 py-4">Modul</th>
                <th className="px-5 py-4">Tindakan</th>
                <th className="px-5 py-4">Deskripsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="p-5">
                    <ShimmerLoader />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-red-500 font-medium">
                    Gagal memuat data Audit Logs.
                  </td>
                </tr>
              ) : currentLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400 font-medium">
                    Tidak ada catatan aktivitas yang ditemukan.
                  </td>
                </tr>
              ) : (
                currentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600 text-[11px] font-bold">
                      {new Date(log.created_at).toLocaleString('id-ID', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-bold text-slate-700 text-xs">{log.user_name}</div>
                      <div className="text-[10px] text-slate-400 font-bold tracking-tight">{log.user_role}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 font-semibold text-xs">{log.branch}</td>
                    <td className="px-5 py-3 text-slate-700 font-bold text-xs">{log.module}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md border ${getActionColor(log.action_type)}`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs font-medium max-w-sm truncate" title={log.description}>
                      {log.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
            <span className="text-[10px] font-bold text-slate-500">
              Menampilkan {((currentPage - 1) * itemsPerPage) + 1} sampai {Math.min(currentPage * itemsPerPage, validLogs.length)} dari {validLogs.length} entri
            </span>
            <div className="flex gap-1.5">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11px] font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                Sebelumnya
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11px] font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
