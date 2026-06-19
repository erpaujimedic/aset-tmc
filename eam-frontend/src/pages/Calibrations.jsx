import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import api from '../services/api';
import useI18nStore from '../store/i18nStore';
import useAuthStore from '../store/authStore';
import BaseModal from '../components/ui/BaseModal';
import ShimmerLoader from '../components/ui/ShimmerLoader';
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/light.css";

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

export default function Calibrations() {
  const { t } = useI18nStore();
  const { user, hasPermission } = useAuthStore();
  const navigate = useNavigate();

  const canCreate = hasPermission('Calibration Schedules', 'Create');
  const canEdit = hasPermission('Calibration Schedules', 'Edit');
  const canDelete = hasPermission('Calibration Schedules', 'Delete');

  const [calibrations, setCalibrations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRegion, setFilterRegion] = useState('All Regions');
  const [filterBranch, setFilterBranch] = useState('All Branches');
  const [filterStatus, setFilterStatus] = useState('All');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [regionSearch, setRegionSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [branches, setBranches] = useState([]);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  const [form, setForm] = useState({
    id: '',
    asset_id: '',
    last_calibration_date: '',
    next_calibration_date: '',
    calibration_vendor: '',
    status: 'Valid',
    certificate_url: '',
    notes: ''
  });

  const location = useLocation();

  useEffect(() => {
    fetchData();
    fetchBranches();
  }, [filterBranch, filterStatus]);

  useEffect(() => {
    if (location.state?.createForAsset && assets.length > 0) {
      const asset = location.state.createForAsset;
      openAddModal();
      setForm(prev => ({ ...prev, asset_id: asset.id }));
      window.history.replaceState({}, document.title);
    }
  }, [location.state, assets]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';
      const isAdminSystem = ['Master Admin', 'Admin System'].includes(user?.role);
      const apiBranchParam = (isAdminSystem || isAllBranch) ? null : (Array.isArray(user?.branch) ? user.branch.join(',') : user?.branch);

      const calUrl = apiBranchParam ? `/calibrations?branch=${encodeURIComponent(apiBranchParam)}` : '/calibrations';
      const assetsUrl = apiBranchParam ? `/assets?branch=${encodeURIComponent(apiBranchParam)}` : '/assets';

      const [calRes, assetsRes] = await Promise.all([
        api.get(calUrl),
        api.get(assetsUrl)
      ]);
      setCalibrations(calRes.data.data);
      setAssets(assetsRes.data.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleUploadFile = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    
    // Pass metadata for Google Drive
    formData.append('module', 'kalibrasi');
    formData.append('asset_code', form.asset_id || '');
    
    const selectedAsset = assets.find(a => a.id === form.asset_id);
    if (selectedAsset) {
        formData.append('asset_name', selectedAsset.name || '');
        formData.append('branch', selectedAsset.branch || '');
    }

    Swal.fire({
      title: 'Uploading to Google Drive...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const res = await api.post('/tickets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const returnedUrl = res.data.url;
      const fullUrl = returnedUrl.startsWith('http') ? returnedUrl : `${api.defaults.baseURL ? api.defaults.baseURL.replace(/\/api$/, '') : 'http://127.0.0.1:8000'}${returnedUrl}`;
      
      setForm(prev => ({ ...prev, [fieldName]: fullUrl }));
      Swal.close();
    } catch (error) {
      console.error("Upload failed", error);
      Swal.fire('Upload Failed', 'Failed to upload file', 'error');
    }
    e.target.value = '';
  };

  const openAddModal = () => {
    setForm({
      id: '',
      asset_id: '',
      last_calibration_date: '',
      next_calibration_date: '',
      calibration_vendor: '',
      status: 'Valid',
      certificate_url: '',
      notes: ''
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (cal) => {
    setForm({
      id: cal.id,
      asset_id: cal.asset_id,
      last_calibration_date: cal.last_calibration_date,
      next_calibration_date: cal.next_calibration_date,
      calibration_vendor: cal.calibration_vendor,
      status: cal.status,
      certificate_url: cal.certificate_url || '',
      notes: cal.notes || ''
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await api.put(`/calibrations/${form.id}`, form);
        Swal.fire({ icon: 'success', title: 'Success', text: 'Calibration updated.', timer: 1500 });
      } else {
        const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';
        const isAdminSystem = ['Master Admin', 'Admin System'].includes(user?.role);
        const apiBranchParam = (isAdminSystem || isAllBranch) ? '' : (Array.isArray(user?.branch) ? user.branch.join(',') : user?.branch);
        const postUrl = apiBranchParam ? `/calibrations?branch=${encodeURIComponent(apiBranchParam)}` : '/calibrations';
        await api.post(postUrl, form);
        Swal.fire({ icon: 'success', title: 'Success', text: 'Calibration schedule added.', timer: 1500 });
      }
      setIsModalOpen(false);
      fetchData();
    } catch(err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.detail || 'Failed to save calibration' });
    }
  };

  const handleDelete = async (id) => {
    const res = await Swal.fire({
      title: 'Delete Schedule?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EC363A',
      confirmButtonText: 'Yes, delete it!'
    });
    if (res.isConfirmed) {
      try {
        await api.delete(`/calibrations/${id}`);
        fetchData();
        Swal.fire('Deleted!', 'Schedule deleted.', 'success');
      } catch(err) {
        Swal.fire('Error', 'Failed to delete.', 'error');
      }
    }
  };

  // Filter & Pagination Logic
  const filteredCals = calibrations.filter(cal => {
    const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';
    if (!['Master Admin', 'Admin System'].includes(user?.role) && !isAllBranch) {
      if (Array.isArray(user?.branch)) {
        if (!user.branch.includes(cal.assets?.branch)) return false;
      } else if (cal.assets?.branch !== user?.branch) {
        return false;
      }
    }

    const s = searchTerm ? searchTerm.toLowerCase() : '';
    const aName = cal.assets?.name ? cal.assets.name.toLowerCase() : '';
    const aId = cal.asset_id ? String(cal.asset_id).toLowerCase() : '';
    const vName = cal.calibration_vendor ? cal.calibration_vendor.toLowerCase() : '';
    
    const matchSearch = aName.includes(s) || aId.includes(s) || vName.includes(s);
    const matchStatus = filterStatus === 'All' ? true : cal.status === filterStatus;
    
    let matchRegion = true;
    let matchBranch = true;
    
    if (filterRegion !== 'All Regions' || filterBranch !== 'All Branches') {
      const assetBranch = cal.assets?.branch;
      if (assetBranch) {
        const branchInfo = branches.find(b => b.name === assetBranch || b.branch_code === assetBranch);
        if (filterRegion !== 'All Regions' && (!branchInfo || branchInfo.region !== filterRegion)) matchRegion = false;
        if (filterBranch !== 'All Branches' && assetBranch !== filterBranch) matchBranch = false;
      } else {
        if (filterRegion !== 'All Regions') matchRegion = false;
        if (filterBranch !== 'All Branches') matchBranch = false;
      }
    }
    
    return matchSearch && matchStatus && matchRegion && matchBranch;
  });

  const regions = [...new Set(branches.map(b => b.region).filter(Boolean))];
  const availableBranches = filterRegion === 'All Regions' ? branches : branches.filter(b => b.region === filterRegion);

  const totalPages = Math.ceil(filteredCals.length / itemsPerPage);
  const paginatedCals = filteredCals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getAlertStatus = () => {
    const relevantCals = !['Master Admin', 'Admin System'].includes(user?.role) ? calibrations.filter(c => c.assets?.branch === user?.branch) : calibrations;
    const expired = relevantCals.filter(c => c.status === 'Expired');
    const soon = relevantCals.filter(c => c.status === 'Valid' && new Date(c.next_calibration_date) < new Date(Date.now() + 30*24*60*60*1000));
    return { expired, soon };
  };
  const alerts = getAlertStatus();

  return (
    <div className="absolute inset-0 flex flex-col p-4 sm:p-6 lg:p-8 animate-[fadeIn_0.4s_ease-out]">
      
      {/* ALERTS SECTION */}
      {(alerts.expired.length > 0 || alerts.soon.length > 0) && (
        <div className="mb-4 flex flex-col sm:flex-row gap-4 shrink-0 z-20">
          {alerts.expired.length > 0 && (
             <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl flex-1 flex items-center gap-3 shadow-sm">
               <div className="w-10 h-10 rounded-full bg-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
               </div>
               <div>
                 <h4 className="text-sm font-black text-rose-800 uppercase tracking-widest">{alerts.expired.length} Expired Calibrations</h4>
                 <p className="text-[10px] text-rose-600 font-bold mt-0.5">Please update immediately to maintain compliance.</p>
               </div>
             </div>
          )}
          {alerts.soon.length > 0 && (
             <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex-1 flex items-center gap-3 shadow-sm">
               <div className="w-10 h-10 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               </div>
               <div>
                 <h4 className="text-sm font-black text-amber-800 uppercase tracking-widest">{alerts.soon.length} Upcoming Deadlines</h4>
                 <p className="text-[10px] text-amber-600 font-bold mt-0.5">Due for calibration in less than 30 days.</p>
               </div>
             </div>
          )}
        </div>
      )}

      {/* FILTER BAR */}
      <div className="flex flex-col gap-4 mb-6 shrink-0 z-20">
        
        {/* 1st Row: Main Actions & Search */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center w-full gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm relative z-50">
          <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto custom-scrollbar pb-1 xl:pb-0 shrink-0">
            <button 
              onClick={() => fetchData()} 
              title={t('refreshData') || 'Refresh Data'}
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

            {/* View Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner ml-2">
              <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 shrink-0 rounded-lg font-bold text-xs transition-colors flex items-center gap-1 ${viewMode === 'list' ? 'bg-white text-[#286086] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                List
              </button>
              <button onClick={() => setViewMode('calendar')} className={`px-4 py-1.5 shrink-0 rounded-lg font-bold text-xs transition-colors flex items-center gap-1 ${viewMode === 'calendar' ? 'bg-white text-[#286086] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Calendar
              </button>
            </div>

            {/* KPI Pills */}
            <div className="hidden sm:flex items-center gap-2 px-3 border-l border-slate-200/60 h-8 ml-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{t('total') || 'Total'}</span>
                <span className="text-[10px] font-extrabold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-100">{filteredCals.length}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
                <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider">Expired</span>
                <span className="text-[10px] font-extrabold text-rose-700 bg-white px-1.5 py-0.5 rounded border border-rose-50">{alerts.expired.length}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full xl:w-auto shrink-0 justify-between xl:justify-end">
            <div className="relative flex-1 xl:w-64 min-w-[150px] shrink-0 bg-slate-50 p-1 rounded-xl border border-slate-100 shadow-inner flex items-center h-10">
              <svg className="w-4 h-4 absolute left-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input 
                type="text" 
                placeholder="Search calibration..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full pl-9 pr-3 py-1 bg-transparent border-none outline-none text-xs font-bold text-slate-700 h-full"
              />
            </div>
            
            {canCreate && (
              <button 
                onClick={openAddModal} 
                className="bg-[#286086] hover:bg-[#1a4666] text-white px-4 h-10 rounded-xl font-bold text-[11px] shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
              >
                <span className="text-sm leading-none">+</span> Add Schedule
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
                  <span className="truncate max-w-[120px]">{filterRegion === 'All Regions' ? t('allRegions') || 'All Regions' : filterRegion}</span>
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
                        onClick={() => { setFilterRegion('All Regions'); setFilterBranch('All Branches'); setOpenDropdown(null); setRegionSearch(''); setCurrentPage(1); }}
                        className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterRegion === 'All Regions' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {t('allRegions') || 'All Regions'}
                      </div>
                      {regions.filter(r => r.toLowerCase().includes(regionSearch.toLowerCase())).map(r => (
                        <div 
                          key={r}
                          onClick={() => { setFilterRegion(r); setFilterBranch('All Branches'); setOpenDropdown(null); setRegionSearch(''); setCurrentPage(1); }}
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
                  <span className="truncate max-w-[120px]">{filterBranch === 'All Branches' ? t('allBranches') || 'All Branches' : filterBranch}</span>
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
                        onClick={() => { setFilterBranch('All Branches'); setOpenDropdown(null); setBranchSearch(''); setCurrentPage(1); }}
                        className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterBranch === 'All Branches' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
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

              {/* Status Dropdown */}
              <div className="relative h-9 bg-slate-50 border border-slate-100 rounded-xl px-3 flex items-center shrink-0">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                  className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold outline-none cursor-pointer flex items-center gap-1.5 transition-colors relative z-50"
                >
                  <span className="truncate max-w-[100px]">{filterStatus === 'All' || filterStatus === 'All Status' ? t('allStatus') || 'All Status' : filterStatus}</span>
                  <svg className={`w-3 h-3 transition-transform ${openDropdown === 'status' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'status' && (
                  <div className="absolute top-full left-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-[fadeIn_0.1s_ease-out]">
                    <div className="py-1">
                      <div onClick={() => { setFilterStatus('All'); setOpenDropdown(null); setCurrentPage(1); }} className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterStatus === 'All' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}>{t('allStatus') || 'All Status'}</div>
                      {['Valid', 'Expired', 'In Progress'].map(st => (
                        <div key={st} onClick={() => { setFilterStatus(st); setOpenDropdown(null); setCurrentPage(1); }} className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterStatus === st ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}>{st}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {(filterRegion !== 'All Regions' || filterBranch !== 'All Branches' || filterStatus !== 'All' || searchTerm !== '') && (
                <button 
                  onClick={() => {
                    setFilterRegion('All Regions');
                    setFilterBranch('All Branches');
                    setFilterStatus('All');
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  title="Reset Filters"
                  className="bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 px-3 py-1.5 h-9 rounded-xl flex items-center justify-center shadow-sm transition-all font-bold text-[11px] gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Reset
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {viewMode === 'calendar' ? (
        <div className="flex-1 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative z-10 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto custom-scrollbar h-full fc-custom-theme">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
              }}
              events={filteredCals.map(cal => ({
                id: cal.id,
                title: cal.assets?.name || 'Calibration',
                date: cal.next_calibration_date,
                backgroundColor: new Date(cal.next_calibration_date) < new Date() ? '#ef4444' : '#10b981',
                borderColor: 'transparent',
                extendedProps: { cal }
              }))}
              eventClick={(info) => {
                if(canEdit) openEditModal(info.event.extendedProps.cal);
              }}
              height="100%"
            />
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            .fc-custom-theme .fc-toolbar-title { font-size: 1.25rem !important; font-weight: 800; color: #1e293b; }
            .fc-custom-theme .fc-button-primary { background-color: #286086 !important; border-color: #286086 !important; font-weight: bold; }
            .fc-custom-theme .fc-button-primary:hover { background-color: #1a4666 !important; border-color: #1a4666 !important; }
            .fc-custom-theme .fc-button-active { background-color: #1a4666 !important; border-color: #1a4666 !important; }
            .fc-custom-theme .fc-event { cursor: pointer; border-radius: 4px; padding: 2px 4px; font-size: 10px; font-weight: bold; }
          `}} />
        </div>
      ) : (
      <div className="flex-1 bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden flex flex-col relative z-10">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">Asset Info</th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">Dates</th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">Vendor</th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-0">
                    <ShimmerLoader rowCount={5} columnCount={5} />
                  </td>
                </tr>
              ) : paginatedCals.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-14 h-14 bg-slate-50 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center text-slate-400 mb-1">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      </div>
                      <div className="text-sm font-bold text-slate-500">{t('noCalibrationData') || 'Tidak ada data kalibrasi.'}</div>
                    </div>
                  </td>
                </tr>
              ) : paginatedCals.map(cal => (
                <tr key={cal.id} className="hover:bg-slate-50/50 transition-colors group relative">
                  <td className="px-6 py-4 align-top">
                    <div className="font-bold text-sm text-slate-800 line-clamp-2 leading-snug group-hover:text-[#286086] transition-colors">{cal.assets?.name || 'Unknown'}</div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">{cal.asset_id}</div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="text-xs font-bold text-slate-600"><span className="text-slate-400 font-normal">Last:</span> {formatDate(cal.last_calibration_date)}</div>
                    <div className="text-[10px] font-bold mt-1"><span className="text-slate-400 font-normal">Next:</span> <span className={new Date(cal.next_calibration_date) < new Date() ? 'text-rose-600' : 'text-emerald-600'}>{formatDate(cal.next_calibration_date)}</span></div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="text-xs font-bold text-slate-700">{cal.calibration_vendor}</div>
                    {cal.certificate_url && (
                      <a href={cal.certificate_url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-500 hover:text-blue-700 mt-1 inline-flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        Sertifikat
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    {(() => {
                      const nextCalDate = new Date(cal.next_calibration_date);
                      const now = new Date();
                      const isExpired = nextCalDate < now;
                      const displayStatus = isExpired ? 'Expired' : cal.status;
                      
                      return (
                        <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest border inline-block shadow-sm ${
                          displayStatus === 'Valid' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                          displayStatus === 'Expired' ? 'bg-rose-50 text-rose-600 border-rose-200' : 
                          'bg-amber-50 text-amber-600 border-amber-200'
                        }`}>
                          {displayStatus}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 align-top text-right whitespace-nowrap">
                    <div className="flex items-center justify-end">
                      {(() => {
                        const nextCalDate = new Date(cal.next_calibration_date);
                        const isExpired = nextCalDate < new Date();
                        if (isExpired) {
                          return (
                            <button onClick={() => navigate('/ticketing')} className="mr-2 text-[9px] font-black bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white px-2 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1" title="Request Calibration Ticket">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                              Request
                            </button>
                          );
                        }
                        return null;
                      })()}
                      {canEdit && (
                        <button onClick={() => openEditModal(cal)} className="text-amber-500 hover:text-amber-600 p-1.5 mx-0.5 rounded-lg hover:bg-amber-50 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(cal.id)} className="text-rose-500 hover:text-rose-600 p-1.5 mx-0.5 rounded-lg hover:bg-rose-50 transition-colors" title="Hapus">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Details */}
        {totalPages > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center shrink-0">
            <span className="text-xs font-bold text-slate-500">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredCals.length)} of {filteredCals.length} entries
            </span>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center ${
                    currentPage === page ? 'bg-[#286086] text-white' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Detail/Add Modal */}
      <BaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="max-w-4xl"
        title={isEditing ? 'Edit Calibration Schedule' : 'Add Calibration Schedule'}
        footer={
          <>
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors">Batal</button>
            <button type="submit" form="calForm" className="px-6 py-2.5 text-sm font-bold bg-[#286086] text-white rounded-xl shadow-md hover:bg-[#1a4666] transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              {isEditing ? 'Simpan Perubahan' : 'Buat Kalibrasi'}
            </button>
          </>
        }
      >
        <form id="calForm" onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="text-sm font-black text-[#286086] border-b pb-2 mb-4">Informasi Utama</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Asset *</label>
                <select required disabled={isEditing} value={form.asset_id} onChange={e => setForm({...form, asset_id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none cursor-pointer disabled:opacity-50">
                  <option value="" disabled>Select Asset</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Last Calibration Date *</label>
                <Flatpickr 
                  value={form.last_calibration_date} 
                  onChange={([date]) => setForm({...form, last_calibration_date: date ? date.toLocaleDateString('en-CA') : ''})} 
                  options={{ dateFormat: "Y-m-d" }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none placeholder-slate-400" 
                  placeholder="Select Date"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Next Calibration Date *</label>
                <Flatpickr 
                  value={form.next_calibration_date} 
                  onChange={([date]) => setForm({...form, next_calibration_date: date ? date.toLocaleDateString('en-CA') : ''})} 
                  options={{ dateFormat: "Y-m-d" }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none placeholder-slate-400" 
                  placeholder="Select Date"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Vendor *</label>
                <input required type="text" value={form.calibration_vendor} onChange={e => setForm({...form, calibration_vendor: e.target.value})} placeholder="e.g. PT. Global Calibration" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Status *</label>
                <select required value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none cursor-pointer">
                  <option value="Valid">Valid</option>
                  <option value="Expired">Expired</option>
                  <option value="In Progress">In Progress</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black text-[#286086] border-b pb-2 mb-4">Dokumen & Catatan (Opsional)</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Sertifikat Kalibrasi / Bukti</label>
                <div className="flex gap-2">
                  <input type="url" value={form.certificate_url || ''} onChange={e => setForm({...form, certificate_url: e.target.value})} placeholder="https://..." className="flex-1 w-0 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
                  <label className="bg-white border border-slate-200 hover:border-[#286086] hover:text-[#286086] text-slate-500 px-3 py-2 rounded-lg cursor-pointer transition-all shrink-0 shadow-sm flex items-center justify-center gap-1.5" title="Upload Dokumen">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span className="text-xs font-bold hidden sm:inline">Upload</span>
                    <input type="file" accept="*/*" className="hidden" onChange={e => handleUploadFile(e, 'certificate_url')} />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Catatan / Keterangan</label>
                <textarea rows="3" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Tambahkan catatan khusus..." className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none"></textarea>
              </div>
            </div>
          </div>
        </form>
      </BaseModal>

    </div>
  );
}
