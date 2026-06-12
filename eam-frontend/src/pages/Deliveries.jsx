import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import api from '../services/api';
import Swal from 'sweetalert2';
import useI18nStore from '../store/i18nStore';
import useAuthStore from '../store/authStore';
import BaseModal from '../components/ui/BaseModal';
import useSWR from 'swr';
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/light.css";

export default function AssetMovements() {
  const { t } = useI18nStore();
  const { user, hasPermission } = useAuthStore();
  
  const canCreate = hasPermission('Deliveries & Tracking', 'Create');
  const canReceive = hasPermission('Deliveries & Tracking', 'Receive');
  const canExport = hasPermission('Deliveries & Tracking', 'Export');
  
  const fetcher = url => api.get(url).then(res => res.data.data || []);
  const branchFetcher = url => api.get(url).then(res => res.data.branches || []);
  
  const { data: mapBranches = [] } = useSWR('/master/setup-data', branchFetcher, { revalidateOnFocus: false });
  const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';
  const isAdminSystem = ['Master Admin', 'Admin System'].includes(user?.role);
  const apiBranchParam = (isAdminSystem || isAllBranch) ? null : (Array.isArray(user?.branch) ? user.branch.join(',') : user?.branch);

  const movEndpoint = apiBranchParam ? `/movements?branch=${encodeURIComponent(apiBranchParam)}` : '/movements';
  const { data: movements = [], mutate: mutateMovements, isValidating: isMovementsLoading } = useSWR(movEndpoint, fetcher, { revalidateOnFocus: false });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMovement, setSelectedMovement] = useState(null);
  
  // Advanced filters
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterRegion, setFilterRegion] = useState('All Regions');
  const [filterBranch, setFilterBranch] = useState('All Branches');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [regionSearch, setRegionSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [fromBranchSearch, setFromBranchSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);

  // Forms state
  const [isBorrowingMode, setIsBorrowingMode] = useState(false);
  const [assetSearchTerm, setAssetSearchTerm] = useState('');

  const [dispatchForm, setDispatchForm] = useState({
    tracking_code: `TRX-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    asset_ids: [],
    purpose: 'Operational',
    purpose_detail: '',
    from_location: 'Head Office',
    to_location: '',
    onsite_detail: '',
    sender_name: '',
    expected_return_date: '',
    proof_image: null
  });

  const { data: allAssets = [], mutate: mutateAssets } = useSWR(
    dispatchForm.from_location ? `/assets?branch=${dispatchForm.from_location}` : null, 
    fetcher, 
    { revalidateOnFocus: false }
  );
  
  const assets = allAssets.filter(a => {
    const isStatusValid = a.status === 'Active' || a.status === 'Deployed';
    const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';
    const isBranchValid = (['Master Admin', 'Admin System'].includes(user?.role) || isAllBranch) ? true : (Array.isArray(user?.branch) ? user.branch.includes(a.branch) : a.branch === user?.branch);
    return isStatusValid && isBranchValid;
  });

  const [receiveForm, setReceiveForm] = useState({
    receiver_name: '',
    notes: '',
    proof_image: null
  });



  const location = useLocation();
  useEffect(() => {
    if (location.state?.createForAsset) {
      const asset = location.state.createForAsset;
      const isBorrowing = location.state.isBorrowing || false;
      setIsBorrowingMode(isBorrowing);
      setDispatchForm(prev => ({
        ...prev,
        asset_ids: [asset.id],
        from_location: asset.branch || 'Head Office'
      }));
      setIsDispatchModalOpen(true);
      window.history.replaceState({}, document.title);
    }
    if (location.state?.bulkDispatchAssets) {
      const bulkAssets = location.state.bulkDispatchAssets;
      setDispatchForm(prev => ({
        ...prev,
        asset_ids: bulkAssets.map(a => a.id),
        from_location: bulkAssets[0]?.branch || 'Head Office'
      }));
      setIsDispatchModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);



  // HANDLERS
  const openDetails = async (mov) => {
    try {
      const res = await api.get(`/movements/history/${mov.asset_id}`);
      const fullMov = res.data.data.find(m => m.id === mov.id);
      setSelectedMovement(fullMov || mov);
      setIsDetailModalOpen(true);
    } catch(err) {
      console.error(err);
    }
  };

  const generatePDF = (dispatchData) => {
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="padding: 40px; font-family: Arial, sans-serif;">
        <h1 style="text-align: center; color: #286086;">Delivery Order</h1>
        <hr style="margin-bottom: 20px;" />
        <p><strong>Tracking Code:</strong> ${dispatchData.tracking_code}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Asset ID:</strong> ${dispatchData.asset_id}</p>
        <p><strong>Purpose:</strong> ${dispatchData.purpose} - ${dispatchData.purpose_detail}</p>
        <br/>
        <table style="width: 100%; border-collapse: collapse;" border="1">
          <tr><th style="padding: 10px;">From</th><th style="padding: 10px;">To</th></tr>
          <tr><td style="padding: 10px;">${dispatchData.from_location}</td><td style="padding: 10px;">${dispatchData.to_location}</td></tr>
        </table>
        <br/>
        <p><strong>Sender:</strong> ${dispatchData.sender_name}</p>
        <p><strong>Expected Return:</strong> ${dispatchData.expected_return_date || 'N/A'}</p>
        <br/><br/><br/>
        <div style="display: flex; justify-content: space-between;">
          <div style="text-align: center;">Sender Signature<br/><br/><br/>__________________</div>
          <div style="text-align: center;">Receiver Signature<br/><br/><br/>__________________</div>
        </div>
      </div>
    `;
    const opt = {
      margin: 1,
      filename: `DeliveryOrder_${dispatchData.tracking_code}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    
    // Dual Validation Protection
    if (!dispatchForm.asset_ids || dispatchForm.asset_ids.length === 0) {
      return Swal.fire('Validation Error', 'Pilih minimal 1 aset untuk dikirim!', 'warning');
    }
    if (!dispatchForm.to_location || !dispatchForm.to_location.trim()) {
      return Swal.fire('Validation Error', 'Lokasi tujuan (To Location) wajib diisi!', 'warning');
    }
    if (!dispatchForm.sender_name || !dispatchForm.sender_name.trim()) {
      return Swal.fire('Validation Error', 'Nama pengirim wajib diisi!', 'warning');
    }
    if (!dispatchForm.proof_image) return Swal.fire('Error', 'Foto Bukti Pengirim Wajib Diunggah!', 'error');

    const finalToLocation = dispatchForm.purpose === 'Onsite Project' && dispatchForm.onsite_detail 
      ? `${dispatchForm.to_location} - ${dispatchForm.onsite_detail}` 
      : dispatchForm.to_location;

    // Add confirmation if it's permanent mutation
    if (!isBorrowingMode) {
      const confirm = await Swal.fire({
        title: t('confirmPermanentMutation'),
        text: 'Aset ini akan dipindahkan status cabangnya secara permanen. Lanjutkan?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: t('yesPermanentMutation')
      });
      if (!confirm.isConfirmed) return;
    }

    // Optimistic Mutation
    const pendingMovements = dispatchForm.asset_ids.map(id => {
      const asset = assets.find(a => a.id === id);
      return {
        id: `temp-${Date.now()}-${id}`,
        tracking_code: dispatchForm.tracking_code,
        asset_id: id,
        from_location: dispatchForm.from_location,
        to_location: finalToLocation,
        purpose: dispatchForm.purpose,
        status: 'In Transit',
        expected_return_date: dispatchForm.expected_return_date,
        created_at: new Date().toISOString(),
        assets: asset ? { name: asset.name, category: asset.category } : null
      };
    });
    
    // Update local state instantly
    mutateMovements([...pendingMovements, ...movements], false);

    const formData = new FormData();
    Object.keys(dispatchForm).forEach(key => {
      if (key === 'asset_ids') {
        formData.append('asset_ids', JSON.stringify(dispatchForm.asset_ids));
      } else if (key === 'to_location') {
        formData.append('to_location', finalToLocation);
      } else if (key === 'onsite_detail') {
        // Skip appending onsite_detail since it's merged into to_location
      } else if (dispatchForm[key]) {
        formData.append(key, dispatchForm[key]);
      }
    });

    formData.append('sender_role', user?.role || 'User');
    formData.append('movement_type', isBorrowingMode ? 'Borrowing' : 'Mutation');

    Swal.fire({ title: 'Memproses...', text: 'Mengunggah foto ke Google Drive', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      await api.post('/movements/dispatch', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Swal.fire('Sukses!', 'Aset berhasil dikirim.', 'success');
      generatePDF(dispatchForm);
      setIsDispatchModalOpen(false);
      setDispatchForm({...dispatchForm, tracking_code: `TRX-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`, asset_ids: [], proof_image: null, onsite_detail: ''});
      mutateMovements();
      mutateAssets();
    } catch (err) {
      mutateMovements(); // Revert optimistic update on error
      Swal.fire('Error', err.response?.data?.detail || 'Terjadi kesalahan', 'error');
    }
  };

  const handleReceiveSubmit = async (e) => {
    e.preventDefault();
    
    // Dual Validation Protection
    if (!receiveForm.receiver_name || !receiveForm.receiver_name.trim()) {
      return Swal.fire('Validation Error', 'Nama penerima wajib diisi!', 'warning');
    }
    if (!receiveForm.proof_image) return Swal.fire('Error', 'Foto Bukti Penerima Wajib Diunggah!', 'error');

    // Optimistic Mutation
    const updatedMovements = movements.map(m => 
      m.tracking_code === selectedMovement.tracking_code ? { ...m, status: 'Received' } : m
    );
    mutateMovements(updatedMovements, false);

    const formData = new FormData();
    formData.append('tracking_code', selectedMovement.tracking_code);
    formData.append('receiver_name', receiveForm.receiver_name);
    formData.append('notes', receiveForm.notes);
    formData.append('proof_image', receiveForm.proof_image);

    Swal.fire({ title: 'Memproses...', text: 'Mengunggah foto ke Google Drive', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      await api.post('/movements/receive', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Swal.fire('Sukses!', 'Aset berhasil diterima.', 'success');
      setIsReceiveModalOpen(false);
      setIsDetailModalOpen(false);
      setReceiveForm({receiver_name: '', notes: '', proof_image: null});
      mutateMovements();
      mutateAssets();
    } catch (err) {
      mutateMovements(); // Revert optimistic update on error
      Swal.fire('Error', err.response?.data?.detail || 'Terjadi kesalahan', 'error');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Tracking Code', 'Asset Name', 'Asset ID', 'From', 'To', 'Purpose', 'Status', 'Expected Return'];
    const rows = filteredMovements.map(m => [m.tracking_code, m.assets?.name || 'Unknown', m.asset_id, m.from_location, m.to_location, m.purpose, m.status, m.expected_return_date || '-']);
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "asset_movements.csv");
    document.body.appendChild(link);
    link.click();
  };

  const isOverdue = (mov) => {
    if (mov.status !== 'In Transit' || !mov.expected_return_date) return false;
    return new Date() > new Date(mov.expected_return_date);
  };

  const filteredMovements = movements.filter(d => {
    const matchSearch = d.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase()) || d.assets?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'All' || d.status === filterStatus;
    const matchRegion = filterRegion === 'All Regions' || filterRegion === 'All' || (d.from_location || '').includes(filterRegion) || (d.to_location || '').includes(filterRegion) || mapBranches.find(b => b.name === d.from_location)?.region === filterRegion || mapBranches.find(b => b.name === d.to_location)?.region === filterRegion;
    const matchBranch = filterBranch === 'All Branches' || filterBranch === 'All' || d.from_location === filterBranch || d.to_location === filterBranch;
    
    let matchDate = true;
    if (dateRange.start && dateRange.end) {
      const movDate = new Date(d.created_at);
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59); // Include entire end day
      matchDate = movDate >= start && movDate <= end;
    }
    
    return matchSearch && matchStatus && matchDate && matchRegion && matchBranch;
  });

  const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);
  const paginatedMovements = filteredMovements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page to 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, dateRange, filterRegion, filterBranch]);

  const renderPagination = (currentPage, totalPages, setCurrentPage) => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage > totalPages - 3) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }

    return pages.map((p, idx) => (
      <button
        key={idx}
        onClick={() => typeof p === 'number' && setCurrentPage(p)}
        disabled={p === '...'}
        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
          p === currentPage
            ? 'bg-[#286086] text-white shadow-md'
            : p === '...'
            ? 'text-slate-400 cursor-default bg-transparent px-1'
            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {p}
      </button>
    ));
  };

  return (
    <div className="h-full flex flex-col animate-[fadeIn_0.4s_ease-out] space-y-4">
      {/* Unified Action and Filter Bar */}
      <div className="flex flex-col 2xl:flex-row justify-between items-start 2xl:items-center w-full gap-4 mb-6 shrink-0 z-20">
        
        {/* LEFT/CENTER: Filter Pill */}
        <div className="flex items-center flex-1 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm relative z-50 min-w-0 w-full 2xl:w-auto">
          <div className="flex items-center w-full gap-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
            
            {/* STATUS TABS */}
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 shadow-inner h-9 shrink-0">
              {['All', 'In Transit', 'Received', 'Completed'].map(status => (
                <button key={status} onClick={() => setFilterStatus(status)} className={`px-4 h-full rounded-lg text-xs font-bold transition-all ${filterStatus === status ? 'bg-white text-[#286086] shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                  {status}
                </button>
              ))}
            </div>

            <div className="hidden sm:block w-px h-5 bg-slate-200 shrink-0 mx-1"></div>

            {/* DATE FILTER */}
            <div className="flex items-center gap-1.5 shrink-0 px-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <Flatpickr 
                value={dateRange.start} 
                onChange={([date]) => setDateRange({...dateRange, start: date ? date.toLocaleDateString('en-CA') : ''})} 
                options={{ dateFormat: "Y-m-d" }}
                className="bg-transparent border-none px-1 text-xs outline-none text-slate-600 font-bold cursor-pointer w-24 placeholder-slate-400" 
                placeholder="Start Date"
              />
              <span className="text-xs text-slate-300 font-black">-</span>
              <Flatpickr 
                value={dateRange.end} 
                onChange={([date]) => setDateRange({...dateRange, end: date ? date.toLocaleDateString('en-CA') : ''})} 
                options={{ dateFormat: "Y-m-d" }}
                className="bg-transparent border-none px-1 text-xs outline-none text-slate-600 font-bold cursor-pointer w-24 placeholder-slate-400" 
                placeholder="End Date"
              />
              {(dateRange.start || dateRange.end) && (
                <button onClick={() => setDateRange({start: '', end: ''})} className="w-5 h-5 rounded-md bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-colors ml-1" title="Clear Dates">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            <div className="hidden sm:block w-px h-5 bg-slate-200 shrink-0 mx-1"></div>

            {/* REGION AND BRANCH FILTERS */}
            <div className="flex items-center shrink-0">
              <svg className="w-4 h-4 text-[#286086] ml-2 mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              
              {openDropdown && (
                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)}></div>
              )}
              
              {/* Region Dropdown */}
              <div className="relative h-8 flex items-center shrink-0">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === 'region' ? null : 'region')}
                  className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold px-2 outline-none cursor-pointer flex items-center gap-1.5 transition-colors relative z-50"
                >
                  <span className="truncate max-w-[100px]">{filterRegion === 'All Regions' || filterRegion === 'All' ? t('allRegions') || 'All Regions' : filterRegion}</span>
                  <svg className={`w-3 h-3 transition-transform ${openDropdown === 'region' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'region' && (
                  <div className="absolute top-full left-0 mt-3 w-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-[fadeIn_0.2s_ease-out] flex flex-col">
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
                        onClick={() => { setFilterRegion('All Regions'); setFilterBranch('All Branches'); setOpenDropdown(null); setRegionSearch(''); }}
                        className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterRegion === 'All Regions' || filterRegion === 'All' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {t('allRegions') || 'All Regions'}
                      </div>
                      {['Region 1', 'Region 2', 'Region 3', 'Region 4'].filter(r => r.toLowerCase().includes(regionSearch.toLowerCase())).map(r => (
                        <div 
                          key={r}
                          onClick={() => { setFilterRegion(r); setFilterBranch('All Branches'); setOpenDropdown(null); setRegionSearch(''); }}
                          className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterRegion === r ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="w-px h-4 bg-slate-200 shrink-0 mx-1"></div>
              
              {/* Branch Dropdown */}
              <div className="relative h-8 flex items-center shrink-0">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === 'branch' ? null : 'branch')}
                  className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold px-3 outline-none cursor-pointer flex items-center gap-2 transition-colors relative z-50"
                >
                  <span className="truncate max-w-[150px]">{filterBranch === 'All Branches' || filterBranch === 'All' ? t('allBranches') || 'All Branches' : filterBranch}</span>
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
                        className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterBranch === 'All Branches' || filterBranch === 'All' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {t('allBranches') || 'All Branches'}
                      </div>
                      {mapBranches.filter(b => filterRegion === 'All Regions' || filterRegion === 'All' || b.region === filterRegion).filter(b => b.name.toLowerCase().includes(branchSearch.toLowerCase())).map(b => (
                        <div 
                          key={b.name}
                          onClick={() => { setFilterBranch(b.name); setOpenDropdown(null); setBranchSearch(''); }}
                          className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors truncate ${filterBranch === b.name ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                          title={b.name}
                        >
                          {b.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden sm:block w-px h-5 bg-slate-200 shrink-0 mx-1"></div>

            {/* SEARCH BAR */}
            <div className="flex-1 min-w-[120px] bg-slate-50 rounded-xl px-3 h-8 flex items-center border border-slate-100 group focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500/30 transition-all relative">
              <svg className="w-4 h-4 text-slate-400 group-focus-within:text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input 
                type="text" 
                placeholder={t('searchTracking') || 'Search ID...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent border-none outline-none pl-2 text-xs text-slate-700 placeholder-slate-400 font-bold min-w-[100px]" 
              />
            </div>

          </div>
        </div>

        {/* RIGHT: ACTIONS */}
        <div className="flex items-center justify-center gap-2 shrink-0 w-full xl:w-auto">
          <button 
            onClick={() => mutateMovements()} 
            title={t('refreshData') || 'Refresh Data'}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-all shrink-0"
          >
            <svg className={`w-4 h-4 ${isMovementsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          {canExport && (
            <button onClick={handleExportCSV} className="bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-emerald-600 px-3 h-9 rounded-xl font-bold text-[11px] shadow-sm transition-all flex items-center gap-1.5 group">
              <svg className="w-3 h-3 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export CSV
            </button>
          )}
          {canCreate && (
            <div className="flex items-center gap-2">
              <button onClick={() => { setIsBorrowingMode(false); setIsDispatchModalOpen(true); }} className="bg-rose-500 hover:bg-rose-600 text-white px-3 h-9 rounded-xl font-bold text-[11px] shadow-lg shadow-rose-900/20 transition-all flex items-center gap-1.5">
                <span className="text-sm leading-none">+</span> {t('permanentMutation')}
              </button>
              <button onClick={() => { setIsBorrowingMode(true); setIsDispatchModalOpen(true); }} className="bg-[#286086] hover:bg-[#1a4666] text-white px-3 h-9 rounded-xl font-bold text-[11px] shadow-lg shadow-blue-900/20 transition-all flex items-center gap-1.5">
                <span className="text-sm leading-none">+</span> {t('loanAsset')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10">
              <tr className="text-slate-500 text-[11px] uppercase tracking-wider font-extrabold">
                <th className="p-4 border-b border-slate-100 whitespace-nowrap">{t('trackingCode')}</th>
                <th className="p-4 border-b border-slate-100 whitespace-nowrap">{t('assetInfo')}</th>
                <th className="p-4 border-b border-slate-100 whitespace-nowrap">{t('route')}</th>
                <th className="p-4 border-b border-slate-100 whitespace-nowrap">{t('purpose')}</th>
                <th className="p-4 border-b border-slate-100 whitespace-nowrap">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {paginatedMovements.map(item => (
                <tr key={item.id} onClick={() => openDetails(item)} className={`hover:bg-blue-50/40 transition-colors border-b border-slate-50 last:border-0 cursor-pointer group ${isOverdue(item) ? 'bg-rose-50/30' : 'bg-white/40'}`}>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${item.movement_type === 'Borrowing' ? 'bg-amber-50 text-amber-500 border-amber-200 group-hover:bg-amber-100' : 'bg-purple-50 text-purple-500 border-purple-200 group-hover:bg-purple-100'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h4v16H3V4zm6 0h2v16H9V4zm4 0h2v16h-2V4zm4 0h4v16h-4V4z"/></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-[#286086] tracking-wide text-[13px]">{item.tracking_code}</span>
                        <div className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider flex items-center gap-1">
                          <span className={`px-1.5 rounded ${item.movement_type === 'Borrowing' ? 'bg-amber-100 text-amber-600' : 'bg-purple-100 text-purple-600'}`}>{item.movement_type === 'Borrowing' ? t('borrowingStatus') : t('permanentStatus')}</span>
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    {isOverdue(item) && <span className="mt-2 inline-block px-2 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-black uppercase rounded-md tracking-wider">OVERDUE</span>}
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-800 text-[13px]">{item.assets?.name || 'Unknown'}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5 font-mono bg-slate-100 px-1.5 py-0.5 rounded inline-block">ID: {item.asset_id}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-[12px]">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-slate-700">{item.from_location}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Origin</span>
                      </div>
                      <div className="flex flex-col items-center px-2">
                        <svg className="w-4 h-4 text-emerald-500 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                        <div className="w-8 h-[1px] bg-slate-300"></div>
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-slate-700">{item.to_location}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Destination</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-700 text-[13px]">{item.purpose}</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5 truncate max-w-[150px]">{item.purpose_detail || '-'}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border ${
                      item.status === 'In Transit' ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' :
                      item.status === 'Received' || item.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
              {paginatedMovements.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-14 h-14 bg-slate-50 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center text-slate-400 mb-1">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      </div>
                      <div className="text-sm font-bold text-slate-500">{t('noActiveMovements') || 'No active movements found'}</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-white/50">
            <span className="text-xs font-semibold text-slate-500">Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredMovements.length)} of {filteredMovements.length} entries</span>
            <div className="flex gap-1.5 items-center">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">Prev</button>
              {renderPagination(currentPage, totalPages, setCurrentPage)}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)} className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {isDetailModalOpen && selectedMovement && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setIsDetailModalOpen(false)}></div>
          <div className="bg-[#f8fafc] w-full max-w-5xl h-[85vh] rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] relative z-10 flex flex-col overflow-hidden animate-[scaleIn_0.3s_cubic-bezier(0.16,1,0.3,1)] border border-slate-200/50">
            {/* Header */}
            <div className="px-8 py-6 bg-white border-b border-slate-200 flex justify-between items-center relative overflow-hidden shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-[#286086] rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    {selectedMovement.tracking_code}
                    <span className={`px-3 py-1 text-[10px] font-black tracking-widest uppercase rounded-full border ${selectedMovement.status === 'In Transit' ? 'bg-blue-50 text-blue-600 border-blue-200' : selectedMovement.status === 'Received' || selectedMovement.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                      {selectedMovement.status}
                    </span>
                  </h2>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{t('lifecycleDetail')} • Created on {new Date(selectedMovement.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="w-10 h-10 bg-white border border-slate-200 hover:bg-rose-50 text-slate-500 hover:text-rose-500 rounded-xl flex items-center justify-center transition-colors shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              
              {/* TOP: VISUAL TIMELINE */}
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm mb-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 relative z-20">Shipment Progress</h3>
                <div className="relative flex justify-between items-center px-4 md:px-12 w-full max-w-3xl mx-auto">
                  <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-1 bg-slate-100 rounded-full"></div>
                  {/* Progress fill */}
                  <div className={`absolute left-10 top-1/2 -translate-y-1/2 h-1 rounded-full transition-all duration-1000 ${selectedMovement.status === 'Completed' || selectedMovement.status === 'Received' ? 'w-[calc(100%-5rem)] bg-emerald-500' : selectedMovement.status === 'In Transit' ? 'w-1/2 bg-blue-500' : 'w-0'}`}></div>
                  
                  {/* Step 1 */}
                  <div className="relative z-10 flex flex-col items-center gap-3 bg-white p-1">
                    <div className="w-10 h-10 rounded-full bg-[#286086] text-white flex items-center justify-center border-4 border-white shadow-md">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </div>
                    <span className="text-[11px] font-bold text-slate-700">Processed</span>
                  </div>
                  
                  {/* Step 2 */}
                  <div className="relative z-10 flex flex-col items-center gap-3 bg-white p-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-md transition-colors ${selectedMovement.status === 'In Transit' || selectedMovement.status === 'Received' || selectedMovement.status === 'Completed' ? 'bg-[#286086] text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    </div>
                    <span className={`text-[11px] font-bold ${selectedMovement.status === 'In Transit' || selectedMovement.status === 'Received' || selectedMovement.status === 'Completed' ? 'text-slate-700' : 'text-slate-400'}`}>Dispatched</span>
                  </div>

                  {/* Step 3 */}
                  <div className="relative z-10 flex flex-col items-center gap-3 bg-white p-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-md transition-colors ${selectedMovement.status === 'Received' || selectedMovement.status === 'Completed' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                    </div>
                    <span className={`text-[11px] font-bold ${selectedMovement.status === 'Received' || selectedMovement.status === 'Completed' ? 'text-slate-700' : 'text-slate-400'}`}>Received</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LEFT: Route & Courier Info */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* ROUTE MOCKUP */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-6 relative z-10">
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Route Details</h3>
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-md">ETA: {selectedMovement.expected_return_date ? new Date(selectedMovement.expected_return_date).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="flex-1 bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Origin</p>
                        <p className="text-sm font-black text-slate-800">{selectedMovement.from_location}</p>
                        <p className="text-xs text-slate-500 font-medium mt-1">Sender: {selectedMovement.sender_name}</p>
                      </div>
                      
                      <div className="w-24 flex flex-col items-center shrink-0">
                        <div className="w-full h-1 bg-gradient-to-r from-slate-200 via-blue-400 to-slate-200 rounded-full relative overflow-hidden">
                           {selectedMovement.status === 'In Transit' && <div className="absolute top-0 left-0 h-full w-1/3 bg-blue-600 animate-[moveRight_2s_linear_infinite]" style={{ animationDuration: '2s', animationIterationCount: 'infinite', animationName: 'slide' }}></div>}
                        </div>
                        <style>{`@keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
                        <div className="w-8 h-8 mt-2 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center border border-blue-100 shadow-sm">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                        </div>
                      </div>

                      <div className="flex-1 bg-slate-50 border border-slate-100 p-4 rounded-2xl text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Destination</p>
                        <p className="text-sm font-black text-slate-800">{selectedMovement.to_location}</p>
                        <p className="text-xs text-slate-500 font-medium mt-1">Receiver: {selectedMovement.receiver_name || 'Pending'}</p>
                      </div>
                    </div>
                  </div>

                  {/* COURIER & ASSET MOCKUP */}
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="flex-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden shrink-0">
                         <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedMovement.sender_name}&backgroundColor=286086`} alt="Courier" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Logistics Courier</h3>
                        <p className="text-sm font-bold text-slate-800">{selectedMovement.sender_name}</p>
                        <p className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded mt-1 inline-block border border-slate-200">B 1234 XYZ • Box Truck</p>
                      </div>
                    </div>
                    
                    <div className="flex-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Package Info</h3>
                      <p className="text-sm font-bold text-slate-800 line-clamp-1">{selectedMovement.assets?.name}</p>
                      <div className="flex justify-between items-center mt-2">
                         <p className="text-[10px] font-bold text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">ID: {selectedMovement.asset_id}</p>
                         <p className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate ml-2 max-w-[100px]">{selectedMovement.purpose}</p>
                      </div>
                    </div>
                  </div>

                  {/* DOCUMENTATION GALLERY */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Proof of Delivery Gallery</h3>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-500 mb-2">Proof of Pickup (Origin)</p>
                        {selectedMovement.sender_proof_url ? (
                          <a href={selectedMovement.sender_proof_url} target="_blank" rel="noreferrer" className="block w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 overflow-hidden group relative">
                            <img src={selectedMovement.sender_proof_url} alt="Pickup Proof" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs shadow-inner">View HD Image</div>
                          </a>
                        ) : <div className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400 font-bold">No Image</div>}
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-500 mb-2">Proof of Receipt (Destination)</p>
                        {selectedMovement.receiver_proof_url ? (
                          <a href={selectedMovement.receiver_proof_url} target="_blank" rel="noreferrer" className="block w-full h-32 rounded-2xl border-2 border-dashed border-emerald-200 hover:border-emerald-400 overflow-hidden group relative">
                            <img src={selectedMovement.receiver_proof_url} alt="Receive Proof" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs shadow-inner">View HD Image</div>
                          </a>
                        ) : <div className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400 font-bold">Pending Delivery</div>}
                      </div>
                    </div>
                  </div>

                </div>

                {/* RIGHT: TRACKING LOGS */}
                <div className="col-span-1 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-full max-h-[600px]">
                  <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {t('trackingLog')}
                  </h3>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 relative">
                    <div className="absolute left-[11px] top-2 bottom-6 w-[2px] bg-slate-100"></div>
                    {selectedMovement.movement_logs?.map((log, idx) => (
                      <div key={idx} className="flex gap-4 mb-6 last:mb-0 relative group">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center relative z-10 shadow-sm border-2 border-white shrink-0 mt-1 ${idx === 0 ? 'bg-[#286086]' : 'bg-slate-300'}`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        </div>
                        <div className="flex-1">
                          <h4 className={`text-[12px] font-extrabold ${idx === 0 ? 'text-[#286086]' : 'text-slate-600'}`}>{log.status_update}</h4>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5 leading-relaxed">{log.description}</p>
                          <p className="text-[9px] font-bold text-slate-400 mt-1">{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Mark Received Button at bottom if in transit */}
                  {selectedMovement.status === 'In Transit' && canReceive && (
                    <div className="pt-4 border-t border-slate-100 mt-4 shrink-0">
                      <button onClick={() => setIsReceiveModalOpen(true)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all text-xs uppercase tracking-widest">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {t('markReceived')}
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* DISPATCH MODAL */}
      <BaseModal 
        isOpen={isDispatchModalOpen} 
        onClose={() => setIsDispatchModalOpen(false)} 
        title={isBorrowingMode ? t('formLoanAsset') : t('formPermanentMutation')} 
        maxWidth="max-w-4xl"
        footer={
          <>
            <button type="button" onClick={() => setIsDispatchModalOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Batal</button>
            <button type="submit" form="dispatchForm" className={`px-6 py-2 text-sm font-bold text-white rounded-xl shadow-md ${isBorrowingMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-500 hover:bg-rose-600'}`}>
              {isBorrowingMode ? t('processLoanAsset') : t('processPermanentMutation')}
            </button>
          </>
        }
      >
        <div className={`text-xs p-3 rounded-lg border mb-4 ${isBorrowingMode ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          {isBorrowingMode ? t('dispatchWarningTemp') : t('dispatchWarningPerm')}
        </div>
        <form id="dispatchForm" onSubmit={handleDispatchSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 relative z-50">
            <div className="relative z-[60]">
              <label className="text-xs font-bold text-slate-600 block mb-1">{t('originBranch')}</label>
              <div 
                onClick={() => setOpenDropdown(openDropdown === 'fromLocation' ? null : 'fromLocation')}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs cursor-pointer flex justify-between items-center hover:bg-slate-100 transition-colors h-[34px]"
              >
                <span className={dispatchForm.from_location ? 'text-slate-800 font-medium' : 'text-slate-400'}>{dispatchForm.from_location || t('selectOriginBranch')}</span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${openDropdown === 'fromLocation' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
              {openDropdown === 'fromLocation' && (
                <div className="absolute z-[70] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] overflow-hidden">
                  <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                    <div className="relative">
                      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input 
                        autoFocus
                        type="text" 
                        placeholder={t('searchOriginBranch')} 
                        value={fromBranchSearch}
                        onChange={(e) => setFromBranchSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-[#286086]"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {mapBranches.filter(b => (b.name || b.branch_code).toLowerCase().includes(fromBranchSearch.toLowerCase())).map(b => (
                      <div 
                        key={b.id}
                        onClick={() => {
                          setDispatchForm({...dispatchForm, from_location: b.name || b.branch_code, asset_ids: []});
                          setOpenDropdown(null);
                          setFromBranchSearch('');
                        }}
                        className="px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-[#286086] rounded-lg cursor-pointer transition-colors font-semibold flex items-center justify-between group"
                      >
                        {b.name || b.branch_code}
                        {dispatchForm.from_location === (b.name || b.branch_code) && <svg className="w-4 h-4 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    ))}
                    {mapBranches.filter(b => (b.name || b.branch_code).toLowerCase().includes(fromBranchSearch.toLowerCase())).length === 0 && (
                      <div className="px-3 py-4 text-xs text-center text-slate-400 font-medium">{t('branchNotFound')}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="relative z-50">
              <label className="block text-xs font-bold text-slate-600 mb-1">{t('toLocation')}</label>
              <div 
                onClick={() => setOpenDropdown(openDropdown === 'toLocation' ? null : 'toLocation')}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs cursor-pointer flex justify-between items-center hover:bg-slate-100 transition-colors h-[34px]"
              >
                <span className={dispatchForm.to_location ? 'text-slate-800 font-medium' : 'text-slate-400'}>{dispatchForm.to_location || t('selectDestBranch')}</span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${openDropdown === 'toLocation' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
              {openDropdown === 'toLocation' && (
                <div className="absolute z-[60] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] overflow-hidden">
                  <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                    <div className="relative">
                      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input 
                        autoFocus
                        type="text" 
                        placeholder={t('searchDestBranch')} 
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-[#286086]"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {mapBranches.filter(b => (b.name || b.branch_code).toLowerCase().includes(branchSearch.toLowerCase())).map(b => (
                      <div 
                        key={b.id}
                        onClick={() => {
                          setDispatchForm({...dispatchForm, to_location: b.name || b.branch_code});
                          setOpenDropdown(null);
                          setBranchSearch('');
                        }}
                        className="px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-[#286086] rounded-lg cursor-pointer transition-colors font-semibold flex items-center justify-between group"
                      >
                        {b.name || b.branch_code}
                        {dispatchForm.to_location === (b.name || b.branch_code) && <svg className="w-4 h-4 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    ))}
                    {mapBranches.filter(b => (b.name || b.branch_code).toLowerCase().includes(branchSearch.toLowerCase())).length === 0 && (
                      <div className="px-3 py-4 text-xs text-center text-slate-400 font-medium">{t('branchNotFound')}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-600">{t('selectAsset')} (Bisa pilih lebih dari 1)</label>
              <input 
                type="text" 
                placeholder="Cari Asset ID / Nama..." 
                value={assetSearchTerm}
                onChange={(e) => setAssetSearchTerm(e.target.value)}
                className="text-[10px] p-1 px-2 border border-slate-200 rounded outline-none focus:border-[#286086]"
                disabled={!dispatchForm.from_location}
              />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 max-h-32 overflow-y-auto flex flex-col gap-1.5 custom-scrollbar relative">
              {!dispatchForm.from_location && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                  <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100">{t('selectBranchFirstPls')}</span>
                </div>
              )}
              {assets.filter(a => a.id.toLowerCase().includes(assetSearchTerm.toLowerCase()) || (a.name || '').toLowerCase().includes(assetSearchTerm.toLowerCase())).map(a => (
                <label key={a.id} className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white rounded transition-colors border border-transparent hover:border-slate-200">
                  <input 
                    type="checkbox" 
                    checked={dispatchForm.asset_ids?.includes(a.id)}
                    onChange={(e) => {
                      const newIds = e.target.checked 
                        ? [...(dispatchForm.asset_ids || []), a.id] 
                        : (dispatchForm.asset_ids || []).filter(id => id !== a.id);
                      setDispatchForm({...dispatchForm, asset_ids: newIds});
                    }}
                    className="w-4 h-4 rounded text-[#286086] focus:ring-[#286086]"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700">{a.id}</span>
                    <span className="text-[10px] text-slate-500 font-medium truncate max-w-[300px]">{a.name} <span className="opacity-60 text-[9px]">({a.branch})</span></span>
                  </div>
                </label>
              ))}
              {assets.length === 0 && <span className="text-xs text-slate-400 p-2">Tidak ada aset tersedia (harus berstatus Active/Deployed)</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className={dispatchForm.purpose === 'Onsite Project' ? 'col-span-2' : ''}>
              <label className="block text-xs font-bold text-slate-600 mb-1">{t('purpose')}</label>
              <select value={dispatchForm.purpose} onChange={e => {
                const isToOnsite = e.target.value === 'Onsite Project';
                setDispatchForm({...dispatchForm, purpose: e.target.value, to_location: isToOnsite ? '' : dispatchForm.to_location});
              }} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none cursor-pointer">
                <option value="Operational">Operational</option>
                <option value="Onsite Project">Onsite Project</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
            {dispatchForm.purpose !== 'Onsite Project' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('purposeDetail')}</label>
                <input type="text" placeholder="Detail" value={dispatchForm.purpose_detail} onChange={e => setDispatchForm({...dispatchForm, purpose_detail: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
              </div>
            )}
            {dispatchForm.purpose === 'Onsite Project' && (
              <div className="col-span-2">
                <label className="block text-xs font-bold text-[#286086] mb-1">{t('onsiteDetailLabel')}</label>
                <input required type="text" placeholder="Contoh: Site B, Tower 3..." value={dispatchForm.onsite_detail} onChange={e => setDispatchForm({...dispatchForm, onsite_detail: e.target.value})} className="w-full bg-blue-50/50 border border-blue-200 rounded-lg p-2.5 text-sm outline-none focus:border-[#286086]" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">{t('senderName')}</label>
              <input required type="text" value={dispatchForm.sender_name} onChange={e => setDispatchForm({...dispatchForm, sender_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">{t('estReturnDate')}</label>
              <Flatpickr 
                value={dispatchForm.expected_return_date} 
                onChange={([date]) => setDispatchForm({...dispatchForm, expected_return_date: date ? date.toLocaleDateString('en-CA') : ''})} 
                options={{ dateFormat: "Y-m-d" }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none placeholder-slate-400" 
                placeholder="Select date (optional)"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">{t('proofImageMandatory')}</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-[#286086]/50 transition-all group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-8 h-8 mb-3 text-slate-400 group-hover:text-[#286086] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                <p className="mb-1 text-sm text-slate-500 font-bold"><span className="text-[#286086]">Click to upload</span> or drag and drop</p>
                <p className="text-xs text-slate-400 font-medium">PNG, JPG or JPEG (MAX. 5MB)</p>
              </div>
              <input required={!dispatchForm.proof_image} type="file" accept="image/*" onChange={e => setDispatchForm({...dispatchForm, proof_image: e.target.files[0]})} className="hidden" />
            </label>
            {dispatchForm.proof_image && <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> {dispatchForm.proof_image.name}</div>}
          </div>
        </form>
      </BaseModal>

      {/* RECEIVE MODAL */}
      <BaseModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        title={t('receiveConfirmTitle')}
        maxWidth="max-w-4xl"
        footer={
          <>
            <button type="button" onClick={() => setIsReceiveModalOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" form="receiveForm" className="px-6 py-2 text-sm font-bold bg-emerald-500 text-white rounded-xl shadow-md hover:bg-emerald-600">Receive Asset</button>
          </>
        }
      >
        <form id="receiveForm" onSubmit={handleReceiveSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">{t('receiverName')}</label>
            <input required type="text" value={receiveForm.receiver_name} onChange={e => setReceiveForm({...receiveForm, receiver_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">{t('notesOptional')}</label>
            <input type="text" value={receiveForm.notes} onChange={e => setReceiveForm({...receiveForm, notes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Proof Image (Mandatory)</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-emerald-500/50 transition-all group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-8 h-8 mb-3 text-slate-400 group-hover:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                <p className="mb-1 text-sm text-slate-500 font-bold"><span className="text-emerald-500">Click to upload</span> or drag and drop</p>
                <p className="text-xs text-slate-400 font-medium">PNG, JPG or JPEG (MAX. 5MB)</p>
              </div>
              <input required={!receiveForm.proof_image} type="file" accept="image/*" onChange={e => setReceiveForm({...receiveForm, proof_image: e.target.files[0]})} className="hidden" />
            </label>
            {receiveForm.proof_image && <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> {receiveForm.proof_image.name}</div>}
          </div>
        </form>
      </BaseModal>
    </div>
  );
}
