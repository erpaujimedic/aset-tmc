import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import useI18nStore from '../store/i18nStore';
import useAuthStore from '../store/authStore';
import BaseModal from '../components/ui/BaseModal';
import Select from 'react-select';
import Swal from 'sweetalert2';
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/light.css";
import ShimmerLoader from '../components/ui/ShimmerLoader';

export default function Ticketing() {
  const { t } = useI18nStore();
  const { user, hasPermission } = useAuthStore();
  
  const canCreate = hasPermission('Ticketing', 'Create');
  const canExport = hasPermission('Ticketing', 'Export');
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncedTickets, setSyncedTickets] = useState(false);
  const [rawStats, setRawStats] = useState(null);
  const [filterType, setFilterType] = useState('All');
  const [filterRegion, setFilterRegion] = useState('All');
  const [filterBranch, setFilterBranch] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [branches, setBranches] = useState([]);
  const [assets, setAssets] = useState([]);
  const [showGuide, setShowGuide] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [regionSearch, setRegionSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedTicketForHistory, setSelectedTicketForHistory] = useState(null);
  const [ticketHistory, setTicketHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [viewMode, setViewMode] = useState('kanban');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA');
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('en-CA');
  });
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', branch: '', asset_id: '', component_id: '', ticket_type: 'Repair', priority: 'Medium', department: '', vendor_name: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketComponents, setTicketComponents] = useState([]);
  
  const [departments, setDepartments] = useState([]);
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    if (newTicket.asset_id) {
      api.get(`/assets/${newTicket.asset_id}/components`)
        .then(res => setTicketComponents(res.data.data || []))
        .catch(() => setTicketComponents([]));
    } else {
      setTicketComponents([]);
    }
  }, [newTicket.asset_id]);
  
  useEffect(() => {
    fetchTickets();
    fetchBranches();
    
    // Defer data-heavy lookups so initial page load is extremely fast
    setTimeout(() => {
      fetchAssets();
      fetchDepartments();
      fetchVendors();
    }, 1000);
    
    // Smart Polling: Refresh tickets every 15 seconds
    const interval = setInterval(() => {
      fetchTickets(true);
    }, 15000);
    
    return () => clearInterval(interval);
  }, []);

  const location = useLocation();
  useEffect(() => {
    if (location.state?.createForAsset) {
      const asset = location.state.createForAsset;
      setNewTicket(prev => ({
        ...prev,
        asset_id: asset.id,
        branch: asset.branch || '',
      }));
      setCreateModalOpen(true);
      
      // Clear state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterBranch, filterRegion, filterType, startDate, endDate]);

  const getTranslatedStatus = (status) => {
    switch(status) {
      case 'Open': return t('statusOpen');
      case 'In Progress': return t('statusInProgress');
      case 'Resolved': return t('statusResolved');
      case 'Closed': return t('statusClosed');
      case 'Rejected': return t('statusRejected');
      default: return status;
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get('/master/setup-data').catch(() => ({ data: { branches: [] } }));
      if (res.data && res.data.branches) {
        setBranches(res.data.branches);
      }
    } catch(err) {
      console.error(err);
    }
  };

  const getFileUrl = (url) => url ? (url.startsWith('http') ? url : api.defaults.baseURL + url) : '#';

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/setup/departments').catch(() => ({ data: { data: [] } }));
      if (res.data && res.data.data) {
        setDepartments(res.data.data);
      }
    } catch(err) {
      console.error(err);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await api.get('/setup/vendors').catch(() => ({ data: { data: [] } }));
      if (res.data && res.data.data) {
        setVendors(res.data.data);
      }
    } catch(err) {
      console.error(err);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await api.get('/assets').catch(() => ({ data: { data: [] } }));
      setAssets(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };


  const fetchTickets = async (silent = false) => {
    if (!silent) setLoading(true);
    setSyncedTickets(false);
    try {
      const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';
      const isAdminSystem = ['Master Admin', 'Admin System'].includes(user?.role);
      const apiBranchParam = (isAdminSystem || isAllBranch) 
        ? null 
        : (Array.isArray(user?.branch) ? user.branch.join(',') : user?.branch);
        
      const baseUrl = apiBranchParam ? `/tickets?branch=${encodeURIComponent(apiBranchParam)}` : '/tickets';
      const fastUrl = baseUrl.includes('?') ? `${baseUrl}&limit=100` : `${baseUrl}?limit=100`;
      
      // 1. FAST LOAD
      const resFast = await api.get(fastUrl).catch(() => ({ data: { data: [] } }));
      setTickets(resFast.data.data || []);
      
      // Fetch Stats for KPI
      try {
        const statsUrl = apiBranchParam ? `/dashboard/stats?branch=${encodeURIComponent(apiBranchParam)}` : '/dashboard/stats';
        const statsRes = await api.get(statsUrl, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' } });
        if (statsRes.data && statsRes.data.ticketStats) {
            setRawStats(statsRes.data.ticketStats);
        }
      } catch (e) { console.error("Failed to fetch ticket stats"); }

      if (!silent) setLoading(false);
      
      // 2. BACKGROUND SYNC (ALL DATA)
      setTimeout(async () => {
         try {
             const resFull = await api.get(baseUrl).catch(() => ({ data: { data: [] } }));
             setTickets(resFull.data.data || []);
             setSyncedTickets(true);
         } catch(e){}
      }, 100);
    } catch (err) {
      console.error(err);
      if (!silent) setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    const userBranch = user?.branch || '';
    setNewTicket({ 
        title: '', description: '', 
        branch: userBranch, 
        asset_id: '', component_id: '', ticket_type: 'Repair', priority: 'Medium', 
        department: '', vendor_name: '' 
    });
    setPhotoFile(null);
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newTicket.title || !newTicket.branch || !newTicket.ticket_type) {
      Swal.fire({
          icon: 'warning', 
          title: 'Validation Error', 
          text: 'Kolom Title, Branch, dan Type wajib diisi!'
      });
      return;
    }
    setIsSubmitting(true);
    try {
      let photoUrl = null;
      if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        const uploadRes = await api.post('/tickets/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        photoUrl = uploadRes.data.url;
      }

      const payload = {
        ...newTicket,
        asset_id: newTicket.asset_id || null,
        component_id: newTicket.component_id || null,
        department: newTicket.department || null,
        vendor_name: newTicket.vendor_name || null,
        photo_url: photoUrl,
        created_by: user?.fullName || user?.name || user?.username || 'System'
      };
      const res = await api.post('/tickets', payload);
      
      const createdTicket = res.data?.data?.[0];
      
      if (createdTicket && createdTicket.id) {
        // Automatically download the ISO .docx form from the backend
        window.open(`${api.defaults.baseURL}/tickets/${createdTicket.id}/download-iso-form`, '_blank');
      }

      setCreateModalOpen(false);
      fetchTickets();
      Swal.fire({
          icon: 'info', 
          title: 'Tiket Terdaftar (Waiting Form)', 
          html: 'File <b>Form Permintaan</b> sedang diunduh otomatis.<br/><br/><span style="color: #e11d48; font-weight: bold;">PENTING:</span> Tiket ini belum aktif dan <b>TIDAK BISA DIKERJAKAN</b>. Silakan lengkapi tanda tangan pada form, lalu klik tombol <b style="color: #e11d48;">Upload Form</b> di dalam tiket Anda.',
          confirmButtonColor: '#286086',
          confirmButtonText: 'Mengerti'
      });
    } catch (err) {
      console.error("Create ticket failed:", err);
      Swal.fire({
          icon: 'error', title: 'Failed to create ticket', text: err.response?.data?.detail || err.message, toast: true, position: 'top-end', timer: 3000, showConfirmButton: false
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadSignedForm = async (ticketId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      Swal.fire({ title: t('uploadingForm'), allowOutsideClick: false, showConfirmButton: false, didOpen: () => { Swal.showLoading() } });
      await api.post(`/tickets/${ticketId}/upload-signed-form`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchTickets();
      Swal.fire(t('success'), t('uploadSuccess'), 'success');
    } catch (err) {
      console.error(err);
      Swal.fire(t('error'), t('uploadFailed'), 'error');
    }
  };

  const filteredTickets = tickets.filter(tck => {
    const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';
    if (!['Master Admin', 'Admin System'].includes(user?.role) && !isAllBranch) {
      if (Array.isArray(user?.branch)) {
        if (!user.branch.includes(tck.branch)) return false;
      } else if (tck.branch !== user?.branch) {
        return false;
      }
    }
    if (filterType !== 'All' && tck.ticket_type !== filterType) return false;
    
    const branchInfo = branches.find(b => 
      b.name?.toLowerCase() === tck.branch?.toLowerCase() || 
      b.branch_code?.toLowerCase() === tck.branch?.toLowerCase()
    );
    if (filterRegion !== 'All') {
      let reg = branchInfo?.region;
      if (!reg) {
        reg = tck.branch?.toLowerCase() === 'head office' ? 'Head Office' : 'Onsite / Field';
      }
      if (reg !== filterRegion) return false;
    }
    if (filterBranch !== 'All' && tck.branch !== filterBranch) return false;
    
    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      if (!tck.ticket_number?.toLowerCase().includes(sq) && 
          !tck.title?.toLowerCase().includes(sq) && 
          !tck.description?.toLowerCase().includes(sq)) {
        return false;
      }
    }
    
    if (startDate) {
      const ticketDate = new Date(tck.created_at).toLocaleDateString('en-CA');
      if (ticketDate < startDate && tck.status !== 'Open' && tck.status !== 'In Progress') return false; 
    }
    if (endDate) {
      const ticketDate = new Date(tck.created_at).toLocaleDateString('en-CA');
      if (ticketDate > endDate && tck.status !== 'Open' && tck.status !== 'In Progress') return false;
    }
    
    return true;
  });

  const regions = [...new Set(branches.map(b => b.region).filter(Boolean))];
  const availableBranches = filterRegion === 'All' 
    ? branches 
    : branches.filter(b => b.region === filterRegion);

  const columns = ['Open', 'In Progress', 'Resolved', 'Closed', 'Rejected'];

  // Drag and drop handlers
  const handleDragStart = (e, ticketId, sourceStatus) => {
    e.dataTransfer.setData('ticketId', ticketId);
    e.dataTransfer.setData('sourceStatus', sourceStatus);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  
  const handleStatusChange = async (ticketId, sourceStatus, targetStatus) => {
    if (sourceStatus === targetStatus || !ticketId) return;

    let notes = '';
    if (targetStatus === 'Rejected') {
      const { value: reason, isConfirmed } = await Swal.fire({
        title: 'Alasan Penolakan',
        input: 'textarea',
        inputLabel: 'Wajib diisi agar tim tahu kenapa tiket ini ditolak',
        inputPlaceholder: 'Tulis alasan penolakan di sini...',
        showCancelButton: true,
        confirmButtonColor: '#e11d48',
        confirmButtonText: 'Tolak Tiket',
        cancelButtonText: 'Batal',
        inputValidator: (value) => {
          if (!value) {
            return 'Kamu wajib mengisi alasan penolakan!'
          }
        }
      });
      if (!isConfirmed) return;
      notes = reason;
    }

    const updatedTickets = tickets.map(t => 
        t.id === ticketId ? { ...t, status: targetStatus, updated_at: new Date().toISOString() } : t
    );
    setTickets(updatedTickets);

    try {
        const payload = { 
            status: targetStatus,
            changed_by_name: user?.fullName || user?.name || user?.username || 'System',
            changed_by_role: user?.roleType || user?.role || 'User',
            ...(notes ? { notes, action: 'Ticket Rejected' } : {})
        };
        await api.put(`/tickets/${ticketId}`, payload);
    } catch (err) {
        console.error("Failed to update status", err);
        fetchTickets(); 
    }
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('ticketId');
    const sourceStatus = e.dataTransfer.getData('sourceStatus');
    await handleStatusChange(ticketId, sourceStatus, targetStatus);
  };

  const openHistoryModal = async (ticket) => {
    setSelectedTicketForHistory(ticket);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    setTicketHistory([]);
    try {
      const res = await api.get(`/tickets/${ticket.id}/history`);
      setTicketHistory(res.data.data || []);
    } catch(err) {
      console.error(err);
    }
    setLoadingHistory(false);
  };
  
  const calculateSLA = (history) => {
    if (!history || history.length === 0) return null;
    let responseTimeStr = '-';
    let resolutionTimeStr = '-';
    
    const openLog = history.find(h => h.new_status === 'Open') || history[0];
    const inProgLog = history.find(h => h.new_status === 'In Progress');
    const resolvedLog = history.find(h => h.new_status === 'Resolved');
    
    const formatDiff = (d1, d2) => {
        const diffHrs = Math.max(0, (new Date(d2) - new Date(d1)) / (1000 * 60 * 60));
        if (diffHrs < 1) return `${Math.round(diffHrs * 60)} mins`;
        return `${diffHrs.toFixed(1)} hrs`;
    };

    if (openLog && inProgLog) {
        responseTimeStr = formatDiff(openLog.created_at, inProgLog.created_at);
    }
    if (inProgLog && resolvedLog) {
        resolutionTimeStr = formatDiff(inProgLog.created_at, resolvedLog.created_at);
    }
    
    return { responseTimeStr, resolutionTimeStr };
  };

  const exportToCSV = () => {
    if (filteredTickets.length === 0) return;
    const headers = ['Ticket Number', 'Title', 'Type', 'Status', 'Branch', 'Department', 'Vendor', 'Created By', 'Created At'];
    const csvContent = [
      headers.join(','),
      ...filteredTickets.map(t => [
        `"${t.ticket_number}"`,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${t.ticket_type}"`,
        `"${t.status}"`,
        `"${t.branch}"`,
        `"${t.department || ''}"`,
        `"${t.vendor_name || ''}"`,
        `"${t.created_by || ''}"`,
        `"${new Date(t.created_at).toLocaleString()}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Tickets_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const generatePageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const isDefaultDate = () => {
    const d = new Date();
    const defaultStart = new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA');
    const defaultEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('en-CA');
    return startDate === defaultStart && endDate === defaultEnd;
  };

  const hasLocalFilters = searchQuery !== '' || filterRegion !== 'All' || filterBranch !== 'All' || filterType !== 'All' || !isDefaultDate();
  const useStatsForKpi = !syncedTickets && !hasLocalFilters && rawStats;

  const kpiTotal = useStatsForKpi ? rawStats.Total : filteredTickets.length;
  const kpiOpen = useStatsForKpi ? rawStats.Open : filteredTickets.filter(t => t.status === 'Open').length;
  const kpiInProgress = useStatsForKpi ? rawStats["In Progress"] : filteredTickets.filter(t => t.status === 'In Progress').length;
  const kpiResolved = useStatsForKpi ? rawStats.Resolved : filteredTickets.filter(t => t.status === 'Resolved').length;
  const kpiClosed = useStatsForKpi ? rawStats.Closed : filteredTickets.filter(t => t.status === 'Closed').length;
  const kpiRejected = useStatsForKpi ? rawStats.Rejected : filteredTickets.filter(t => t.status === 'Rejected').length;

  return (
    <div className="absolute inset-0 flex flex-col p-4 sm:p-6 lg:p-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="flex flex-col gap-4 mb-6 shrink-0 z-20">
        
        {/* 1st Row: Main Actions & Search */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center w-full gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm relative z-50">
          <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto custom-scrollbar pb-1 xl:pb-0 shrink-0">
            <button 
              onClick={() => fetchTickets(true)} 
              title={t('refreshData')}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all shrink-0"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            
            <button 
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm shrink-0 border ${isFiltersOpen ? 'bg-[#286086] text-white border-[#286086]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              title="Toggle Filters"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            </button>

            {/* KPI Pills */}
            <div className="hidden sm:flex items-center gap-2 px-3 border-l border-slate-200/60 h-8 ml-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{t('total') || 'Total'}</span>
                <span className="text-[10px] font-extrabold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-100">{kpiTotal}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Open</span>
                <span className="text-[10px] font-extrabold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-50">{kpiOpen}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
                <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">In Prog</span>
                <span className="text-[10px] font-extrabold text-amber-700 bg-white px-1.5 py-0.5 rounded border border-amber-50">{kpiInProgress}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
                <span className="text-[9px] font-black text-blue-600 uppercase tracking-wider">Resolved</span>
                <span className="text-[10px] font-extrabold text-blue-700 bg-white px-1.5 py-0.5 rounded border border-blue-50">{kpiResolved}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider">Closed</span>
                <span className="text-[10px] font-extrabold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-100">{kpiClosed}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
                <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider">Rejected</span>
                <span className="text-[10px] font-extrabold text-rose-700 bg-white px-1.5 py-0.5 rounded border border-rose-50">{kpiRejected}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full xl:w-auto shrink-0 justify-between xl:justify-end">
            <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner h-10 items-center w-auto">
              <button onClick={() => setViewMode('kanban')} className={`px-4 py-1.5 h-full rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${viewMode === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('kanban')}</button>
              <button onClick={() => setViewMode('table')} className={`px-4 py-1.5 h-full rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${viewMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('table')}</button>
            </div>

            <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1 shrink-0"></div>

            <div className="relative flex-1 xl:w-64 min-w-[150px] shrink-0 bg-slate-50 p-1 rounded-xl border border-slate-100 shadow-inner flex items-center h-10">
              <svg className="w-4 h-4 absolute left-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input 
                type="text" 
                placeholder={t('searchTickets') || "Search tickets..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1 bg-transparent border-none outline-none text-xs font-bold text-slate-700 h-full"
              />
            </div>
            
            {canCreate && (
              <button 
                onClick={handleOpenCreateModal}
                className="bg-[#286086] hover:bg-[#1a4666] text-white px-4 h-10 rounded-xl font-bold text-[11px] shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
              >
                <span className="text-sm leading-none">+</span> {t('createTicket')}
              </button>
            )}
          </div>
        </div>

        {/* 2nd Row: Expandable Filters */}
        {isFiltersOpen ? (
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center w-full gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm relative z-20 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
              
              {openDropdown && (
                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)}></div>
              )}
              
              {/* Region Dropdown */}
              <div className="relative h-9 bg-slate-50 border border-slate-100 rounded-xl px-3 flex items-center shrink-0">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === 'region' ? null : 'region')}
                  className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold outline-none cursor-pointer flex items-center gap-1.5 transition-colors relative z-50"
                >
                  <span className="truncate max-w-[120px]">{filterRegion === 'All' ? t('allRegions') || 'All Regions' : filterRegion}</span>
                  <svg className={`w-3 h-3 transition-transform ${openDropdown === 'region' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'region' && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-[fadeIn_0.1s_ease-out] flex flex-col">
                    <div className="p-2 border-b border-slate-100 bg-slate-50/80 shrink-0">
                      <input 
                        type="text" 
                        placeholder="Search Region..." 
                        value={regionSearch}
                        onChange={e => setRegionSearch(e.target.value)}
                        className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#286086]/50 focus:ring-2 focus:ring-[#286086]/10"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto custom-scrollbar py-1">
                      <div 
                        onClick={() => { setFilterRegion('All'); setFilterBranch('All'); setOpenDropdown(null); setRegionSearch(''); setCurrentPage(1); }}
                        className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterRegion === 'All' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {t('allRegions') || 'All Regions'}
                      </div>
                      {regions.filter(r => r.toLowerCase().includes(regionSearch.toLowerCase())).map(r => (
                        <div 
                          key={r}
                          onClick={() => { setFilterRegion(r); setFilterBranch('All'); setOpenDropdown(null); setRegionSearch(''); setCurrentPage(1); }}
                          className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors truncate ${filterRegion === r ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                          title={r}
                        >
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Branch Dropdown */}
              <div className="relative h-9 bg-slate-50 border border-slate-100 rounded-xl px-3 flex items-center shrink-0">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === 'branch' ? null : 'branch')}
                  className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold outline-none cursor-pointer flex items-center gap-1.5 transition-colors relative z-50"
                >
                  <span className="truncate max-w-[120px]">{filterBranch === 'All' ? t('allBranches') || 'All Branches' : filterBranch}</span>
                  <svg className={`w-3 h-3 transition-transform ${openDropdown === 'branch' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'branch' && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-[fadeIn_0.1s_ease-out] flex flex-col">
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
                        onClick={() => { setFilterBranch('All'); setOpenDropdown(null); setBranchSearch(''); setCurrentPage(1); }}
                        className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterBranch === 'All' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {t('allBranches') || 'All Branches'}
                      </div>
                      {availableBranches.filter(b => (b.name || b.branch_code).toLowerCase().includes(branchSearch.toLowerCase())).map(b => (
                        <div 
                          key={b.id}
                          onClick={() => { setFilterBranch(b.name || b.branch_code); setOpenDropdown(null); setBranchSearch(''); setCurrentPage(1); }}
                          className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors truncate ${filterBranch === (b.name || b.branch_code) ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                          title={b.name || b.branch_code}
                        >
                          {b.name || b.branch_code}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Ticket Type Dropdown */}
              <div className="relative h-9 bg-slate-50 border border-slate-100 rounded-xl px-3 flex items-center shrink-0">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
                  className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold outline-none cursor-pointer flex items-center gap-1.5 transition-colors relative z-50"
                >
                  <span className="truncate max-w-[100px]">{filterType === 'All' ? t('allTypes') || 'All Types' : filterType}</span>
                  <svg className={`w-3 h-3 transition-transform ${openDropdown === 'type' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'type' && (
                  <div className="absolute top-full left-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-[fadeIn_0.1s_ease-out]">
                    <div className="py-1">
                      {['All', 'Repair', 'Replacement', 'Calibration'].map(st => (
                        <div 
                          key={st}
                          onClick={() => { setFilterType(st); setOpenDropdown(null); setCurrentPage(1); }}
                          className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterType === st ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          {st === 'All' ? t('allTypes') || 'All Types' : st}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 h-9 rounded-xl shrink-0">
                 <Flatpickr 
                   value={startDate} 
                   onChange={([date]) => setStartDate(date ? date.toLocaleDateString('en-CA') : '')} 
                   options={{ dateFormat: "Y-m-d" }}
                   className="text-xs font-bold text-slate-600 outline-none bg-transparent cursor-pointer w-20 placeholder-slate-400" 
                   placeholder="Start Date"
                 />
                 <span className="text-slate-300 font-black">-</span>
                 <Flatpickr 
                   value={endDate} 
                   onChange={([date]) => setEndDate(date ? date.toLocaleDateString('en-CA') : '')} 
                   options={{ dateFormat: "Y-m-d" }}
                   className="text-xs font-bold text-slate-600 outline-none bg-transparent cursor-pointer w-20 placeholder-slate-400" 
                   placeholder="End Date"
                 />
              </div>

            </div>
            
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {(filterRegion !== 'All' || filterBranch !== 'All' || filterType !== 'All' || startDate !== '' || endDate !== '' || searchQuery !== '') && (
                <button 
                  onClick={() => {
                    setFilterRegion('All');
                    setFilterBranch('All');
                    setFilterType('All');
                    setSearchQuery('');
                    setStartDate('');
                    setEndDate('');
                    setCurrentPage(1);
                  }}
                  title="Reset Filters"
                  className="bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 px-3 py-1.5 h-9 rounded-xl flex items-center justify-center shadow-sm transition-all font-bold text-[11px] gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Reset
                </button>
              )}

              {canExport && (
                <button 
                  onClick={exportToCSV} 
                  title="Export CSV"
                  className="bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-600 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex-1 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <ShimmerLoader type={viewMode === 'table' ? 'table' : 'card'} rows={4} />
        </div>
      ) : viewMode === 'table' ? (
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="overflow-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider w-[120px]">{t('ticketId')}</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('assetTitle')}</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider w-[180px]">{t('branch')}</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider w-[120px]">{t('status')}</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center w-[120px]">{t('form')}</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center w-[120px]">{t('action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTickets.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-16 px-4">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center shadow-inner">
                          <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <div>
                           <p className="text-sm font-bold text-slate-600">{t('noTicketsFound') || 'Belum ada tiket saat ini'}</p>
                           <p className="text-[11px] text-slate-400 mt-0.5">Coba sesuaikan filter atau tambahkan tiket baru.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : paginatedTickets.map(tck => {
                  const assetName = tck.asset_id ? assets.find(a => a.id === tck.asset_id)?.name : null;
                  const displayTitle = assetName || tck.title;
                  return (
                    <tr key={tck.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-3 align-top">
                        <div className="font-mono text-[10px] text-slate-500 mb-1">{tck.ticket_number}</div>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest border inline-block ${
                            tck.ticket_type === 'Repair' ? 'bg-rose-50 text-rose-600 border-rose-200' : 
                            tck.ticket_type === 'Replacement' ? 'bg-purple-50 text-purple-600 border-purple-200' : 
                            tck.ticket_type === 'Calibration' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {tck.ticket_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold text-sm text-slate-800 line-clamp-2 leading-snug group-hover:text-[#286086] transition-colors">{displayTitle}</div>
                        {assetName && <div className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-1 font-medium">{tck.title}</div>}
                        <div className="text-[10px] font-medium text-slate-500 mt-1 border-t border-slate-100 pt-1.5 flex justify-between items-center">
                          <span>{t('by')} {tck.created_by || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-xs font-bold text-slate-600">{tck.branch}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{new Date(tck.created_at).toLocaleDateString('id-ID')}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select 
                          value={tck.status} 
                          onChange={(e) => handleStatusChange(tck.id, tck.status, e.target.value)}
                          className={`text-[11px] font-bold bg-white px-2 py-1.5 rounded-lg border shadow-sm cursor-pointer outline-none focus:ring-2 focus:ring-[#286086]/20 transition-all w-28 appearance-none ${
                            tck.status === 'Closed' ? 'text-slate-500 border-slate-200' :
                            tck.status === 'Resolved' ? 'text-emerald-600 border-emerald-200' :
                            tck.status === 'Rejected' ? 'text-rose-600 border-rose-200' :
                            'text-slate-700 border-slate-200'
                          }`}
                          style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1em' }}
                        >
                          {columns.map(c => <option key={c} value={c}>{getTranslatedStatus(c)}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top text-center">
                        {!tck.signed_form_url ? (
                           <span className="inline-flex text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-200 animate-pulse">Waiting Form</span>
                        ) : (
                           <span className="inline-flex text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">Uploaded</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-center">
                        <button onClick={() => openHistoryModal(tck)} className="text-[10px] font-bold text-[#286086] hover:text-white hover:bg-[#286086] bg-[#286086]/5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap border border-[#286086]/20">{t('ticketDetails')}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="flex justify-between items-center py-4 px-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex-wrap gap-4">
            <span className="text-xs font-bold text-slate-500">
              {t('showing')} {filteredTickets.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} {t('to')} {Math.min(currentPage * itemsPerPage, filteredTickets.length)} {t('of')} {filteredTickets.length} {t('entries')}
            </span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                {t('previous')}
              </button>
              
              {generatePageNumbers().map((pageNum, idx) => (
                <button
                  key={idx}
                  disabled={pageNum === '...'}
                  onClick={() => pageNum !== '...' && setCurrentPage(pageNum)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                    pageNum === currentPage 
                      ? 'bg-[#286086] text-white shadow-sm border border-[#286086]' 
                      : pageNum === '...'
                      ? 'bg-transparent text-slate-400 cursor-default'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                {t('next')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 pb-2">
          <div className="flex md:grid md:grid-cols-5 gap-4 h-full w-full overflow-x-auto md:overflow-visible snap-x snap-mandatory custom-scrollbar pb-2">
            {columns.map(status => {
              const colTickets = filteredTickets.filter(t => t.status === status);
              return (
                <div 
                  key={status} 
                  className="w-[85vw] md:w-auto shrink-0 snap-center flex flex-col bg-slate-200/50 rounded-2xl border border-slate-200 shadow-inner overflow-y-auto custom-scrollbar relative h-full"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                >
                  <div className="sticky top-0 z-10 p-4 border-b border-slate-200 flex justify-between items-center bg-white/90 backdrop-blur-md rounded-t-2xl">
                    <h3 className="font-bold text-slate-700 tracking-wider text-xs uppercase">{getTranslatedStatus(status)}</h3>
                    <span className="bg-white border border-slate-200 text-slate-500 text-[10px] font-black px-2 py-0.5 rounded-full">{colTickets.length}</span>
                  </div>
                  <div className="p-3 flex-1 overflow-y-auto custom-scrollbar space-y-3">
                    {colTickets.map(tck => {
                      const createdAt = new Date(tck.created_at);
                      const isClosed = tck.status === 'Closed' || tck.status === 'Resolved';
                      const endTime = isClosed ? new Date(tck.updated_at) : new Date();
                      const elapsedMs = endTime - createdAt;
                      const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
                      const elapsedHours = Math.floor((elapsedMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                      // Mock target SLA (e.g., 3 days), ideally this would come from the SLASettings
                      const slaTargetDays = 3; 
                      const slaPercentage = Math.min(100, Math.round((elapsedDays / slaTargetDays) * 100));
                      const isOverdue = elapsedDays > slaTargetDays;

                      return (
                        <div 
                          key={tck.id} 
                          draggable={!!tck.signed_form_url}
                          onDragStart={(e) => {
                             if (!tck.signed_form_url) {
                                e.preventDefault();
                                return;
                             }
                             handleDragStart(e, tck.id, status);
                          }}
                          className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${!tck.signed_form_url ? 'border-rose-500 border-2 shadow-rose-100 bg-rose-50/30' : 'border-slate-200 hover:shadow-md hover:border-[#286086]/30 cursor-grab active:cursor-grabbing'} group relative`}
                        >
                          {!tck.signed_form_url && (
                             <div className="absolute -top-2.5 -right-2.5 bg-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                               Waiting Form
                             </div>
                          )}
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest border ${
                              tck.ticket_type === 'Repair' ? 'bg-rose-50 text-rose-600 border-rose-200' : 
                              tck.ticket_type === 'Replacement' ? 'bg-purple-50 text-purple-600 border-purple-200' : 
                              tck.ticket_type === 'Calibration' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                              'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                              {tck.ticket_type}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{tck.ticket_number}</span>
                          </div>
                          {(() => {
                             const assetName = tck.asset_id ? assets.find(a => a.id === tck.asset_id)?.name : null;
                             const displayTitle = assetName || tck.title;
                             const displaySubtitle = assetName ? tck.title : null;
                             return (
                                <>
                                  <h4 className="font-black text-slate-800 text-[15px] group-hover:text-[#286086] transition-colors line-clamp-2 leading-snug">{displayTitle}</h4>
                                  {displaySubtitle && <p className="text-[11px] text-slate-500 font-bold italic mt-0.5 line-clamp-1">{displaySubtitle}</p>}
                                </>
                             );
                          })()}
                          <p className="text-[10px] text-slate-400 mt-1 truncate">Created by: <strong>{tck.created_by || '-'}</strong></p>
                          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{tck.description}</p>
                          
                          {/* SLA Visualization */}
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="flex justify-between items-end mb-1.5">
                              <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">SLA Tracker</span>
                                <span className={`text-xs font-bold ${isClosed ? 'text-emerald-600' : isOverdue ? 'text-rose-600' : 'text-amber-600'}`}>
                                  {elapsedDays}d {elapsedHours}h {isClosed ? '(Final)' : 'Elapsed'}
                                </span>
                              </div>
                              {!isClosed && (
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Target: {slaTargetDays}d</span>
                              )}
                            </div>
                            {!isClosed && (
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all ${isOverdue ? 'bg-rose-500' : slaPercentage > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${slaPercentage}%` }}
                                ></div>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-slate-500">
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              <span className="text-[10px] font-bold break-words leading-tight">{tck.branch}</span>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 w-full border-t border-slate-50 pt-2">
                              {!tck.signed_form_url ? (
                                <label className="cursor-pointer text-[9px] font-bold text-white bg-rose-500 hover:bg-rose-600 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap shadow-sm">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                  Upload Form
                                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => handleUploadSignedForm(tck.id, e)} />
                                </label>
                              ) : (
                                <a href={getFileUrl(tck.signed_form_url)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1 border border-emerald-200 whitespace-nowrap shadow-sm">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  View Form
                                </a>
                              )}
                              <button 
                                onClick={(e) => { e.stopPropagation(); openHistoryModal(tck); }}
                                className="text-[10px] font-bold text-[#286086] hover:text-white hover:bg-[#286086] bg-[#286086]/5 px-3 py-1.5 rounded-md transition-colors shrink-0 whitespace-nowrap border border-[#286086]/20"
                              >
                                Details
                              </button>
                              {tck.priority === 'Critical' && <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" title="Critical Priority"></span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {colTickets.length === 0 && (
                      <div className="p-4 text-center text-xs font-medium text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 mt-2">
                        {t('noTicketsFound')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Guide Modal */}
      <BaseModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        maxWidth="max-w-4xl"
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        title={
          <div className="flex flex-col">
            <span>Panduan Ticketing & SLA</span>
            <p className="text-slate-500 font-medium mt-2 text-sm font-sans font-normal">Pelajari cara menggunakan sistem Kanban Board untuk manajemen tiket cabang.</p>
          </div>
        }
        footer={
          <button onClick={() => setShowGuide(false)} className="bg-[#286086] hover:bg-[#1a4666] text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center gap-2">
            <span>Saya Mengerti</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </button>
        }
      >
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">📌</span>
              <h4 className="font-bold text-slate-800 text-base sm:text-lg">Apa itu Ticketing?</h4>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">Pusat untuk melacak semua request dari cabang. Termasuk <strong className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">Repair</strong> (kerusakan aset), <strong className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">Replacement</strong> (permintaan pergantian aset lengkap dengan alasan), dan <strong className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Calibration</strong> (kalibrasi alat).</p>
          </div>
          
          <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">🖱️</span>
              <h4 className="font-bold text-slate-800 text-base sm:text-lg">Cara Mengubah Status Tiket</h4>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">Cukup <strong className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shadow-sm">Drag and Drop (Geser)</strong> kartu tiket dari satu kolom ke kolom lainnya. Contoh: Geser tiket dari "Open" ke "In Progress" saat teknisi mulai mengerjakan.</p>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">⏱️</span>
              <h4 className="font-bold text-slate-800 text-base sm:text-lg">Cara Membaca SLA Tracker</h4>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">SLA (Service Level Agreement) adalah target batas waktu pengerjaan. Bar indikator memiliki warna:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 bg-white border border-slate-100 p-3 rounded-xl shadow-sm">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span> 
                <span className="text-xs font-bold text-slate-700">Aman</span>
              </div>
              <div className="flex items-center gap-3 bg-white border border-slate-100 p-3 rounded-xl shadow-sm">
                <span className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span> 
                <span className="text-xs font-bold text-slate-700">Warning</span>
              </div>
              <div className="flex items-center gap-3 bg-white border border-slate-100 p-3 rounded-xl shadow-sm">
                <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse"></span> 
                <span className="text-xs font-bold text-slate-700">Overdue</span>
              </div>
            </div>
          </div>
        </div>
      </BaseModal>

      {/* Details & SLA Modal */}
      <BaseModal
        isOpen={historyModalOpen && !!selectedTicketForHistory}
        onClose={() => setHistoryModalOpen(false)}
        maxWidth="max-w-4xl"
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        title={
          selectedTicketForHistory && (
            <div className="flex flex-col">
              <span>Ticket Details: {selectedTicketForHistory.ticket_number}</span>
              <p className="text-slate-400 text-sm font-medium font-sans mt-1">
                {selectedTicketForHistory.asset_id ? (assets.find(a => a.id === selectedTicketForHistory.asset_id)?.name || selectedTicketForHistory.title) : selectedTicketForHistory.title}
              </p>
            </div>
          )
        }
      >
        {selectedTicketForHistory && (
          loadingHistory ? (
            <div className="py-4">
              <ShimmerLoader rowCount={3} columnCount={2} />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Info Section */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">{t('generalInfo')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                   <div><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">{t('titleDesc')}</p><p className="font-bold text-slate-800 leading-snug">{selectedTicketForHistory.title}</p></div>
                   <div><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">{t('createdBy')}</p><p className="font-bold text-slate-800">{selectedTicketForHistory.created_by || '-'}</p></div>
                   <div><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">{t('ticketType')}</p><p className="font-bold text-slate-800">{selectedTicketForHistory.ticket_type}</p></div>
                   <div><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">{t('branch')}</p><p className="font-bold text-slate-800">{selectedTicketForHistory.branch}</p></div>
                   <div><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">{t('department')}</p><p className="font-bold text-slate-800">{selectedTicketForHistory.department || '-'}</p></div>
                   <div><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">{t('vendorName')}</p><p className="font-bold text-slate-800">{selectedTicketForHistory.vendor_name || '-'}</p></div>
                   {selectedTicketForHistory.asset_components && (
                     <div className="col-span-2 md:col-span-3 mt-2 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                       <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                       <div>
                         <p className="text-amber-700 text-[10px] font-bold uppercase tracking-wider mb-1">Komponen Yang Dilaporkan Rusak</p>
                         <p className="font-bold text-amber-900">{selectedTicketForHistory.asset_components.name} {selectedTicketForHistory.asset_components.serial_number ? `(SN: ${selectedTicketForHistory.asset_components.serial_number})` : ''}</p>
                       </div>
                     </div>
                   )}
                </div>
                {selectedTicketForHistory.description && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                     <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Deskripsi Detail</p>
                     <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">{selectedTicketForHistory.description}</p>
                  </div>
                )}
              </div>

              {/* Attachments Section */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">{t('attachments')}</h3>
                <div className="flex gap-4 flex-wrap">
                   {selectedTicketForHistory.photo_url ? (
                     <a href={getFileUrl(selectedTicketForHistory.photo_url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors shadow-sm">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                       <span className="font-bold text-xs">{t('photoAttachment')}</span>
                     </a>
                   ) : (
                     <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-400 rounded-xl border border-slate-200">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                       <span className="font-medium text-xs">{t('noProof')}</span>
                     </div>
                   )}

                   {selectedTicketForHistory.signed_form_url ? (
                     <a href={getFileUrl(selectedTicketForHistory.signed_form_url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-sm">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                       <span className="font-bold text-xs">Form Permintaan (Signed)</span>
                     </a>
                   ) : (
                     <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-500 rounded-xl border border-rose-200">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                       <span className="font-bold text-xs">{t('waitingForm')}</span>
                     </div>
                   )}
                </div>
              </div>

              {/* SLA Tracker KPI */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('responseTime')} (Open to In Progress)</div>
                  <div className="text-xl font-black text-[#286086]">{calculateSLA(ticketHistory)?.responseTimeStr || '-'}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('resolutionTime')} (In Progress to Resolved)</div>
                  <div className="text-xl font-black text-emerald-600">{calculateSLA(ticketHistory)?.resolutionTimeStr || '-'}</div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="font-bold text-slate-800 mb-4 px-2">{t('historyLog')}</h3>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  {ticketHistory.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm font-medium">{t('noHistory')}</div>
                  ) : (
                    <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 py-2">
                      {ticketHistory.map((log, idx) => (
                        <div key={log.id || idx} className="relative pl-6">
                          <div className="absolute w-3 h-3 bg-[#286086] rounded-full -left-[7px] top-1.5 ring-4 ring-white"></div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {log.action ? (
                                <span className="text-sm font-bold text-slate-800">{log.action} <span className="text-[#286086]">({log.new_status})</span></span>
                              ) : (
                                <span className="text-sm font-bold text-slate-800">{t('statusChangedTo')} <span className="text-[#286086]">{log.new_status}</span></span>
                              )}
                              <span className="text-xs font-medium text-slate-400">• {new Date(log.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            </div>
                            <div className="text-xs font-medium text-slate-600 flex items-center gap-1.5 bg-slate-50 inline-flex w-fit px-2 py-1 rounded-md border border-slate-100">
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              {log.changed_by_name} <span className="text-slate-400">({log.changed_by_role})</span>
                            </div>
                            {log.notes && (
                              <div className="mt-2 bg-rose-50 border border-rose-100 text-rose-700 text-xs p-3 rounded-lg flex items-start gap-2 shadow-sm">
                                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                <div>
                                  <div className="font-bold mb-0.5">{t('rejectionReason')}</div>
                                  <div className="font-medium whitespace-pre-wrap">{log.notes}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </BaseModal>

      {/* Create Ticket Modal */}
      <BaseModal
        isOpen={createModalOpen}
        onClose={() => !isSubmitting && setCreateModalOpen(false)}
        maxWidth="max-w-4xl"
        title={t('ticketFormTitle')}
        footer={
          <>
            <button type="button" onClick={() => setCreateModalOpen(false)} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 transition-colors">{t('cancel')}</button>
            <button type="submit" form="createTicketForm" disabled={isSubmitting} className="bg-[#286086] hover:bg-[#1a4666] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> {t('saving')}</>
              ) : (
                t('submitTicket')
              )}
            </button>
          </>
        }
      >
        <form id="createTicketForm" onSubmit={handleCreateSubmit} className="flex flex-col space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">{t('titleDesc')} <span className="text-rose-500">*</span></label>
            <input type="text" required value={newTicket.title} onChange={e => setNewTicket({...newTicket, title: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#286086] focus:ring-1 focus:ring-[#286086] outline-none text-sm font-medium bg-white" placeholder="Ticket title..." />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Description</label>
            <textarea value={newTicket.description} onChange={e => setNewTicket({...newTicket, description: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#286086] focus:ring-1 focus:ring-[#286086] outline-none text-sm font-medium bg-white min-h-[100px]" placeholder={t('ticketFormDesc')}></textarea>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">{t('ticketType')} <span className="text-rose-500">*</span></label>
              <select required value={newTicket.ticket_type} onChange={e => setNewTicket({...newTicket, ticket_type: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#286086] focus:ring-1 focus:ring-[#286086] outline-none text-sm font-bold bg-white">
                <option value="Repair">{t('repair')}</option>
                <option value="Replacement">{t('replacement')}</option>
                <option value="Calibration">{t('unscheduledCalibration') || 'Kalibrasi Insidental'}</option>
              </select>
              {newTicket.ticket_type === 'Calibration' && (
                <p className="text-[10px] text-slate-500 mt-1.5 italic leading-tight">
                  {t('calibrationHelpText') || '*Gunakan ini hanya untuk masalah kalibrasi mendadak. Untuk jadwal rutin, gunakan menu Calibration Schedules.'}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">{t('priority')} <span className="text-rose-500">*</span></label>
              <select required value={newTicket.priority} onChange={e => setNewTicket({...newTicket, priority: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#286086] focus:ring-1 focus:ring-[#286086] outline-none text-sm font-bold bg-white">
                <option value="Low">{t('low')}</option>
                <option value="Medium">{t('medium')}</option>
                <option value="High">{t('high')}</option>
                <option value="Critical">{t('critical')}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">{t('branch')} <span className="text-rose-500">*</span></label>
              <select 
                required 
                value={newTicket.branch} 
                onChange={e => setNewTicket({...newTicket, branch: e.target.value, asset_id: ''})} 
                disabled={!(['master admin', 'admin system'].includes(user?.role?.toLowerCase()) || user?.branch === 'ALL' || (Array.isArray(user?.branch) && user.branch.includes('ALL')))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#286086] focus:ring-1 focus:ring-[#286086] outline-none text-sm font-bold bg-white disabled:bg-slate-100 disabled:text-slate-500 cursor-not-allowed"
              >
                <option value="" disabled>{t('selectBranch')}</option>
                {branches.map(b => <option key={b.id} value={b.name || b.branch_code}>{b.name || b.branch_code}</option>)}
              </select>
              {!(['master admin', 'admin system'].includes(user?.role?.toLowerCase()) || user?.branch === 'ALL' || (Array.isArray(user?.branch) && user.branch.includes('ALL'))) && (
                <p className="text-[10px] text-slate-400 mt-1">{t('lockedBranch')}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">{t('asset')}</label>
              <Select 
                isDisabled={!newTicket.branch}
                value={
                  newTicket.asset_id 
                    ? { value: newTicket.asset_id, label: assets.find(a => a.id === newTicket.asset_id)?.name + ` (${newTicket.asset_id})` }
                    : { value: '', label: newTicket.branch ? t('noAsset') : t('selectBranchFirst') }
                }
                onChange={selected => setNewTicket({...newTicket, asset_id: selected.value})}
                options={[
                  { value: '', label: newTicket.branch ? t('noAsset') : t('selectBranchFirst') },
                  ...assets.filter(a => a.branch === newTicket.branch).map(a => ({ value: a.id, label: `${a.name} (${a.id})` }))
                ]}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                styles={{
                  control: (base, state) => ({
                    ...base,
                    minHeight: '42px',
                    borderRadius: '0.75rem',
                    borderColor: state.isFocused ? '#286086' : '#e2e8f0',
                    boxShadow: state.isFocused ? '0 0 0 1px #286086' : 'none',
                    '&:hover': { borderColor: state.isFocused ? '#286086' : '#cbd5e1' },
                    fontSize: '0.875rem',
                    fontWeight: '700'
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected ? '#286086' : state.isFocused ? '#f1f5f9' : 'white',
                    color: state.isSelected ? 'white' : '#334155',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    padding: '10px 16px'
                  }),
                  menuPortal: base => ({ ...base, zIndex: 99999 })
                }}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Komponen Rusak (Opsional)</label>
            <Select 
              isDisabled={!newTicket.asset_id || ticketComponents.length === 0}
              value={newTicket.component_id ? { value: newTicket.component_id, label: ticketComponents.find(c => c.id === newTicket.component_id)?.name } : null}
              onChange={selected => setNewTicket({...newTicket, component_id: selected ? selected.value : ''})}
              options={ticketComponents.map(c => ({ value: c.id, label: `${c.name} ${c.serial_number ? '('+c.serial_number+')' : ''}` }))}
              isClearable
              placeholder={newTicket.asset_id ? (ticketComponents.length > 0 ? "Pilih Komponen..." : "Tidak ada komponen") : "Pilih Asset dulu"}
              menuPortalTarget={document.body}
              menuPosition="fixed"
              styles={{
                control: (base, state) => ({
                  ...base,
                  minHeight: '42px',
                  borderRadius: '0.75rem',
                  borderColor: state.isFocused ? '#286086' : '#e2e8f0',
                  boxShadow: state.isFocused ? '0 0 0 1px #286086' : 'none',
                  '&:hover': { borderColor: state.isFocused ? '#286086' : '#cbd5e1' },
                  fontSize: '0.875rem',
                  fontWeight: '700'
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isSelected ? '#286086' : state.isFocused ? '#f1f5f9' : 'white',
                  color: state.isSelected ? 'white' : '#334155',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: '10px 16px'
                }),
                menuPortal: base => ({ ...base, zIndex: 99999 })
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">{t('department')}</label>
              <Select
                value={newTicket.department ? { value: newTicket.department, label: newTicket.department } : null}
                onChange={selected => setNewTicket({...newTicket, department: selected ? selected.value : ''})}
                options={departments.map(d => ({ value: d.name, label: d.name }))}
                isClearable
                placeholder={t('selectDept')}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                styles={{
                  control: (base, state) => ({
                    ...base,
                    minHeight: '42px',
                    borderRadius: '0.75rem',
                    borderColor: state.isFocused ? '#286086' : '#e2e8f0',
                    boxShadow: state.isFocused ? '0 0 0 1px #286086' : 'none',
                    '&:hover': { borderColor: state.isFocused ? '#286086' : '#cbd5e1' },
                    fontSize: '0.875rem',
                    fontWeight: '700'
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected ? '#286086' : state.isFocused ? '#f1f5f9' : 'white',
                    color: state.isSelected ? 'white' : '#334155',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    padding: '10px 16px'
                  }),
                  menuPortal: base => ({ ...base, zIndex: 99999 })
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">{t('vendorName')} <span className="text-slate-400 font-normal normal-case">({t('optional')})</span></label>
              <Select
                value={newTicket.vendor_name ? { value: newTicket.vendor_name, label: newTicket.vendor_name } : null}
                onChange={selected => setNewTicket({...newTicket, vendor_name: selected ? selected.value : ''})}
                options={vendors.map(v => ({ value: v.name, label: v.name }))}
                isClearable
                placeholder={t('selectVendor')}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                styles={{
                  control: (base, state) => ({
                    ...base,
                    minHeight: '42px',
                    borderRadius: '0.75rem',
                    borderColor: state.isFocused ? '#286086' : '#e2e8f0',
                    boxShadow: state.isFocused ? '0 0 0 1px #286086' : 'none',
                    '&:hover': { borderColor: state.isFocused ? '#286086' : '#cbd5e1' },
                    fontSize: '0.875rem',
                    fontWeight: '700'
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected ? '#286086' : state.isFocused ? '#f1f5f9' : 'white',
                    color: state.isSelected ? 'white' : '#334155',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    padding: '10px 16px'
                  }),
                  menuPortal: base => ({ ...base, zIndex: 99999 })
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">{t('photoAttachment')} <span className="text-slate-400 font-normal normal-case">({t('optional')})</span></label>
            <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])} className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#286086]/10 file:text-[#286086] hover:file:bg-[#286086]/20 transition-all cursor-pointer bg-white" />
          </div>
        </form>
      </BaseModal>
    </div>
  );
}
