import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import Swal from 'sweetalert2';
import useI18nStore from '../store/i18nStore';
import useAuthStore from '../store/authStore';
import BaseModal from '../components/ui/BaseModal';
import QRScannerModal from '../components/ui/QRScannerModal';
import useSWR from 'swr';
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/light.css";

export default function Borrowing() {
  const { t } = useI18nStore();
  const { user } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState('browse'); // browse, my-requests, approvals

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(' pukul', ',');
  };

  const getUpdateStatusInfo = (mov) => {
    let updateTime = null;
    let updateLabel = 'Upd:';
    let fullLabel = 'Waktu Update:';
    
    if (mov?.items?.[0]?.movement_logs?.length > 0) {
      const logs = [...mov.items[0].movement_logs].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
      const lastLog = logs[logs.length - 1];
      if (new Date(lastLog.created_at) - new Date(mov.created_at) > 2000) {
        updateTime = lastLog.created_at;
      }
    }
    if (!updateTime && mov?.items?.[0]?.updated_at && mov.items[0].updated_at !== mov.created_at) {
      updateTime = mov.items[0].updated_at;
    }

    if (updateTime) {
      if (mov.status === 'In Transit') { updateLabel = 'Apprv:'; fullLabel = 'Waktu Disetujui:'; }
      else if (mov.status === 'Completed' || mov.status === 'Completed') { updateLabel = 'Rcvd:'; fullLabel = 'Waktu Diterima:'; }
      else if (mov.status === 'Pending Approval' || mov.status === 'Pending Approval') { updateLabel = 'Upld:'; fullLabel = 'Form Diunggah:'; }
      else if (mov.status === 'Rejected') { updateLabel = 'Rjct:'; fullLabel = 'Waktu Ditolak:'; }
      else if (mov.status === 'Cancelled') { updateLabel = 'Cncl:'; fullLabel = 'Waktu Dibatalkan:'; }
    }
    
    return { time: updateTime, shortLabel: updateLabel, fullLabel: fullLabel };
  };
  
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
  const fastMovEndpoint = movEndpoint.includes('?') ? `${movEndpoint}&limit=100` : `${movEndpoint}?limit=100`;

  const { data: fastMovements = [], mutate: mutateFastMovements, isValidating: isFastLoading } = useSWR(fastMovEndpoint, fetcher, { revalidateOnFocus: false });
  const { data: syncedMovements, mutate: mutateSyncedMovements, isValidating: isSyncedLoading } = useSWR(movEndpoint, fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 });

  const movements = syncedMovements || fastMovements;
  const isMovementsLoading = !syncedMovements && isFastLoading;
  
  const mutateMovements = (data, options) => {
      mutateFastMovements(data, options);
      mutateSyncedMovements(data, options);
  };
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isUploadProofModalOpen, setIsUploadProofModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isCompleteReturnModalOpen, setIsCompleteReturnModalOpen] = useState(false);
  
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [selectedMovement, setSelectedMovement] = useState(null);
  
  const [uploadProofForm, setUploadProofForm] = useState({ proof_image: null });
  
  const [receiveForm, setReceiveForm] = useState({
    receiver_name: user?.username || user?.fullName || '',
    proof_image: null
  });

  const [completeReturnForm, setCompleteReturnForm] = useState({
    receiver_name: user?.username || user?.fullName || '',
    proof_image: null
  });
  
  const [borrowForm, setBorrowForm] = useState({
    to_location: user?.branch || '',
    purpose: 'Onclinic',
    purpose_detail: '',
    onsite_detail: '',
    borrower_name: user?.username || user?.fullName || '',
    expected_return_date: '',
    proof_image: null
  });

  const [returnForm, setReturnForm] = useState({
    return_from: user?.branch || '',
    return_to: '',
    notes: '',
    proof_image: null
  });

  const [approveForm, setApproveForm] = useState({
    sender_name: user?.username || user?.fullName || '',
    proof_image: null
  });
  const [itemDecisions, setItemDecisions] = useState({});
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    if (selectedMovement?.items) {
      setSelectedItemIds(selectedMovement.items.map(i => i.id));
    } else {
      setSelectedItemIds([]);
    }
    setExpandedGroups({});
  }, [selectedMovement]);

  useEffect(() => {
    if (user?.username || user?.fullName) {
      const uName = user.username || user.fullName;
      setReceiveForm(prev => ({ ...prev, receiver_name: uName }));
      setCompleteReturnForm(prev => ({ ...prev, receiver_name: uName }));
      setBorrowForm(prev => ({ ...prev, borrower_name: uName, to_location: user.branch || '' }));
      setApproveForm(prev => ({ ...prev, sender_name: uName }));
    }
  }, [user]);

  const getDaysLeft = (dateString) => {
    if (!dateString) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(dateString);
    target.setHours(0,0,0,0);
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return <span className="text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded">Terlambat {Math.abs(diffDays)} Hari</span>;
    if (diffDays === 0) return <span className="text-amber-500 font-bold bg-amber-50 px-1.5 py-0.5 rounded">Jatuh Tempo Hari Ini</span>;
    return <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">{diffDays} Hari Lagi</span>;
  };

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

  const groupMovements = (movs) => {
    const groups = {};
    movs.forEach(m => {
      const parts = m.tracking_code.split('-');
      const baseCode = parts.length > 3 ? parts.slice(0, 3).join('-') : m.tracking_code;
      if (!groups[baseCode]) {
        groups[baseCode] = {
          id: baseCode, tracking_code: baseCode, sender_name: m.sender_name,
          from_location: m.from_location, to_location: m.to_location,
          purpose: m.purpose, created_at: m.created_at, items: []
        };
      }
      groups[baseCode].items.push(m);
    });
    return Object.values(groups).map(g => {
      const statuses = g.items.map(i => i.status);
      const activeStatuses = statuses.filter(s => s !== 'Rejected' && s !== 'Cancelled' && s !== 'Canceled');

      if (statuses.every(s => s === 'Rejected')) g.status = 'Rejected';
      else if (statuses.every(s => s === 'Cancelled' || s === 'Canceled')) g.status = 'Cancelled';
      else if (activeStatuses.includes('Requested') || activeStatuses.includes('Menunggu Dokumen TTD')) g.status = 'Requested';
      else if (activeStatuses.includes('Pending Approval') || activeStatuses.includes('Pending Borrow Approval')) g.status = 'Pending Approval';
      else if (activeStatuses.includes('Return Pending Approval') || activeStatuses.includes('Pending Return Approval')) g.status = 'Return Pending Approval';
      else if (activeStatuses.includes('In Transit')) g.status = 'In Transit';
      else if (activeStatuses.includes('Return In Transit') || activeStatuses.includes('Returning')) g.status = 'Return In Transit';
      else if (activeStatuses.includes('Received') || activeStatuses.includes('Borrowed')) g.status = 'Received';
      else if (activeStatuses.includes('Completed')) g.status = 'Completed';
      else g.status = activeStatuses[0] || 'Completed';
      return g;
    }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  };

  const borrowMovements = movements.filter(m => m.movement_type === 'Borrowing');
  const isAdmin = isAdminSystem || isAllBranch;
  const canDelete = ['Administrator', 'Master Admin', 'Admin System'].includes(user?.role);

  const myRequestsRaw = borrowMovements.filter(m => isAdmin || m.to_location?.startsWith(user?.branch) || m.sender_name === user?.name);
  const pendingApprovalsRaw = borrowMovements.filter(m => (isAdmin || m.from_location === user?.branch) && (m.status === 'Pending Approval' || m.status === 'Pending Borrow Approval' || m.status === 'Return Pending Approval' || m.status === 'Pending Return Approval'));
  const incomingReturnsRaw = borrowMovements.filter(m => (isAdmin || m.from_location === user?.branch) && (m.status === 'Return In Transit' || m.status === 'Returning'));

  const myRequests = groupMovements(myRequestsRaw);
  const pendingApprovals = groupMovements(pendingApprovalsRaw);
  const incomingReturns = groupMovements(incomingReturnsRaw);

  const paginatedMyRequests = myRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPagesMyRequests = Math.ceil(myRequests.length / itemsPerPage);

  const allApprovals = [...pendingApprovals, ...incomingReturns];
  const paginatedApprovals = allApprovals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPagesApprovals = Math.ceil(allApprovals.length / itemsPerPage);

  const renderPagination = (current, total, setPage) => {
    const pages = [];
    const maxVisible = 5;

    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, '...', total);
      } else if (current > total - 3) {
        pages.push(1, '...', total - 3, total - 2, total - 1, total);
      } else {
        pages.push(1, '...', current - 1, current, current + 1, '...', total);
      }
    }

    return pages.map((p, idx) => (
      <button
        key={idx}
        onClick={() => typeof p === 'number' && setPage(p)}
        disabled={p === '...'}
        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
          p === current
            ? 'bg-[#286086] text-white shadow-md'
            : p === '...'
            ? 'text-slate-400 cursor-default'
            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
        }`}
      >
        {p}
      </button>
    ));
  };

  const handleDeleteMovement = async (trackingCode) => {
    const confirm = await Swal.fire({
      title: 'Apakah Anda yakin?',
      text: `Data pengajuan ${trackingCode} akan dihapus dan tidak dapat dikembalikan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/movements/${trackingCode}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) throw new Error('Gagal menghapus data');
      toast.success('Data berhasil dihapus');
      mutateMovements();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleBorrowSubmit = async (e) => {
    e.preventDefault();
    if (!borrowForm.purpose || !borrowForm.expected_return_date) {
      return Swal.fire('Error', 'Lengkapi semua form pengajuan peminjaman!', 'warning');
    }
    if (borrowForm.purpose === 'Onsite Project' && !borrowForm.onsite_detail) {
      return Swal.fire('Error', 'Harap isi detail lokasi Onsite!', 'warning');
    }

    const finalToLocation = borrowForm.purpose === 'Onsite Project' && borrowForm.onsite_detail 
      ? `${borrowForm.to_location} - ${borrowForm.onsite_detail}` 
      : borrowForm.to_location;

    const finalPurpose = borrowForm.purpose_detail ? `${borrowForm.purpose} - ${borrowForm.purpose_detail}` : borrowForm.purpose;

    const formData = new FormData();
    const tracking_code = `BRW-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    formData.append('tracking_code', tracking_code);
    formData.append('asset_ids', JSON.stringify(selectedAssets.map(a => a.id)));
    formData.append('purpose', finalPurpose);
    formData.append('from_location', selectedAssets[0]?.branch || '');
    formData.append('to_location', finalToLocation);
    formData.append('borrower_name', borrowForm.borrower_name);
    formData.append('expected_return_date', borrowForm.expected_return_date);
    if (borrowForm.proof_image) formData.append('proof_image', borrowForm.proof_image);

    Swal.fire({ title: t('borrowingProcessing'), text: t('uploadingForm'), allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      await api.post('/movements/borrow', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Swal.fire(t('success'), 'Pengajuan peminjaman berhasil dikirim, menunggu persetujuan cabang asal.', 'success');
      api.downloadFile(`/movements/generate-form/${tracking_code}?t=${Date.now()}`, 'Form_Permintaan.docx');
      setIsBorrowModalOpen(false);
      setBorrowForm({ to_location: user?.branch || '', purpose: 'Onclinic', purpose_detail: '', onsite_detail: '', borrower_name: user?.name || '', expected_return_date: '', proof_image: null });
      mutateMovements();
      mutateAssets();
      setActiveTab('my-requests');
    } catch (err) {
      Swal.fire(t('error'), err.response?.data?.detail || t('uploadFailed'), 'error');
    }
  };

  const handleUploadProofSubmit = async (e) => {
    e.preventDefault();
    if (!uploadProofForm.proof_image) return Swal.fire('Error', 'File Dokumen Wajib Diunggah', 'warning');

    const formData = new FormData();
    formData.append('tracking_code', selectedMovement.tracking_code.split('-').slice(0, 3).join('-'));
    formData.append('sender_name', user?.name || 'User');
    formData.append('proof_image', uploadProofForm.proof_image);

    Swal.fire({ title: 'Mengunggah...', text: 'Harap tunggu...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      await api.post('/movements/upload-proof', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Swal.fire('Sukses', 'Dokumen TTD berhasil diunggah! Tiket sekarang aktif menunggu persetujuan.', 'success');
      setIsUploadProofModalOpen(false);
      setUploadProofForm({ proof_image: null });
      mutateMovements();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.detail || 'Gagal mengunggah dokumen', 'error');
    }
  };

  const handleItemDecisionChange = (trackingCode, field, value) => {
    setItemDecisions(prev => ({
      ...prev,
      [trackingCode]: {
        ...prev[trackingCode],
        [field]: value
      }
    }));
  };

  const handleProcessApproval = async (e) => {
    e.preventDefault();
    const decisions = [];
    for (const item of selectedMovement.items) {
      if (item.status !== 'Pending Approval') continue;
      const dec = itemDecisions[item.tracking_code] || { status: 'Approved' };
      if (dec.status === 'Rejected' && (!dec.reason || !dec.reason.trim())) {
        return Swal.fire('Error', `Harap isi alasan penolakan untuk aset ${item.assets?.name}`, 'warning');
      }
      decisions.push({
        tracking_code: item.tracking_code,
        status: dec.status,
        reason: dec.reason || ''
      });
    }

    if (decisions.length === 0) {
      return Swal.fire('Info', 'Tidak ada item yang perlu diproses.', 'info');
    }

    const hasApproval = decisions.some(d => d.status === 'Approved');
    if (hasApproval && !approveForm.proof_image) {
      return Swal.fire('Error', 'Bukti foto pengiriman wajib diunggah karena ada aset yang disetujui untuk dikirim.', 'warning');
    }

    const formData = new FormData();
    formData.append('group_tracking_code', selectedMovement.tracking_code);
    formData.append('approver_name', user?.name || 'Admin');
    formData.append('sender_name', approveForm.sender_name);
    formData.append('decisions_json', JSON.stringify(decisions));
    if (approveForm.proof_image) {
      formData.append('proof_image', approveForm.proof_image);
    }

    Swal.fire({ title: 'Memproses...', text: 'Harap tunggu...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      await api.post('/movements/process_approval', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Swal.fire(t('success'), 'Persetujuan berhasil diproses.', 'success');
      setIsApproveModalOpen(false);
      setItemDecisions({});
      setApproveForm({ sender_name: user?.name || '', proof_image: null });
      mutateMovements();
      mutateAssets();
    } catch(err) {
      Swal.fire(t('error'), t('systemError'), 'error');
    }
  };

  const handleCancelBorrow = async (movement) => {
    const { isConfirmed, value: reason } = await Swal.fire({
      title: 'Batalkan Pengajuan?',
      text: 'Masukkan alasan pembatalan:',
      input: 'text',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Batalkan',
      cancelButtonText: 'Kembali',
      inputValidator: (val) => !val && 'Alasan pembatalan harus diisi!'
    });

    if (isConfirmed) {
      try {
        await api.post('/movements/cancel_borrow', {
          tracking_code: movement.tracking_code,
          approver_name: user?.name || 'Peminjam',
          reason
        });
        Swal.fire('Sukses', 'Pengajuan berhasil dibatalkan', 'success');
        mutateMovements();
        mutateAssets();
      } catch (err) {
        Swal.fire('Error', err.response?.data?.detail || 'Gagal membatalkan pengajuan', 'error');
      }
    }
  };

  const handleReceiveBorrowSubmit = async (e) => {
    e.preventDefault();
    if (!receiveForm.proof_image) return Swal.fire('Error', 'Foto bukti terima wajib diunggah!', 'warning');

    Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
    const formData = new FormData();
    formData.append('tracking_code', selectedMovement.tracking_code);
    formData.append('movement_ids', JSON.stringify(selectedItemIds));
    formData.append('receiver_name', receiveForm.receiver_name || user?.username || user?.fullName || 'Unknown');
    formData.append('proof_image', receiveForm.proof_image);
    
    try {
      await api.post('/movements/receive_borrow', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Swal.fire('Berhasil!', 'Aset telah diterima dan berstatus Sedang Dipinjam.', 'success');
      setIsReceiveModalOpen(false);
      setReceiveForm({ receiver_name: user?.name || '', proof_image: null });
      mutateMovements();
      mutateAssets();
    } catch(err) {
      Swal.fire('Error', 'Gagal menerima aset', 'error');
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnForm.proof_image) {
      return Swal.fire('Error', 'Wajib melampirkan foto serah terima pengembalian.', 'warning');
    }

    const formData = new FormData();
    formData.append('tracking_code', selectedMovement.tracking_code);
    formData.append('movement_ids', JSON.stringify(selectedItemIds));
    formData.append('returner_name', user?.name || 'Unknown');
    formData.append('return_from', returnForm.return_from);
    formData.append('return_to', returnForm.return_to || selectedMovement?.from_location);
    formData.append('notes', returnForm.notes);
    formData.append('proof_image', returnForm.proof_image);

    Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
    try {
      await api.post('/movements/return_borrow', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Swal.fire('Sukses!', 'Proses pengembalian berhasil, menunggu persetujuan dari cabang tujuan.', 'success');
      setIsReturnModalOpen(false);
      setReturnForm({ return_from: user?.branch || '', return_to: '', notes: '', proof_image: null });
      mutateMovements();
      mutateAssets();
    } catch(err) {
      Swal.fire('Error', 'Gagal memproses pengembalian.', 'error');
    }
  };

  const handleCompleteReturnSubmit = async (e) => {
    e.preventDefault();
    if (!completeReturnForm.proof_image) return Swal.fire('Error', 'Foto bukti terima wajib diunggah!', 'warning');

    Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
    const formData = new FormData();
    formData.append('tracking_code', selectedMovement.tracking_code);
    formData.append('movement_ids', JSON.stringify(selectedItemIds));
    formData.append('receiver_name', completeReturnForm.receiver_name || user?.username || user?.fullName || 'Unknown');
    formData.append('proof_image', completeReturnForm.proof_image);
    
    try {
      await api.post('/movements/complete_return', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Swal.fire('Berhasil!', 'Aset telah kembali dengan selamat ke cabang kita.', 'success');
      setIsCompleteReturnModalOpen(false);
      setCompleteReturnForm({ receiver_name: user?.name || '', proof_image: null });
      mutateMovements();
      mutateAssets();
    } catch(err) {
      Swal.fire('Error', 'Gagal menyelesaikan pengembalian', 'error');
    }
  };

  const isUnavailable = (status) => ['Completed', 'In Transit', 'Maintenance', 'Pending Approval', 'Pending Approval'].includes(status);

  return (
    <div className="absolute inset-0 flex flex-col p-4 sm:p-6 lg:p-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center w-full gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm relative z-50 mb-6 shrink-0">
        <div className="flex gap-2 shrink-0 overflow-x-auto w-full lg:w-auto custom-scrollbar pb-1 lg:pb-0 items-center">
          <button 
            onClick={() => { mutateAssets(); mutateMovements(); }} 
            title={t('refreshData') || 'Refresh Data'}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all shrink-0"
          >
            <svg className={`w-4 h-4 ${isMovementsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner ml-2">
            <button onClick={() => setActiveTab('browse')} className={`px-4 py-2 shrink-0 rounded-lg font-bold text-[11px] transition-colors ${activeTab === 'browse' ? 'bg-white text-[#286086] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('searchAssetTab')}</button>
            <button onClick={() => setActiveTab('my-requests')} className={`px-4 py-2 shrink-0 rounded-lg font-bold text-[11px] transition-colors ${activeTab === 'my-requests' ? 'bg-white text-[#286086] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('myRequestsTab')}</button>
            {(['Master Admin', 'Admin System', 'Branch Manager', 'Admin'].includes(user?.role)) && (
              <button onClick={() => setActiveTab('approvals')} className={`px-4 py-2 shrink-0 rounded-lg font-bold text-[11px] transition-colors relative ${activeTab === 'approvals' ? 'bg-white text-[#286086] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {t('approvalsTab')}
                {(pendingApprovals.length + incomingReturns.length) > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] shadow-sm animate-pulse">{pendingApprovals.length + incomingReturns.length}</span>}
              </button>
            )}
          </div>
        </div>
        
        {activeTab === 'browse' && (
          <div className="flex items-center gap-2 w-full lg:w-auto shrink-0 flex-wrap sm:flex-nowrap">
            <div className="relative z-50 flex-1 sm:w-56 min-w-[150px]">
              <div 
                onClick={() => setOpenDropdown(openDropdown === 'branch' ? null : 'branch')}
                className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-4 h-10 font-bold cursor-pointer flex justify-between items-center hover:bg-slate-50 transition-colors w-full shadow-sm"
              >
                <span className={`truncate ${targetBranch ? 'text-slate-800' : 'text-slate-400'}`}>{targetBranch || t('selectBranch')}</span>
                <svg className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform ${openDropdown === 'branch' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
              {openDropdown === 'branch' && (
                <div className="absolute right-0 z-[60] mt-2 w-full sm:w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-[fadeIn_0.1s_ease-out]">
                  <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                    <div className="relative">
                      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="Search branch..." 
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#286086]/20 transition-all font-bold"
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto custom-scrollbar p-1">
                    {mapBranches.filter(b => b.name !== user?.branch && b.name.toLowerCase().includes(branchSearch.toLowerCase())).map(b => (
                      <div 
                        key={b.id || b.name}
                        onClick={() => {
                          setTargetBranch(b.name);
                          setOpenDropdown(null);
                          setBranchSearch('');
                        }}
                        className="px-3 py-2 text-xs text-slate-700 hover:bg-blue-50/50 hover:text-[#286086] rounded-lg cursor-pointer transition-colors font-bold flex items-center justify-between group"
                      >
                        {b.name}
                        {targetBranch === b.name && <svg className="w-3.5 h-3.5 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    ))}
                    {mapBranches.filter(b => b.name !== user?.branch && b.name.toLowerCase().includes(branchSearch.toLowerCase())).length === 0 && (
                      <div className="px-3 py-4 text-xs text-center text-slate-400 font-bold">{t('branchNotFound') || 'Branch not found'}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="relative flex-1 sm:w-56 min-w-[150px] bg-slate-50 p-1 rounded-xl border border-slate-100 shadow-inner flex items-center h-10">
              <svg className="w-4 h-4 absolute left-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input 
                type="text" 
                placeholder={t('searchAssets')} 
                value={searchAsset} 
                onChange={e => setSearchAsset(e.target.value)} 
                className="w-full pl-9 pr-10 py-1 bg-transparent border-none outline-none text-xs font-bold text-slate-700 h-full" 
              />
              <button 
                onClick={() => setIsQRScannerOpen(true)}
                title="Scan QR Code"
                className="absolute right-2 p-1.5 bg-[#286086]/10 text-[#286086] hover:bg-[#286086] hover:text-white rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-1.5m0 0h-3m-1.3 0H4m8 4v-1m-8-4H4m0 0H2.5M4 4h1.5M4 4h3m8-3h-2m-6 0H4m8 4V4m0 4v3m0 4v-1m0 0v-3" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 4h4v4H4zM16 4h4v4h-4zM4 16h4v4H4z" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden flex flex-col relative z-10 min-h-0">
        
        {activeTab === 'browse' && (
          <div className="flex flex-col h-full">

            {selectedAssets.length > 0 && (
              <div className="bg-amber-50 px-4 py-3 border-b border-amber-100 flex items-center justify-between animate-[fadeIn_0.3s_ease-out]">
                <div className="text-sm text-amber-800 font-bold">
                  {selectedAssets.length} Aset Terpilih (dari {selectedAssets[0]?.branch})
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedAssets([])} className="text-xs font-bold text-amber-700 hover:text-amber-900 px-3 py-1.5 transition-colors">Batal</button>
                  <button onClick={() => setIsBorrowModalOpen(true)} className="bg-[#f59e0b] hover:bg-[#d97706] text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow transition-colors">
                    Borrow Selected ({selectedAssets.length})
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      {/* Checkbox Placeholder */}
                    </th>
                    <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('assetId')}</th>
                    <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('assetName')}</th>
                    <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('originBranch')}</th>
                    <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map(asset => {
                    const disabled = isUnavailable(asset.status) || (selectedAssets.length > 0 && asset.branch !== selectedAssets[0].branch);
                    const isChecked = selectedAssets.some(a => a.id === asset.id);
                    return (
                      <tr key={asset.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${disabled && !isChecked ? 'opacity-60 bg-slate-50' : ''}`}>
                        <td className="p-4">
                          <input 
                            type="checkbox" 
                            disabled={disabled && !isChecked}
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedAssets([...selectedAssets, asset]);
                              else setSelectedAssets(selectedAssets.filter(a => a.id !== asset.id));
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="p-4 font-mono text-sm font-bold text-slate-600">{asset.id}</td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800 text-sm">{asset.name}</div>
                          <div className="text-xs text-slate-500">{asset.category}</div>
                        </td>
                        <td className="p-4 font-bold text-slate-600 text-sm">{asset.branch}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                            asset.status === 'Active' || asset.status === 'Deployed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            asset.status === 'Completed' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                            'bg-amber-50 text-amber-600 border-amber-200'
                          }`}>{asset.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                  {!targetBranch && (
                    <tr>
                      <td colSpan="5" className="text-center py-16 px-4">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center shadow-inner">
                            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                          </div>
                          <div>
                             <p className="text-sm font-bold text-slate-600">{t('selectBranchFirstPls')}</p>
                             <p className="text-[11px] text-slate-400 mt-0.5">{t('selectBranchFirstPlsDesc')}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {targetBranch && currentItems.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-16 px-4">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center shadow-inner">
                            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                          </div>
                          <div>
                             <p className="text-sm font-bold text-slate-600">{t('noAssetsInBranch')}</p>
                             <p className="text-[11px] text-slate-400 mt-0.5">{t('noAssetsInBranchDesc')}</p>
                          </div>
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
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('trackingCode')}</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('asset')}</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('originBranch')}</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('status')}</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMyRequests.map(mov => (
                  <tr key={mov.id} className={`border-b hover:bg-slate-50/50 ${mov.status === 'In Transit' ? 'bg-yellow-50/80 border-l-4 border-l-yellow-400 border-slate-50' : mov.status === 'Return In Transit' ? 'bg-orange-50/80 border-l-4 border-l-orange-400 border-slate-50' : 'border-slate-50'}`}>
                    <td className="p-4 font-mono text-sm font-bold text-[#286086]">
                      {mov.tracking_code}
                      <div className="mt-2 flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-sans font-medium bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded shadow-sm w-fit">
                          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Req: {formatDateTime(mov.created_at)}
                        </div>
                        {(() => {
                          const updInfo = getUpdateStatusInfo(mov);
                          if (!updInfo.time) return null;
                          return (
                            <div className="flex items-center gap-1.5 text-[10px] text-blue-600 font-sans font-medium bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded shadow-sm w-fit">
                              <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              {updInfo.shortLabel} {formatDateTime(updInfo.time)}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-700">
                      {mov.items.length === 1 ? mov.items[0].assets?.name : `${mov.items.length} Asset(s)`}
                      <br/>
                      <span className="text-xs text-slate-400 font-mono truncate block max-w-[200px]" title={mov.items.map(i => i.assets?.name).join(', ')}>
                        {mov.items.length === 1 ? mov.items[0].asset_id : mov.items.map(i => i.assets?.name).join(', ')}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-600">{mov.from_location}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${mov.status === 'Requested' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>{mov.status}</span>
                    </td>
                    <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <div className="relative group/action">
                          <button onClick={() => { setSelectedMovement(mov); setIsDetailModalOpen(true); }} className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                          <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Detail</div>
                        </div>
                        {mov.items?.[0]?.sender_proof_url ? (
                          <>
                            <div className="relative group/action">
                              <button onClick={() => window.open(mov.items[0].sender_proof_url, '_blank')} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></button>
                              <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Lihat Form</div>
                            </div>
                            <div className="relative group/action">
                              <button onClick={() => api.downloadFile(`/movements/generate-form/${mov.tracking_code}?t=${Date.now()}`, 'Form_Permintaan.docx')} className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                              <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Revisi Form</div>
                            </div>
                          </>
                        ) : (
                          <div className="relative group/action">
                            <button onClick={() => api.downloadFile(`/movements/generate-form/${mov.tracking_code}?t=${Date.now()}`, 'Form_Permintaan.docx')} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg></button>
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Print Form</div>
                          </div>
                        )}
                        {mov.items?.some(i => i.status === 'Requested') && (
                          <div className="relative group/action">
                            <button onClick={() => { setSelectedMovement(mov); setIsUploadProofModalOpen(true); }} className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg></button>
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Upload TTD</div>
                          </div>
                        )}
                        {(mov.items?.some(i => i.status === 'Pending Approval' || i.status === 'Requested')) && (
                          <div className="relative group/action">
                            <button onClick={() => handleCancelBorrow(mov)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Cancel</div>
                          </div>
                        )}
                        {mov.items?.some(i => i.status === 'In Transit') && (
                          <div className="relative group/action">
                            <button onClick={() => { setSelectedMovement(mov); setReceiveForm(prev => ({...prev, receiver_name: user?.username || user?.fullName || ''})); setIsReceiveModalOpen(true); }} className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg></button>
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">{t('receiveBorrowBtn')}</div>
                          </div>
                        )}
                        {mov.items?.some(i => i.status === 'Received' || i.status === 'Borrowed') && (
                          <div className="relative group/action">
                            <button onClick={() => { setSelectedMovement(mov); setIsReturnModalOpen(true); }} className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">{t('returnAssetBtn')}</div>
                          </div>
                        )}
                        {canDelete && (
                          <div className="relative group/action">
                            <button onClick={() => handleDeleteMovement(mov.tracking_code)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Delete</div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedMyRequests.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-16 px-4">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center shadow-inner">
                          <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <div>
                           <p className="text-sm font-bold text-slate-600">{t('noBorrowHistory')}</p>
                           <p className="text-[11px] text-slate-400 mt-0.5">{t('noBorrowHistoryDesc')}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {totalPagesMyRequests > 1 && (
              <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white sticky bottom-0">
                <span className="text-xs font-semibold text-slate-500 text-center sm:text-left">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, myRequests.length)} of {myRequests.length} entries
                </span>
                <div className="flex gap-1.5 items-center overflow-x-auto max-w-full custom-scrollbar pb-1 sm:pb-0 px-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0">Previous</button>
                  {renderPagination(currentPage, totalPagesMyRequests, setCurrentPage)}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPagesMyRequests, p + 1))} disabled={currentPage === totalPagesMyRequests} className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0">Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('trackingCode')}</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('sender')}</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('asset')}</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('status')}</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedApprovals.map(mov => (
                  <tr key={mov.id} className={`border-b hover:bg-slate-50/50 ${mov.status === 'In Transit' ? 'bg-yellow-50/80 border-l-4 border-l-yellow-400 border-slate-50' : mov.status === 'Return In Transit' ? 'bg-orange-50/80 border-l-4 border-l-orange-400 border-slate-50' : 'border-slate-50'}`}>
                    <td className="p-4 font-mono text-sm font-bold text-[#286086]">
                      {mov.tracking_code}
                      <div className="mt-2 flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-sans font-medium bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded shadow-sm w-fit">
                          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Req: {formatDateTime(mov.created_at)}
                        </div>
                        {(() => {
                          const updInfo = getUpdateStatusInfo(mov);
                          if (!updInfo.time) return null;
                          return (
                            <div className="flex items-center gap-1.5 text-[10px] text-blue-600 font-sans font-medium bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded shadow-sm w-fit">
                              <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              {updInfo.shortLabel} {formatDateTime(updInfo.time)}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-700">{mov.sender_name}<br/><span className="text-xs text-slate-400">{mov.to_location}</span></td>
                    <td className="p-4 text-sm font-bold text-slate-700">
                      {mov.items.length === 1 ? mov.items[0].assets?.name : `${mov.items.length} Asset(s)`}
                      <br/>
                      <span className="text-xs text-slate-400 font-mono truncate block max-w-[200px]" title={mov.items.map(i => i.assets?.name).join(', ')}>
                        {mov.items.length === 1 ? mov.items[0].asset_id : mov.items.map(i => i.assets?.name).join(', ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-2 items-start">
                        <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border bg-amber-50 text-amber-600 border-amber-200">{mov.status}</span>
                        {mov.items?.[0]?.expected_return_date && mov.status === 'Completed' && (
                          <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-600">Est. Return:</span>
                            <span>{new Date(mov.items[0].expected_return_date).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})}</span>
                            <div className="mt-0.5">{getDaysLeft(mov.items[0].expected_return_date)}</div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <div className="relative group/action">
                          <button onClick={() => { setSelectedMovement(mov); setIsDetailModalOpen(true); }} className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                          <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Detail</div>
                        </div>
                        {mov.items?.[0]?.sender_proof_url && (
                          <div className="relative group/action">
                            <button onClick={() => window.open(mov.items[0].sender_proof_url, '_blank')} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></button>
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Lihat Form</div>
                          </div>
                        )}
                        {(mov.items?.some(i => i.status === 'Pending Approval' || i.status === 'Return Pending Approval')) && (
                          <div className="relative group/action">
                            <button onClick={() => { setSelectedMovement(mov); setApproveForm(prev => ({...prev, sender_name: user?.username || user?.fullName || ''})); setIsApproveModalOpen(true); }} className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Review Persetujuan</div>
                          </div>
                        )}
                        {mov.items?.some(i => i.status === 'Return In Transit') && (
                          <div className="relative group/action">
                            <button onClick={() => { setSelectedMovement(mov); setCompleteReturnForm(prev => ({...prev, receiver_name: user?.username || user?.fullName || ''})); setIsCompleteReturnModalOpen(true); }} className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg></button>
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Konfirmasi Terima Balik</div>
                          </div>
                        )}
                        {canDelete && (
                          <div className="relative group/action">
                            <button onClick={() => handleDeleteMovement(mov.tracking_code)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Delete</div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedApprovals.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-16 px-4">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center shadow-inner">
                          <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        </div>
                        <div>
                           <p className="text-sm font-bold text-slate-600">Tidak ada persetujuan yang tertunda</p>
                           <p className="text-[11px] text-slate-400 mt-0.5">Semua permintaan telah diproses.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {totalPagesApprovals > 1 && (
              <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white sticky bottom-0">
                <span className="text-xs font-semibold text-slate-500 text-center sm:text-left">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, allApprovals.length)} of {allApprovals.length} entries
                </span>
                <div className="flex gap-1.5 items-center overflow-x-auto max-w-full custom-scrollbar pb-1 sm:pb-0 px-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0">Previous</button>
                  {renderPagination(currentPage, totalPagesApprovals, setCurrentPage)}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPagesApprovals, p + 1))} disabled={currentPage === totalPagesApprovals} className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0">Next</button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* BORROW MODAL */}
      <BaseModal isOpen={isBorrowModalOpen} onClose={() => setIsBorrowModalOpen(false)} title="Loan Asset Form (Temporary)" maxWidth="max-w-4xl">
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-xs font-bold mb-6">
          IMPORTANT: This form is used for temporary asset loan. The origin (Home Branch) of the asset will not change.
        </div>
        <form onSubmit={handleBorrowSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Origin Branch</label>
              <select value={selectedAssets[0]?.branch || ''} disabled className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm outline-none opacity-80 cursor-not-allowed">
                <option value={selectedAssets[0]?.branch || ''}>{selectedAssets[0]?.branch || ''}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">To Location</label>
              <select value={borrowForm.to_location} onChange={e => setBorrowForm({...borrowForm, to_location: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500">
                <option value="">-- Select Destination Branch --</option>
                <option value={user?.branch}>{user?.branch}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Asset yang dipinjam</label>
            <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 font-bold opacity-80 max-h-[100px] overflow-y-auto">
              <ul className="list-disc pl-5">
                {selectedAssets.map(asset => (
                  <li key={asset.id}>{asset.id} - {asset.name} ({asset.category})</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Purpose</label>
              <select value={borrowForm.purpose} onChange={e => setBorrowForm({...borrowForm, purpose: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500">
                <option value="Onclinic">Onclinic</option>
                <option value="Onsite Project">Onsite Project</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Purpose Detail</label>
              <input required type="text" value={borrowForm.purpose_detail} onChange={e => setBorrowForm({...borrowForm, purpose_detail: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="Detail" />
            </div>
            
            {borrowForm.purpose === 'Onsite Project' && (
              <div className="md:col-span-2 animate-[fadeIn_0.3s_ease-out]">
                <label className="block text-xs font-bold text-slate-700 mb-1">Onsite Project Detail (Client / Location)</label>
                <input required type="text" value={borrowForm.onsite_detail} onChange={e => setBorrowForm({...borrowForm, onsite_detail: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="Misal: PT Cikarang Utama" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Borrower Name (Peminjam)</label>
              <input required type="text" value={borrowForm.borrower_name} onChange={e => setBorrowForm({...borrowForm, borrower_name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="Nama Anda" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Est. Return Date</label>
              <Flatpickr 
                value={borrowForm.expected_return_date} 
                onChange={([date]) => setBorrowForm({...borrowForm, expected_return_date: date ? date.toLocaleDateString('en-CA') : ''})} 
                options={{ dateFormat: "Y-m-d", minDate: "today" }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                placeholder="Select Date"
              />
            </div>
          </div>


          <div className="flex justify-end pt-4 gap-3 mt-6">
            <button type="button" onClick={() => setIsBorrowModalOpen(false)} className="px-5 py-2 font-bold text-sm text-slate-500 rounded-lg hover:bg-slate-100 transition-colors">Batal</button>
            <button type="submit" className="px-5 py-2 font-bold text-sm bg-[#f59e0b] text-white rounded-lg shadow hover:bg-[#d97706] transition-colors">Process Asset Loan</button>
          </div>
        </form>
      </BaseModal>

      {/* APPROVE MODAL */}
      <BaseModal isOpen={isApproveModalOpen} onClose={() => setIsApproveModalOpen(false)} title="Persetujuan Peminjaman Aset" maxWidth="max-w-4xl">
        <form onSubmit={handleProcessApproval} className="space-y-4">
          <div>
            <p className="text-sm text-slate-600"><strong>Peminjam:</strong> {selectedMovement?.sender_name} (di {selectedMovement?.to_location})</p>
            <p className="text-sm text-slate-600"><strong>Pemilik Aset (Home Branch):</strong> <span className="font-bold text-indigo-600">{selectedMovement?.items?.[0]?.assets?.branch || '-'}</span></p>
            <p className="text-sm text-slate-600"><strong>Alasan Peminjaman:</strong> {selectedMovement?.purpose}</p>
            {selectedMovement?.items?.[0]?.purpose_detail?.startsWith('ROADSHOW:') && (
              <p className="text-sm text-amber-700 font-semibold bg-amber-50 inline-block px-2 py-1 mt-1 rounded border border-amber-200">
                Permintaan Transfer / Roadshow ke: {selectedMovement.items[0].purpose_detail.split('ROADSHOW:')[1]}
              </p>
            )}
          </div>
          
          {selectedMovement?.items?.[0]?.sender_proof_url && (
            <div className="border border-blue-200 bg-blue-50 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => window.open(selectedMovement.items[0].sender_proof_url)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">Form Permintaan</p>
                  <p className="text-xs text-slate-500">Klik untuk melihat dokumen</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Daftar Barang (Pilih Setuju / Tolak)</label>
            <div className="space-y-3">
              {selectedMovement?.items?.map(item => {
                const dec = itemDecisions[item.tracking_code] || { status: 'Approved' };
                const isPending = item.status === 'Pending Approval';
                return (
                  <div key={item.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-700">{item.assets?.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{item.asset_id} | {item.tracking_code}</p>
                        {!isPending && <p className="text-xs font-bold text-slate-400 mt-1 uppercase">Status: {item.status}</p>}
                      </div>
                      
                      {isPending && (
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name={`status-${item.tracking_code}`} checked={dec.status === 'Approved'} onChange={() => handleItemDecisionChange(item.tracking_code, 'status', 'Approved')} className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold text-emerald-600">Setujui</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name={`status-${item.tracking_code}`} checked={dec.status === 'Rejected'} onChange={() => handleItemDecisionChange(item.tracking_code, 'status', 'Rejected')} className="w-4 h-4 text-red-500" />
                            <span className="text-xs font-bold text-red-600">Tolak</span>
                          </label>
                        </div>
                      )}
                    </div>
                    {isPending && dec.status === 'Rejected' && (
                      <div className="mt-3 animate-[fadeIn_0.3s_ease-out]">
                        <input type="text" placeholder="Alasan penolakan..." value={dec.reason || ''} onChange={(e) => handleItemDecisionChange(item.tracking_code, 'reason', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:border-red-500 outline-none" required />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pengirim (Yang Mengerjakan)</label>
              <input type="text" value={approveForm.sender_name} onChange={(e) => setApproveForm({...approveForm, sender_name: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Bukti Foto Sebelum Dikirim</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Ambil Foto / Upload
                  <input type="file" accept="image/*" onChange={(e) => setApproveForm({...approveForm, proof_image: e.target.files[0]})} className="hidden" />
                </label>
                {approveForm.proof_image && (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1.5 rounded-md border border-emerald-200 truncate max-w-[200px]">
                    {approveForm.proof_image.name}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Wajib diunggah jika ada item yang disetujui (sebagai bukti aset siap dikirim).</p>
            </div>
          </div>

          <div className="flex justify-end pt-4 gap-3 mt-6 border-t border-slate-100">
            <button type="button" onClick={() => setIsApproveModalOpen(false)} className="px-5 py-2 font-bold text-sm text-slate-500 rounded-lg hover:bg-slate-100 transition-colors">Batal</button>
            <button type="submit" className="px-5 py-2 font-bold text-sm bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors">Simpan Keputusan</button>
          </div>
        </form>
      </BaseModal>

      {/* RETURN MODAL */}
      <BaseModal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} title="Form Pengembalian Aset Pinjaman" maxWidth="max-w-4xl">
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 text-sm">
            Pastikan Anda telah membersihkan aset dan mengembalikannya ke kondisi semula. Aset akan dikirimkan kembali ke <strong>{selectedMovement?.from_location}</strong> atau cabang tujuan lain.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Pilih Aset yang Dikembalikan</label>
            <div className="space-y-2 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2">
              {selectedMovement?.items?.filter(item => item.status === 'Completed').map(item => (
                <label key={item.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedItemIds.includes(item.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedItemIds([...selectedItemIds, item.id]);
                      else setSelectedItemIds(selectedItemIds.filter(id => id !== item.id));
                    }}
                    className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-700">{item.assets?.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{item.asset_id} | Status: {item.status}</p>
                  </div>
                </label>
              ))}
            </div>
            {selectedItemIds.length === 0 && <p className="text-xs text-red-500 mt-1">Pilih minimal 1 aset.</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi Aset Saat Ini (Beda Onsite / Klinik?)</label>
            <input required type="text" value={returnForm.return_from} onChange={e => setReturnForm({...returnForm, return_from: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" placeholder="Misal: Onsite Project ABC atau Di Klinik Karawang" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Cabang Tujuan Pengembalian</label>
            <select required value={returnForm.return_to || selectedMovement?.from_location || ''} onChange={e => setReturnForm({...returnForm, return_to: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500">
              {mapBranches?.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">Akan dialihkan dan membutuhkan persetujuan (approval) dari cabang tujuan.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Pengembalian</label>
            <textarea rows="2" value={returnForm.notes} onChange={e => setReturnForm({...returnForm, notes: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" placeholder="Catatan kondisi alat atau kelengkapan..." />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Foto Dokumentasi Kondisi Saat Dikembalikan (Wajib)</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Ambil Foto / Upload
                <input required type="file" accept="image/*" onChange={e => setReturnForm({...returnForm, proof_image: e.target.files[0]})} className="hidden" />
              </label>
              {returnForm.proof_image && (
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1.5 rounded-md border border-amber-200 truncate max-w-[200px]">
                  {returnForm.proof_image.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 gap-3">
            <button type="button" onClick={() => setIsReturnModalOpen(false)} className="px-5 py-2 font-bold text-sm text-slate-500 rounded-lg hover:bg-slate-100">Batal</button>
            <button type="submit" className="px-5 py-2 font-bold text-sm bg-amber-500 text-white rounded-lg shadow hover:bg-amber-600">Kirim Kembali Aset</button>
          </div>
        </form>
      </BaseModal>

      {/* UPLOAD PROOF MODAL */}
      <BaseModal isOpen={isUploadProofModalOpen} onClose={() => setIsUploadProofModalOpen(false)} title="Upload Dokumen Tanda Tangan" maxWidth="max-w-md">
        <form onSubmit={handleUploadProofSubmit} className="space-y-4">
          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-200 text-sm">
            Silakan unggah foto/scan formulir yang telah ditandatangani untuk tiket <strong>{selectedMovement?.tracking_code}</strong>.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Dokumen Form (Wajib)</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Ambil Foto / Upload
                <input required type="file" accept="image/*,application/pdf" onChange={e => setUploadProofForm({proof_image: e.target.files[0]})} className="hidden" />
              </label>
              {uploadProofForm.proof_image && (
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1.5 rounded-md border border-blue-200 truncate max-w-[200px]">
                  {uploadProofForm.proof_image.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 gap-3">
            <button type="button" onClick={() => setIsUploadProofModalOpen(false)} className="px-5 py-2 font-bold text-sm text-slate-500 rounded-lg hover:bg-slate-100">Batal</button>
            <button type="submit" className="px-5 py-2 font-bold text-sm bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700">Upload Dokumen</button>
          </div>
        </form>
      </BaseModal>

      {/* DETAIL MODAL */}
      <BaseModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Detail Peminjaman Aset" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-600"><strong>Peminjam:</strong> {selectedMovement?.sender_name} (di {selectedMovement?.to_location})</p>
            <p className="text-sm text-slate-600"><strong>Pemilik Aset (Home Branch):</strong> <span className="font-bold text-indigo-600">{selectedMovement?.items?.[0]?.assets?.branch || '-'}</span></p>
            <p className="text-sm text-slate-600"><strong>Alasan:</strong> {selectedMovement?.purpose}</p>
            {selectedMovement?.items?.[0]?.purpose_detail?.startsWith('ROADSHOW:') && (
              <p className="text-sm text-amber-700 font-semibold bg-amber-50 inline-block px-2 py-1 mt-1 rounded border border-amber-200">
                Transfer / Roadshow ke: {selectedMovement.items[0].purpose_detail.split('ROADSHOW:')[1]}
              </p>
            )}
          </div>



          {(() => {
            if (!selectedMovement?.items || selectedMovement.items.length === 0) return null;
            
            // Group items by identical timelines
            const groupedTimelines = [];
            selectedMovement.items.forEach(item => {
              const logSignature = item.movement_logs?.map(l => l.status_update + l.description).join('|') || 'empty';
              const existingGroup = groupedTimelines.find(g => g.logSignature === logSignature);
              if (existingGroup) {
                existingGroup.items.push(item);
              } else {
                groupedTimelines.push({
                  logSignature,
                  items: [item],
                  logs: item.movement_logs || [],
                  id: item.id
                });
              }
            });

            return (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-700 mb-4">Riwayat Perjalanan Aset & Dokumentasi</label>
                <div className="space-y-6">
                  {groupedTimelines.map((group, groupIdx) => {
                    const isVisible = expandedGroups[groupIdx] !== undefined ? expandedGroups[groupIdx] : groupedTimelines.length <= 2;
                    return (
                      <div key={groupIdx} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <div className="mb-4 pb-3 border-b border-slate-200 flex justify-between items-start gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daftar Aset ({group.items.length})</span>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shadow-sm ${group.items[0].status === 'Rejected' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-600'}`}>
                                {group.items[0].status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 font-medium leading-relaxed max-w-2xl">
                              {group.items.map(item => `${item.assets?.name} (${item.asset_id})`).join(', ')}
                            </p>
                            {group.items[0].status === 'Rejected' && (
                              <div className="mt-2 w-full">
                                <p className="text-[11px] text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 italic inline-block">
                                  Ditolak: {group.items.find(i => i.status === 'Rejected')?.reason || group.items[0].movement_logs?.find(l => l.status_update === 'Ditolak')?.description?.split('Alasan: ')?.[1] || 'Tanpa alasan'}
                                </p>
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => setExpandedGroups(prev => ({...prev, [groupIdx]: !isVisible}))}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors shrink-0 flex items-center gap-1.5 ${isVisible ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white border border-slate-200 text-blue-600 hover:bg-blue-50'}`}
                          >
                            {isVisible ? 'Sembunyikan' : 'Lihat Riwayat'}
                            <svg className={`w-3.5 h-3.5 transition-transform ${isVisible ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </div>
                        
                        {isVisible && (
                          group.logs.length > 0 ? (
                            <div className="relative border-l-2 border-slate-200 ml-3 pl-6 space-y-5 animate-[fadeIn_0.2s_ease-out]">
                          {group.logs.map((log, index) => {
                            const isLatest = index === 0;
                            let dotColor = "bg-slate-400";
                            const status = log.status_update || '';
                            if (status.includes('Selesai')) dotColor = "bg-indigo-500";
                            else if (status.includes('Ditolak')) dotColor = "bg-rose-500";
                            else if (status.includes('Diterima')) dotColor = "bg-teal-500";
                            else if (status.includes('Dikembalikan') || status.includes('Pengembalian')) dotColor = "bg-amber-500";
                            else if (status.includes('Disetujui') || status.includes('Dikirim') || status.includes('Dispatched')) dotColor = "bg-emerald-500";
                            else if (status.includes('Persetujuan') || status.includes('TTD') || status.includes('Pending')) dotColor = "bg-blue-500";

                            return (
                              <div key={index} className="relative group">
                                <div className={`absolute -left-[31px] mt-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${dotColor} shadow-sm z-10 transition-transform group-hover:scale-125`}>
                                  {isLatest && <span className={`absolute inset-0 rounded-full animate-ping opacity-75 ${dotColor}`}></span>}
                                </div>
                                <div className={`bg-white border ${isLatest ? 'border-slate-300 shadow-md ring-1 ring-slate-100' : 'border-slate-100 shadow-sm'} p-3.5 rounded-xl hover:border-slate-300 transition-colors`}>
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-1.5">
                                    <h4 className={`text-sm font-bold ${isLatest ? 'text-slate-800' : 'text-slate-600'}`}>{status}</h4>
                                    <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 whitespace-nowrap">
                                      {new Date(log.created_at).toLocaleString('id-ID', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 leading-relaxed mb-2">{log.description}</p>
                                  
                                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                                    {log.updated_by ? (
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                                          <svg className="w-2.5 h-2.5 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-medium">{log.updated_by}</span>
                                      </div>
                                    ) : <div />}
                                    
                                    {log.proof_url && (
                                      <button 
                                        type="button"
                                        onClick={() => window.open(log.proof_url)}
                                        className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                        Lihat Dokumen
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic text-center py-4">Belum ada riwayat pergerakan</p>
                      )
                    )}
                  </div>
                );
              })}
                </div>
              </div>
            );
          })()}

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setIsDetailModalOpen(false)} className="px-5 py-2 font-bold text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">Tutup</button>
          </div>
        </div>
      </BaseModal>

      {/* RECEIVE ASSET MODAL */}
      <BaseModal isOpen={isReceiveModalOpen} onClose={() => setIsReceiveModalOpen(false)} title="Terima Aset Pinjaman" maxWidth="max-w-2xl">
        <form onSubmit={handleReceiveBorrowSubmit} className="space-y-4">
          <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-200 text-sm">
            Tandai bahwa aset untuk tiket <strong>{selectedMovement?.tracking_code}</strong> telah tiba dan diterima dengan baik.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Pilih Aset yang Diterima</label>
            <div className="space-y-2 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2">
              {selectedMovement?.items?.filter(item => item.status === 'In Transit').map(item => (
                <label key={item.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedItemIds.includes(item.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedItemIds([...selectedItemIds, item.id]);
                      else setSelectedItemIds(selectedItemIds.filter(id => id !== item.id));
                    }}
                    className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-700">{item.assets?.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{item.asset_id} | Status: {item.status}</p>
                  </div>
                </label>
              ))}
            </div>
            {selectedItemIds.length === 0 && <p className="text-xs text-red-500 mt-1">Pilih minimal 1 aset.</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nama Penerima</label>
            <input required type="text" value={receiveForm.receiver_name} onChange={e => setReceiveForm({...receiveForm, receiver_name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500" placeholder="Nama Penerima" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Foto Bukti Terima Barang (Wajib)</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Ambil Foto / Upload
                <input required type="file" accept="image/*" onChange={e => setReceiveForm({...receiveForm, proof_image: e.target.files[0]})} className="hidden" />
              </label>
              {receiveForm.proof_image && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded-md border border-emerald-200 truncate max-w-[200px]">
                  {receiveForm.proof_image.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 gap-3">
            <button type="button" onClick={() => setIsReceiveModalOpen(false)} className="px-5 py-2 font-bold text-sm text-slate-500 rounded-lg hover:bg-slate-100">Batal</button>
            <button type="submit" className="px-5 py-2 font-bold text-sm bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700">Konfirmasi Terima</button>
          </div>
        </form>
      </BaseModal>

      {/* COMPLETE RETURN MODAL */}
      <BaseModal isOpen={isCompleteReturnModalOpen} onClose={() => setIsCompleteReturnModalOpen(false)} title="Selesaikan Pengembalian" maxWidth="max-w-2xl">
        <form onSubmit={handleCompleteReturnSubmit} className="space-y-4">
          <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-200 text-sm">
            Tandai bahwa aset untuk tiket <strong>{selectedMovement?.tracking_code}</strong> telah dikembalikan dan tiba di cabang asal.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Pilih Aset yang Diterima Balik</label>
            <div className="space-y-2 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2">
              {selectedMovement?.items?.filter(item => item.status === 'Return In Transit').map(item => (
                <label key={item.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedItemIds.includes(item.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedItemIds([...selectedItemIds, item.id]);
                      else setSelectedItemIds(selectedItemIds.filter(id => id !== item.id));
                    }}
                    className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-700">{item.assets?.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{item.asset_id} | Status: {item.status}</p>
                  </div>
                </label>
              ))}
            </div>
            {selectedItemIds.length === 0 && <p className="text-xs text-red-500 mt-1">Pilih minimal 1 aset.</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nama Penerima (Yang Mengecek)</label>
            <input required type="text" value={completeReturnForm.receiver_name} onChange={e => setCompleteReturnForm({...completeReturnForm, receiver_name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500" placeholder="Nama Penerima" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Foto Bukti Pengembalian Tiba (Wajib)</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Ambil Foto / Upload
                <input required type="file" accept="image/*" onChange={e => setCompleteReturnForm({...completeReturnForm, proof_image: e.target.files[0]})} className="hidden" />
              </label>
              {completeReturnForm.proof_image && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded-md border border-emerald-200 truncate max-w-[200px]">
                  {completeReturnForm.proof_image.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 gap-3">
            <button type="button" onClick={() => setIsCompleteReturnModalOpen(false)} className="px-5 py-2 font-bold text-sm text-slate-500 rounded-lg hover:bg-slate-100">Batal</button>
            <button type="submit" className="px-5 py-2 font-bold text-sm bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700">Konfirmasi Pengembalian</button>
          </div>
        </form>
      </BaseModal>

      {/* QR SCANNER */}
      <QRScannerModal 
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScanSuccess={(decodedText) => {
          setSearchAsset(decodedText);
        }}
      />
    </div>
  );
}
