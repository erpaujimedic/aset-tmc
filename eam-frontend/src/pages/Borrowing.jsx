import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import Swal from 'sweetalert2';
import useI18nStore from '../store/i18nStore';
import useAuthStore from '../store/authStore';
import BaseModal from '../components/ui/BaseModal';
import useSWR from 'swr';
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/light.css";

export default function Borrowing() {
  const { t } = useI18nStore();
  const { user } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState('browse'); // browse, my-requests, approvals
  
  const fetcher = url => api.get(url).then(res => res.data.data || []);
  const branchFetcher = url => api.get(url).then(res => res.data.branches || []);
  
  // Filter for Browse
  const [targetBranch, setTargetBranch] = useState('');
  const [searchAsset, setSearchAsset] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [branchSearch, setBranchSearch] = useState('');

  const { data: mapBranches = [] } = useSWR('/master/setup-data', branchFetcher, { revalidateOnFocus: false });
  const { data: allAssets = [], mutate: mutateAssets } = useSWR(targetBranch ? `/assets?branch=${targetBranch}` : null, fetcher, { revalidateOnFocus: false });
  const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';
  const isAdminSystem = ['Master Admin', 'Admin System'].includes(user?.role);
  const apiBranchParam = (isAdminSystem || isAllBranch) ? null : (Array.isArray(user?.branch) ? user.branch.join(',') : user?.branch);

  const movEndpoint = apiBranchParam ? `/movements?branch=${encodeURIComponent(apiBranchParam)}` : '/movements';
  const { data: movements = [], mutate: mutateMovements, isValidating: isMovementsLoading } = useSWR(movEndpoint, fetcher, { revalidateOnFocus: false });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  
  // Modals
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedMovement, setSelectedMovement] = useState(null);
  
  const [borrowForm, setBorrowForm] = useState({
    locationType: 'Klinik',
    locationDetail: '',
    purpose: '',
    expected_return_date: '',
    proof_image: null
  });

  const [returnForm, setReturnForm] = useState({
    return_from: user?.branch || '',
    notes: '',
    proof_image: null
  });

  const [approveForm, setApproveForm] = useState({
    reason: ''
  });

  // Derived Data
  const borrowableAssets = allAssets.filter(a => {
    // Cannot borrow from your own branch
    if (a.branch === user?.branch && user?.branch !== 'ALL') return false;
    if (searchAsset && !a.name.toLowerCase().includes(searchAsset.toLowerCase()) && !a.id.toLowerCase().includes(searchAsset.toLowerCase())) return false;
    return true;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = borrowableAssets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(borrowableAssets.length / itemsPerPage);

  useEffect(() => setCurrentPage(1), [targetBranch, searchAsset]);

  const borrowMovements = movements.filter(m => m.movement_type === 'Borrowing');
  const myRequests = borrowMovements.filter(m => m.to_location === user?.branch || m.sender_name === user?.name);
  // Approvals needed for MY branch's assets
  const pendingApprovals = borrowMovements.filter(m => m.from_location === user?.branch && m.status === 'Pending Borrow Approval');
  const incomingReturns = borrowMovements.filter(m => m.from_location === user?.branch && m.status === 'Returning');

  const handleBorrowSubmit = async (e) => {
    e.preventDefault();
    if (!borrowForm.purpose || !borrowForm.expected_return_date || !borrowForm.proof_image) {
      return Swal.fire('Error', 'Lengkapi semua form pengajuan peminjaman beserta foto!', 'warning');
    }
    if (borrowForm.locationType === 'Onsite' && !borrowForm.locationDetail) {
      return Swal.fire('Error', 'Harap isi detail lokasi Onsite!', 'warning');
    }

    const finalPurpose = `[${borrowForm.locationType}${borrowForm.locationType === 'Onsite' ? ` - ${borrowForm.locationDetail}` : ''}] ${borrowForm.purpose}`;

    const formData = new FormData();
    const tracking_code = `BRW-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    formData.append('tracking_code', tracking_code);
    formData.append('asset_id', selectedAsset.id);
    formData.append('purpose', finalPurpose);
    formData.append('from_location', selectedAsset.branch);
    formData.append('to_location', user?.branch || 'Unknown');
    formData.append('borrower_name', user?.name || 'Unknown');
    formData.append('expected_return_date', borrowForm.expected_return_date);
    formData.append('proof_image', borrowForm.proof_image);

    Swal.fire({ title: t('borrowingProcessing'), text: t('uploadingForm'), allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      await api.post('/movements/borrow', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Swal.fire(t('success'), 'Pengajuan peminjaman berhasil dikirim, menunggu persetujuan cabang asal.', 'success');
      setIsBorrowModalOpen(false);
      setBorrowForm({ locationType: 'Klinik', locationDetail: '', purpose: '', expected_return_date: '', proof_image: null });
      mutateMovements();
      mutateAssets();
      setActiveTab('my-requests');
    } catch (err) {
      Swal.fire(t('error'), err.response?.data?.detail || t('uploadFailed'), 'error');
    }
  };

  const handleApprove = async (movement, isApprove) => {
    if (!isApprove && !approveForm.reason) {
      return Swal.fire(t('error'), 'Harap isi alasan penolakan.', 'warning');
    }
    try {
      const endpoint = isApprove ? '/movements/approve_borrow' : '/movements/reject_borrow';
      await api.post(endpoint, {
        tracking_code: movement.tracking_code,
        approver_name: user?.name || 'Admin',
        reason: approveForm.reason
      });
      Swal.fire(t('success'), isApprove ? 'Peminjaman disetujui, aset berstatus In Transit.' : 'Peminjaman ditolak.', 'success');
      setIsApproveModalOpen(false);
      setApproveForm({ reason: '' });
      mutateMovements();
      mutateAssets();
    } catch(err) {
      Swal.fire(t('error'), t('systemError'), 'error');
    }
  };

  const handleReceiveBorrow = async (movement) => {
    const { value: file } = await Swal.fire({
      title: 'Terima Aset Pinjaman',
      text: 'Unggah foto bukti terima barang pinjaman',
      input: 'file',
      inputAttributes: { accept: 'image/*', 'aria-label': 'Upload picture' },
      showCancelButton: true
    });

    if (file) {
      Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
      const formData = new FormData();
      formData.append('tracking_code', movement.tracking_code);
      formData.append('receiver_name', user?.name || 'Unknown');
      formData.append('proof_image', file);
      
      try {
        await api.post('/movements/receive_borrow', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        Swal.fire('Berhasil!', 'Aset telah diterima dan berstatus Sedang Dipinjam.', 'success');
        mutateMovements();
        mutateAssets();
      } catch(err) {
        Swal.fire('Error', 'Gagal menerima aset', 'error');
      }
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnForm.proof_image) {
      return Swal.fire('Error', 'Wajib melampirkan foto serah terima pengembalian.', 'warning');
    }

    const formData = new FormData();
    formData.append('tracking_code', selectedMovement.tracking_code);
    formData.append('returner_name', user?.name || 'Unknown');
    formData.append('return_from', returnForm.return_from);
    formData.append('notes', returnForm.notes);
    formData.append('proof_image', returnForm.proof_image);

    Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
    try {
      await api.post('/movements/return_borrow', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Swal.fire('Sukses!', 'Proses pengembalian berhasil, aset dikirim balik ke cabang asal.', 'success');
      setIsReturnModalOpen(false);
      setReturnForm({ return_from: user?.branch || '', notes: '', proof_image: null });
      mutateMovements();
      mutateAssets();
    } catch(err) {
      Swal.fire('Error', 'Gagal memproses pengembalian.', 'error');
    }
  };

  const handleCompleteReturn = async (movement) => {
    const { value: file } = await Swal.fire({
      title: 'Selesaikan Pengembalian',
      text: 'Unggah foto bukti penerimaan kembali aset dari peminjam',
      input: 'file',
      inputAttributes: { accept: 'image/*' },
      showCancelButton: true
    });

    if (file) {
      Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
      const formData = new FormData();
      formData.append('tracking_code', movement.tracking_code);
      formData.append('receiver_name', user?.name || 'Unknown');
      formData.append('proof_image', file);
      
      try {
        await api.post('/movements/complete_return', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        Swal.fire('Berhasil!', 'Aset telah kembali dengan selamat ke cabang kita.', 'success');
        mutateMovements();
        mutateAssets();
      } catch(err) {
        Swal.fire('Error', 'Gagal menyelesaikan pengembalian', 'error');
      }
    }
  };

  const isUnavailable = (status) => ['Borrowed', 'In Transit', 'Maintenance', 'Pending Borrow Approval', 'Pending Approval'].includes(status);

  return (
    <div className="h-full flex flex-col animate-[fadeIn_0.4s_ease-out] space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-200 gap-3">
        <div className="flex gap-2 shrink-0 overflow-x-auto w-full lg:w-auto custom-scrollbar pb-1 lg:pb-0 items-center">
          <button 
            onClick={() => { mutateAssets(); mutateMovements(); }} 
            title={t('refreshData') || 'Refresh Data'}
            className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 w-[38px] h-[38px] rounded-xl flex items-center justify-center shadow-sm transition-all shrink-0 mr-1"
          >
            <svg className={`w-4 h-4 ${isMovementsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button onClick={() => setActiveTab('browse')} className={`px-5 py-2.5 shrink-0 rounded-xl font-bold text-xs transition-colors ${activeTab === 'browse' ? 'bg-[#286086] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>{t('searchAssetTab')}</button>
          <button onClick={() => setActiveTab('my-requests')} className={`px-5 py-2.5 shrink-0 rounded-xl font-bold text-xs transition-colors ${activeTab === 'my-requests' ? 'bg-[#286086] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>{t('myRequestsTab')}</button>
          {(['Master Admin', 'Admin System', 'Branch Manager', 'Admin'].includes(user?.role)) && (
            <button onClick={() => setActiveTab('approvals')} className={`px-5 py-2.5 shrink-0 rounded-xl font-bold text-xs transition-colors relative ${activeTab === 'approvals' ? 'bg-[#286086] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
              {t('approvalsTab')}
              {(pendingApprovals.length + incomingReturns.length) > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[9px] shadow-sm">{pendingApprovals.length + incomingReturns.length}</span>}
            </button>
          )}
        </div>
        
        {activeTab === 'browse' && (
          <div className="flex gap-3 items-center w-full lg:w-auto shrink-0 flex-wrap sm:flex-nowrap">
            <div className="relative z-50 flex-1 sm:flex-none">
              <div 
                onClick={() => setOpenDropdown(openDropdown === 'branch' ? null : 'branch')}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2 font-bold cursor-pointer flex justify-between items-center hover:bg-slate-100 transition-colors w-full sm:w-56 h-[38px]"
              >
                <span className={`truncate ${targetBranch ? 'text-slate-800' : 'text-slate-400'}`}>{targetBranch || t('selectBranch')}</span>
                <svg className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform ${openDropdown === 'branch' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
              {openDropdown === 'branch' && (
                <div className="absolute right-0 z-[60] mt-1 w-full sm:w-64 bg-white border border-slate-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] overflow-hidden">
                  <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                    <div className="relative">
                      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="Search branch..." 
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-[#286086]"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {mapBranches.filter(b => b.name !== user?.branch && b.name.toLowerCase().includes(branchSearch.toLowerCase())).map(b => (
                      <div 
                        key={b.id || b.name}
                        onClick={() => {
                          setTargetBranch(b.name);
                          setOpenDropdown(null);
                          setBranchSearch('');
                        }}
                        className="px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-[#286086] rounded-lg cursor-pointer transition-colors font-semibold flex items-center justify-between group"
                      >
                        {b.name}
                        {targetBranch === b.name && <svg className="w-4 h-4 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    ))}
                    {mapBranches.filter(b => b.name !== user?.branch && b.name.toLowerCase().includes(branchSearch.toLowerCase())).length === 0 && (
                      <div className="px-3 py-4 text-xs text-center text-slate-400 font-medium">{t('branchNotFound') || 'Branch not found'}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <input type="text" placeholder={t('searchAssets')} value={searchAsset} onChange={e => setSearchAsset(e.target.value)} className="bg-slate-50 flex-1 sm:flex-none border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2 outline-none w-full sm:w-56 focus:ring-2 focus:ring-[#286086]/20 h-[38px]" />
          </div>
        )}
      </div>

      <div className="flex-1 bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden flex flex-col p-6">
        
        {activeTab === 'browse' && (
          <div className="flex flex-col h-full space-y-4">


            <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-100 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-slate-500 text-[11px] uppercase tracking-wider font-extrabold">
                    <th className="p-4">{t('assetId')}</th>
                    <th className="p-4">{t('assetName')}</th>
                    <th className="p-4">{t('originBranch')}</th>
                    <th className="p-4">{t('status')}</th>
                    <th className="p-4">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map(asset => {
                    const disabled = isUnavailable(asset.status);
                    return (
                      <tr key={asset.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${disabled ? 'opacity-60 bg-slate-50' : ''}`}>
                        <td className="p-4 font-mono text-sm font-bold text-slate-600">{asset.id}</td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800 text-sm">{asset.name}</div>
                          <div className="text-xs text-slate-500">{asset.category}</div>
                        </td>
                        <td className="p-4 font-bold text-slate-600 text-sm">{asset.branch}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                            asset.status === 'Active' || asset.status === 'Deployed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            asset.status === 'Borrowed' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                            'bg-amber-50 text-amber-600 border-amber-200'
                          }`}>{asset.status}</span>
                        </td>
                        <td className="p-4">
                          <button 
                            disabled={disabled}
                            onClick={() => { setSelectedAsset(asset); setIsBorrowModalOpen(true); }}
                            className="bg-[#286086] hover:bg-[#1a4666] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {disabled ? t('unavailable') : t('borrow')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {!targetBranch && (
                    <tr>
                      <td colSpan="5" className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-14 h-14 bg-slate-50 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center text-slate-400 mb-1">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                          </div>
                          <div className="text-sm font-bold text-slate-500">{t('selectBranchFirstPls')}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {targetBranch && currentItems.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-14 h-14 bg-slate-50 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center text-slate-400 mb-1">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                          </div>
                          <div className="text-sm font-bold text-slate-500">{t('noAssetsInBranch')}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-500">
                  {t('showing')} {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, borrowableAssets.length)} {t('of')} {borrowableAssets.length} {t('asset')}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm">
                    <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="flex items-center gap-1 px-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1).map((p, i, arr) => (
                      <React.Fragment key={p}>
                        {i > 0 && arr[i - 1] !== p - 1 && <span className="text-slate-400 px-1">...</span>}
                        <button onClick={() => setCurrentPage(p)} className={`w-8 h-8 rounded-lg text-sm font-bold shadow-sm transition-all ${currentPage === p ? 'bg-[#286086] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{p}</button>
                      </React.Fragment>
                    ))}
                  </div>
                  <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm">
                    <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {activeTab === 'my-requests' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-slate-500 text-[11px] uppercase tracking-wider font-extrabold">
                  <th className="p-4">{t('trackingCode')}</th>
                  <th className="p-4">{t('asset')}</th>
                  <th className="p-4">{t('originBranch')}</th>
                  <th className="p-4">{t('status')}</th>
                  <th className="p-4">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map(mov => (
                  <tr key={mov.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-4 font-mono text-sm font-bold text-[#286086]">{mov.tracking_code}</td>
                    <td className="p-4 text-sm font-bold text-slate-700">{mov.assets?.name}<br/><span className="text-xs text-slate-400 font-mono">{mov.asset_id}</span></td>
                    <td className="p-4 text-sm font-bold text-slate-600">{mov.from_location}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border bg-blue-50 text-blue-600 border-blue-200">{mov.status}</span>
                    </td>
                    <td className="p-4">
                      {mov.status === 'In Transit' && (
                        <button onClick={() => handleReceiveBorrow(mov)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md">{t('receiveBorrowBtn')}</button>
                      )}
                      {mov.status === 'Borrowed' && (
                        <button onClick={() => { setSelectedMovement(mov); setIsReturnModalOpen(true); }} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md">{t('returnAssetBtn')}</button>
                      )}
                    </td>
                  </tr>
                ))}
                {myRequests.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-14 h-14 bg-slate-50 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center text-slate-400 mb-1">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <div className="text-sm font-bold text-slate-500">{t('noBorrowHistory')}</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-slate-500 text-[11px] uppercase tracking-wider font-extrabold">
                  <th className="p-4">{t('trackingCode')}</th>
                  <th className="p-4">{t('sender')}</th>
                  <th className="p-4">{t('asset')}</th>
                  <th className="p-4">{t('status')}</th>
                  <th className="p-4">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {[...pendingApprovals, ...incomingReturns].map(mov => (
                  <tr key={mov.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-4 font-mono text-sm font-bold text-[#286086]">{mov.tracking_code}</td>
                    <td className="p-4 text-sm font-bold text-slate-700">{mov.sender_name}<br/><span className="text-xs text-slate-400">{mov.to_location}</span></td>
                    <td className="p-4 text-sm font-bold text-slate-700">{mov.assets?.name}<br/><span className="text-xs text-slate-400 font-mono">{mov.asset_id}</span></td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border bg-amber-50 text-amber-600 border-amber-200">{mov.status}</span>
                    </td>
                    <td className="p-4">
                      {mov.status === 'Pending Borrow Approval' && (
                        <button onClick={() => { setSelectedMovement(mov); setIsApproveModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md">Review Persetujuan</button>
                      )}
                      {mov.status === 'Returning' && (
                        <button onClick={() => handleCompleteReturn(mov)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md">Konfirmasi Terima Balik</button>
                      )}
                    </td>
                  </tr>
                ))}
                {(pendingApprovals.length + incomingReturns.length) === 0 && (
                  <tr>
                    <td colSpan="5" className="p-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-14 h-14 bg-slate-50 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center text-slate-400 mb-1">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <div className="text-sm font-bold text-slate-500">{t('noPendingApprovals') || 'No pending approvals'}</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* BORROW MODAL */}
      <BaseModal isOpen={isBorrowModalOpen} onClose={() => setIsBorrowModalOpen(false)} title="Form Pengajuan Pinjam Aset" maxWidth="max-w-4xl">
        <form onSubmit={handleBorrowSubmit} className="space-y-4">
          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 mb-4">
            <h4 className="font-bold text-sm mb-1">Aset yang dipinjam:</h4>
            <p className="text-sm font-bold">{selectedAsset?.name} <span className="font-mono text-xs opacity-80 ml-2">({selectedAsset?.id})</span></p>
            <p className="text-xs mt-1">Pemilik Asli: {selectedAsset?.branch}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi Penggunaan</label>
              <select value={borrowForm.locationType} onChange={e => setBorrowForm({...borrowForm, locationType: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500">
                <option value="Klinik">Klinik</option>
                <option value="Onsite">Onsite</option>
              </select>
            </div>
            
            {borrowForm.locationType === 'Onsite' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <label className="block text-xs font-bold text-slate-700 mb-1">Detail Lokasi Onsite</label>
                <input required={borrowForm.locationType === 'Onsite'} type="text" value={borrowForm.locationDetail} onChange={e => setBorrowForm({...borrowForm, locationDetail: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="Misal: PT ABC Cikarang" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Keperluan (Detail)</label>
            <textarea required rows="2" value={borrowForm.purpose} onChange={e => setBorrowForm({...borrowForm, purpose: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="Catatan keperluan alat..." />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Rencana Tanggal Pengembalian</label>
            <Flatpickr 
              value={borrowForm.expected_return_date} 
              onChange={([date]) => setBorrowForm({...borrowForm, expected_return_date: date ? date.toLocaleDateString('en-CA') : ''})} 
              options={{ dateFormat: "Y-m-d", minDate: "today" }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
              placeholder="Pilih Tanggal Kembali"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Foto Bukti Surat / Form Peminjaman (Wajib)</label>
            <input required type="file" accept="image/*" onChange={e => setBorrowForm({...borrowForm, proof_image: e.target.files[0]})} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700" />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 gap-3">
            <button type="button" onClick={() => setIsBorrowModalOpen(false)} className="px-5 py-2 font-bold text-sm text-slate-500 rounded-lg hover:bg-slate-100">Batal</button>
            <button type="submit" className="px-5 py-2 font-bold text-sm bg-[#286086] text-white rounded-lg shadow-lg hover:bg-[#1a4666]">Ajukan Peminjaman</button>
          </div>
        </form>
      </BaseModal>

      {/* APPROVE MODAL */}
      <BaseModal isOpen={isApproveModalOpen} onClose={() => setIsApproveModalOpen(false)} title="Persetujuan Peminjaman Aset" maxWidth="max-w-4xl">
        <div className="space-y-4">
          <p className="text-sm text-slate-600"><strong>Peminjam:</strong> {selectedMovement?.sender_name} dari {selectedMovement?.to_location}</p>
          <p className="text-sm text-slate-600"><strong>Alasan Peminjaman:</strong> {selectedMovement?.purpose}</p>
          
          {selectedMovement?.sender_proof_url && (
            <div className="border border-slate-200 p-2 rounded-lg">
              <p className="text-xs font-bold text-slate-500 mb-2">Dokumen / Form Request:</p>
              <img src={selectedMovement.sender_proof_url} alt="Proof" className="w-full h-40 object-cover rounded shadow-sm cursor-pointer" onClick={() => window.open(selectedMovement.sender_proof_url)} />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('reasonReject')}</label>
            <textarea rows="2" value={approveForm.reason} onChange={e => setApproveForm({...approveForm, reason: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="Komentar tambahan" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button onClick={() => handleApprove(selectedMovement, false)} className="px-5 py-2 font-bold text-sm bg-rose-50 text-rose-600 rounded-lg border border-rose-200 hover:bg-rose-100">{t('rejectBtn')}</button>
            <button onClick={() => handleApprove(selectedMovement, true)} className="px-5 py-2 font-bold text-sm bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600">{t('approveBtn')}</button>
          </div>
        </div>
      </BaseModal>

      {/* RETURN MODAL */}
      <BaseModal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} title="Form Pengembalian Aset Pinjaman" maxWidth="max-w-4xl">
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 text-sm">
            Pastikan Anda telah membersihkan aset dan mengembalikannya ke kondisi semula. Aset akan dikirimkan kembali ke <strong>{selectedMovement?.from_location}</strong>.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi Aset Saat Ini (Beda Onsite / Klinik?)</label>
            <input required type="text" value={returnForm.return_from} onChange={e => setReturnForm({...returnForm, return_from: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" placeholder="Misal: Onsite Project ABC atau Di Klinik Karawang" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Pengembalian</label>
            <textarea rows="2" value={returnForm.notes} onChange={e => setReturnForm({...returnForm, notes: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" placeholder="Catatan kondisi alat atau kelengkapan..." />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Foto Dokumentasi Kondisi Saat Dikembalikan (Wajib)</label>
            <input required type="file" accept="image/*" onChange={e => setReturnForm({...returnForm, proof_image: e.target.files[0]})} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-amber-50 file:text-amber-700" />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 gap-3">
            <button type="button" onClick={() => setIsReturnModalOpen(false)} className="px-5 py-2 font-bold text-sm text-slate-500 rounded-lg hover:bg-slate-100">Batal</button>
            <button type="submit" className="px-5 py-2 font-bold text-sm bg-amber-500 text-white rounded-lg shadow hover:bg-amber-600">Kirim Kembali Aset</button>
          </div>
        </form>
      </BaseModal>

    </div>
  );
}
