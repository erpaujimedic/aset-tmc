import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import html2pdf from 'html2pdf.js';
import Swal from 'sweetalert2';
import api from '../services/api';
import useI18nStore from '../store/i18nStore';
import useAuthStore from '../store/authStore';
import useSWR from 'swr';
import BaseModal from '../components/ui/BaseModal';
import ShimmerLoader from '../components/ui/ShimmerLoader';
import QRScannerModal from '../components/ui/QRScannerModal';

import { useNavigate, useLocation } from 'react-router-dom';

export default function Assets() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18nStore();
  const { user, hasPermission } = useAuthStore();
  
  const getTranslatedCondition = (condition) => {
    switch(condition) {
      case 'BAGUS & DIGUNAKAN': return t('condGoodInUse') || condition;
      case 'BAGUS & TIDAK DIGUNAKAN': return t('condGoodNotInUse') || condition;
      case 'RUSAK & PERLU PERGANTIAN': return t('condBrokenReplace') || condition;
      case 'RUSAK & PERLU DIMUSNAHKAN': return t('condBrokenDispose') || condition;
      default: return condition;
    }
  };
  
  const canCreate = hasPermission('Asset Management', 'Create');
  const canEdit = hasPermission('Asset Management', 'Edit');
  const canDelete = hasPermission('Asset Management', 'Delete');
  const canImport = hasPermission('Asset Management', 'Import');
  const canExport = hasPermission('Asset Management', 'Export');
  const canPrintBA = hasPermission('Asset Management', 'Print BA');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRegion, setFilterRegion] = useState('All Regions');
  const [filterBranch, setFilterBranch] = useState('All Branches');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [filterDepartment, setFilterDepartment] = useState('All Departments');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [regionSearch, setRegionSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addMode, setAddMode] = useState('single'); // 'single' or 'bulk'
  const [isEditing, setIsEditing] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  
  // Forms
  const [detailTab, setDetailTab] = useState('info'); // info, history, tickets
  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
  const [componentForm, setComponentForm] = useState({ id: '', name: '', serial_number: '', status: 'Bagus', reason: '' });
  const [componentMode, setComponentMode] = useState('add'); // 'add', 'swap'
  
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [printAssets, setPrintAssets] = useState([]);
  const [assetComponents, setAssetComponents] = useState([]);
  const [masterComponents, setMasterComponents] = useState([]);
  
  const getTranslatedAssetStatus = (status) => {
    switch(status) {
      case 'Active': return t('active');
      case 'Deployed': return t('deployed');
      case 'In Transit': return t('inTransit');
      case 'Maintenance': return t('maintenance');
      case 'Retired': return t('retired');
      default: return status;
    }
  };
  
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [assetCalibration, setAssetCalibration] = useState(null);
  const [assetTickets, setAssetTickets] = useState([]);

  const [form, setForm] = useState({
    id: '', name: '', category: '', branch: '', department: '', assignee: '', status: 'Active', details: ''
  });
  const [originalAssetId, setOriginalAssetId] = useState(null);

  // Form Custom Dropdown States
  const [formDropdown, setFormDropdown] = useState(null); // 'branch', 'department'
  const [formDropdownSearch, setFormDropdownSearch] = useState('');

  // Camera States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      Swal.fire('Error', 'Gagal mengakses kamera. Pastikan Anda telah memberikan izin kamera.', 'error');
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(async (blob) => {
        stopCamera();
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        // Use the existing upload flow programmatically
        const formData = new FormData();
        formData.append('file', file);
        
        Swal.fire({ title: 'Mengupload Foto...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
          const res = await api.postForm('/tickets/upload', formData);
          const baseUrl = api.defaults.baseURL ? api.defaults.baseURL.replace(/\/api$/, '') : 'http://127.0.0.1:8000';
          const returnedUrl = res.data.url;
          const fullUrl = returnedUrl.startsWith('http') ? returnedUrl : `${baseUrl}${returnedUrl}`;
          setForm(prev => ({ ...prev, photo_url: fullUrl }));
          Swal.close();
        } catch (err) {
          Swal.fire('Error', 'Gagal mengupload foto', 'error');
        }
      }, 'image/jpeg', 0.8);
    }
  };

  // SWR Fetchers
  const fetcher = url => api.get(url, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' } }).then(res => res.data.data || []);
  const branchFetcher = url => api.get(url, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' } }).then(res => res.data.branches || []);
  const statsFetcher = url => api.get(url, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' } }).then(res => res.data || {});

  const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';
  const isAdminSystem = ['Master Admin', 'Admin System'].includes(user?.role);
  const apiBranchParam = (isAdminSystem || isAllBranch) 
    ? (filterBranch === 'All Branches' ? '' : filterBranch) 
    : (Array.isArray(user?.branch) ? user.branch.join(',') : user?.branch);

  // 1. Fast Load (100 items for instant render)
  const { data: fastAssets = [], mutate: mutateFastAssets, isLoading: isFastLoading } = useSWR(
    `/assets?limit=100&branch=${apiBranchParam}&status=${filterStatus === 'All Status' ? '' : filterStatus}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: rawStats = {} } = useSWR(
    `/dashboard/stats?branch=${apiBranchParam}`,
    statsFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  // 2. Background Sync (Full Dataset)
  const [syncedAssets, setSyncedAssets] = React.useState(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  
  React.useEffect(() => {
    let isMounted = true;
    setSyncedAssets(null); // Reset when filters change
    const fetchFull = async () => {
      try {
        const fullData = await fetcher(`/assets?branch=${apiBranchParam}&status=${filterStatus === 'All Status' ? '' : filterStatus}`);
        if (isMounted) setSyncedAssets(fullData);
      } catch(e) {
        console.error("Background sync failed", e);
      }
    };
    // Give UI a moment to render fastAssets before blocking network
    setTimeout(fetchFull, 100);
    return () => { isMounted = false; };
  }, [apiBranchParam, filterStatus]);

  const rawAssets = syncedAssets || fastAssets;
  const isAssetsLoading = !syncedAssets && isFastLoading;

  const mutateAssets = async () => {
    setIsRefreshing(true);
    await mutateFastAssets();
    // Trigger background sync manually
    const fullData = await fetcher(`/assets?branch=${apiBranchParam}&status=${filterStatus === 'All Status' ? '' : filterStatus}`);
    setSyncedAssets(fullData);
    setIsRefreshing(false);
  };

  const assets = React.useMemo(() => {
    const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';
    const isAdminSystem = ['Master Admin', 'Admin System'].includes(user?.role);
    if (isAdminSystem || isAllBranch) return rawAssets;
    return rawAssets.filter(a => {
      if (Array.isArray(user?.branch)) return user.branch.includes(a.branch);
      return a.branch === user?.branch;
    });
  }, [rawAssets, user]);

  const { data: branches = [] } = useSWR('/master/setup-data', branchFetcher, { revalidateOnFocus: false });

  const fetchAssets = () => mutateAssets();

  const handleUploadFile = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('module', 'asset');
    formData.append('asset_code', form.id);
    formData.append('asset_name', form.name);
    formData.append('branch', form.branch);
    
    Swal.fire({
      title: 'Mengupload...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const res = await api.postForm('/tickets/upload', formData);
      const baseUrl = api.defaults.baseURL ? api.defaults.baseURL.replace(/\/api$/, '') : 'http://127.0.0.1:8000';
      const returnedUrl = res.data.url;
      const fullUrl = returnedUrl.startsWith('http') ? returnedUrl : `${baseUrl}${returnedUrl}`;
      
      setForm(prev => ({ ...prev, [fieldName]: fullUrl }));
      Swal.close();
    } catch (error) {
      console.error("Upload failed", error);
      Swal.fire('Upload Gagal', 'Gagal mengupload file', 'error');
    }
    
    // Clear the input value so the same file can be selected again
    e.target.value = '';
  };

  const openAddModal = () => {
    const isAdminSystem = ['Master Admin', 'Admin System'].includes(user?.role);
    setForm({ id: '', name: '', category: '', branch: isAdminSystem ? '' : user?.branch, department: '', assignee: '', status: 'Active', details: '', room: '', condition: 'BAGUS & DIGUNAKAN', photo_url: '', brand: '', serial_number: '', user_name: '', user_phone: '', pr_number: '', placement_location: '', rack_number: '', calibration_doc_url: '', is_labeled: false });
    setIsEditing(false);
    setOriginalAssetId(null);
    setAddMode('single');
    setIsModalOpen(true);
  };

  const getCategoryPrefix = (val) => {
    if (val === 'Furniture') return 'FFF';
    if (val === 'Elektronik' || val === 'Elektronik Non Alat Kesehatan') return 'ELK';
    if (val === 'Elektronik Alat Kesehatan') return 'ALK';
    if (val === 'Kendaraan Roda 2') return 'VH2';
    if (val === 'Kendaraan Roda 4') return 'VH4';
    if (val === 'Hardware') return 'HRW';
    if (val === 'Surat Berharga') return 'LGL';
    if (val === 'Perkakas') return 'PRK';
    return val ? val.substring(0, 3).toUpperCase() : 'AST';
  };

  const handleCategoryChange = (val) => {
    setForm(prev => {
      const newForm = { ...prev, category: val };
      if (!isEditing) {
        // Generate professional ID: [CATEGORY]-[YYMM]-[5 RANDOM DIGITS] for zero collision
        const d = new Date();
        const yymm = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2, '0')}`;
        // Generate random 5 digits
        const randomDigits = Math.floor(10000 + Math.random() * 90000);
        const prefix = getCategoryPrefix(val);
        newForm.id = `${prefix}-${yymm}-${randomDigits}`;
      }
      return newForm;
    });
  };

  const getFullCategoryName = (val) => {
    if (!val) return '';
    const v = val.toUpperCase();
    if (v === 'FFF' || v === 'FURNITURE') return 'Furniture';
    if (v === 'ELK' || v === 'ELEKTRONIK' || v === 'ELEKTRONIK NON ALAT KESEHATAN') return 'Elektronik Non Alat Kesehatan';
    if (v === 'ALK' || v === 'ELEKTRONIK ALAT KESEHATAN') return 'Elektronik Alat Kesehatan';
    if (v === 'VH2' || v === 'KENDARAAN RODA 2') return 'Kendaraan Roda 2';
    if (v === 'VH4' || v === 'KENDARAAN RODA 4') return 'Kendaraan Roda 4';
    if (v === 'HRW' || v === 'HARDWARE') return 'Hardware';
    if (v === 'LGL' || v === 'SURAT BERHARGA') return 'Surat Berharga';
    if (v === 'PRK' || v === 'PERKAKAS') return 'Perkakas';
    return val;
  };

  const openEditModal = (asset) => {
    const assetToEdit = { ...asset };
    assetToEdit.category = getFullCategoryName(asset.category);
    setForm(assetToEdit);
    setIsEditing(true);
    setOriginalAssetId(asset.id);
    setAddMode('single');
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (location.state?.action === 'new') {
      openAddModal();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  const openDetailModal = async (asset) => {
    setSelectedAsset(asset);
    try {
      const [historyRes, calRes, tickRes] = await Promise.all([
        api.get(`/movements/history/${asset.id}`),
        api.get('/calibrations').catch(() => ({ data: { data: [] } })),
        api.get('/tickets').catch(() => ({ data: { data: [] } }))
      ]);
      setHistory(historyRes.data.data || []);
      const cal = calRes.data.data.find(c => c.asset_id === asset.id);
      setAssetCalibration(cal || null);
      
      const ticks = tickRes.data.data.filter(t => t.asset_id === asset.id);
      setAssetTickets(ticks || []);
      setAssetComponents([]); // Reset components initially for speed
    } catch(err) {
      console.error(err);
    }
    setDetailTab('info');
    setIsDetailModalOpen(true);
  };

  const openPrintModal = (asset) => {
    setPrintAssets([asset]);
    setIsPrintModalOpen(true);
  };

  const openBulkPrintModal = () => {
    const assetsToPrint = assets.filter(a => selectedAssetIds.includes(a.id));
    setPrintAssets(assetsToPrint);
    setIsPrintModalOpen(true);
  };

  const handleBulkDelete = async () => {
    if(await Swal.fire({title: t('areYouSure'), text: t('cantRevert'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: t('yesDeleteIt')}).then(res => res.isConfirmed)) {
      try {
        await Promise.all(selectedAssetIds.map(id => api.delete(`/assets/${id}`)));
        Swal.fire(t('deleted'), t('assetDeleted'), 'success');
        setSelectedAssetIds([]);
        fetchAssets();
      } catch (err) {
        Swal.fire(t('error'), t('anErrorOccurred'), 'error');
      }
    }
  };

  const handleQuickAction = (action, asset, isBorrowing = false) => {
    if (action === 'deliveries') {
      navigate('/deliveries', { state: { createForAsset: asset, isBorrowing } });
    } else {
      navigate(`/${action}`, { state: { createForAsset: asset } });
    }
  };

  // Lazy Load Components
  useEffect(() => {
    if (detailTab === 'components' && selectedAsset) {
      api.get(`/assets/${selectedAsset.id}/components`)
        .then(res => setAssetComponents(res.data.data || []))
        .catch(() => setAssetComponents([]));
    }
  }, [detailTab, selectedAsset]);

  // Load Master Components Dictionary once
  useEffect(() => {
    api.get('/master-components')
      .then(res => setMasterComponents(res.data.data || []))
      .catch(console.error);
  }, []);

  const handleBulkGenerateComponent = async () => {
    if (!selectedAsset) return;
    
    // Check if category has a template mapped
    try {
      const templateCheck = await api.get(`/master-components/templates/${selectedAsset.category}`);
      if (!templateCheck.data.data || templateCheck.data.data.length === 0) {
        return Swal.fire('Tidak Ada Template', `Belum ada aturan template komponen untuk kategori "${selectedAsset.category}". Silakan atur di menu Master Components.`, 'info');
      }

      const result = await Swal.fire({
        title: 'Auto-Generate Komponen?',
        html: `Sistem akan menambahkan <b>${templateCheck.data.data.length} macam komponen</b> bawaan untuk kategori <b>${selectedAsset.category}</b> secara otomatis.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#286086',
        confirmButtonText: 'Ya, Generate Sekarang!'
      });

      if (result.isConfirmed) {
        Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res = await api.post('/assets/bulk-components', {
          asset_ids: [selectedAsset.id],
          category_name: selectedAsset.category
        });
        
        // Refresh components list
        const comps = await api.get(`/assets/${selectedAsset.id}/components`);
        setAssetComponents(comps.data.data || []);
        
        Swal.fire('Berhasil', `Berhasil menambahkan ${res.data.inserted} komponen.`, 'success');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal memproses auto-generate komponen.', 'error');
    }
  };

  const handleBulkGenerateComponentMulti = async () => {
    if (selectedAssetIds.length === 0) return;
    
    const result = await Swal.fire({
      title: 'Auto-Generate Multi Asset?',
      html: `Sistem akan mencoba menambahkan komponen bawaan untuk <b>${selectedAssetIds.length} aset</b> secara massal.<br><br><span class="text-xs text-slate-500">Aset yang kategorinya tidak memiliki aturan template akan dilewati.</span>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#286086',
      confirmButtonText: 'Proses Semua!'
    });

    if (result.isConfirmed) {
      Swal.fire({ title: 'Memproses...', text: 'Tergantung jumlah aset, ini mungkin butuh waktu.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      try {
        const selectedAssetObjects = assets.filter(a => selectedAssetIds.includes(a.id));
        const categoryMap = {};
        for(let a of selectedAssetObjects) {
          if (!categoryMap[a.category]) categoryMap[a.category] = [];
          categoryMap[a.category].push(a.id);
        }

        let totalInserted = 0;
        for(let cat in categoryMap) {
           const res = await api.post('/assets/bulk-components', {
             asset_ids: categoryMap[cat],
             category_name: cat
           });
           totalInserted += res.data.inserted || 0;
        }
        
        Swal.fire('Berhasil', `Selesai memproses bulk generate! Total <b>${totalInserted} komponen</b> berhasil ditambahkan ke aset.`, 'success');
        setSelectedAssetIds([]);
        fetchAssets();
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Gagal memproses bulk auto-generate komponen.', 'error');
      }
    }
  };

  const handleAddComponent = () => {
    setComponentForm({ id: '', name: '', serial_number: '', status: 'Bagus', reason: '' });
    setComponentMode('add');
    setIsComponentModalOpen(true);
  };

  const handleSwapComponent = (comp) => {
    setComponentForm({ id: comp.id, name: comp.name, serial_number: '', status: 'Bagus', reason: '' });
    setComponentMode('swap');
    setIsComponentModalOpen(true);
  };

  const handleSaveComponent = async () => {
    if (!componentForm.name && componentMode === 'add') {
      Swal.fire('Error', 'Nama Komponen wajib diisi', 'error');
      return;
    }
    if (!componentForm.serial_number && componentMode === 'swap') {
      Swal.fire('Error', 'Serial Number Baru wajib diisi untuk melakukan Swap', 'error');
      return;
    }
    
    // UI Feedback
    setIsComponentModalOpen(false);
    Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      if (componentMode === 'add') {
        await api.post(`/assets/${selectedAsset.id}/components`, {
          name: componentForm.name,
          serial_number: componentForm.serial_number,
          status: componentForm.status
        });
      } else if (componentMode === 'edit') {
        // Assume API supports editing basic info (if not, we gracefully catch)
        try {
          await api.put(`/components/${componentForm.id}`, {
            name: componentForm.name,
            serial_number: componentForm.serial_number,
            status: componentForm.status
          });
        } catch(e) {
          console.warn("Backend may not have edit endpoint, ignoring edit action.");
        }
      } else if (componentMode === 'swap') {
        await api.put(`/components/${componentForm.id}/swap`, {
          new_serial_number: componentForm.serial_number,
          reason: componentForm.reason
        });
        // refresh history for swap
        api.get(`/movements/history/${selectedAsset.id}`).then(res => setHistory(res.data.data || []));
      }

      // Refresh component list
      const res = await api.get(`/assets/${selectedAsset.id}/components`);
      setAssetComponents(res.data.data || []);
      
      Swal.fire('Berhasil', `Komponen berhasil ${componentMode === 'swap' ? 'di-swap' : 'ditambahkan'}.`, 'success');
    } catch (err) {
      Swal.fire('Error', 'Gagal memproses komponen', 'error');
    }
  };
  const handleEditComponent = (comp) => {
    setComponentForm({ id: comp.id, name: comp.name, serial_number: comp.serial_number || '', status: comp.status || 'Bagus', reason: '' });
    setComponentMode('edit');
    setIsComponentModalOpen(true);
  };

  const handleDeleteComponent = async (id) => {
    if (await Swal.fire({title: 'Hapus Komponen?', text: 'Data tidak dapat dikembalikan', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33'}).then(r => r.isConfirmed)) {
      try {
        await api.delete(`/components/${id}`);
        setAssetComponents(prev => prev.filter(c => c.id !== id));
      } catch (err) {
        Swal.fire('Error', 'Gagal menghapus', 'error');
      }
    }
  };

  const handlePrintLabel = () => {
    Swal.fire({
      title: t('processing') || 'Processing...',
      text: t('generatingLabel') || 'Generating label for printing...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Get the HTML content of the print area
    const printArea = document.getElementById('asset-label-print-area');
    
    // Write perfectly formatted HTML for the 24mm tape
    iframe.contentDocument.write(`<!DOCTYPE html>
      <html>
        <head>
          <style>
            @media print {
              @page { 
                size: 24mm 32mm; 
                margin: 0; 
              }
              html, body {
                width: 24mm;
              }
            }
            html, body { 
              margin: 0; 
              padding: 0; 
              background: white; 
              width: 24mm;
              font-family: Arial, sans-serif;
            }
            .print-label {
              width: 24mm !important;
              height: 31.5mm !important;
              max-height: 31.5mm !important;
              margin: 0 !important;
              padding: 0 !important;
              page-break-inside: avoid;
              overflow: hidden !important; 
            }
            /* Hide browser headers/footers */
            @media print {
              @page { margin: 0; }
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${printArea.innerHTML}
        </body>
      </html>
    `);
    iframe.contentDocument.close();

    // Trigger print
    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      
      // Update is_labeled = true in the backend for all printed assets
      Promise.all(printAssets.map(asset => api.put(`/assets/${asset.id}`, { is_labeled: true })))
        .then(() => fetchAssets())
        .catch(err => console.error("Failed to update labeled status", err));

      setTimeout(() => {
        document.body.removeChild(iframe);
        Swal.close();
        setIsPrintModalOpen(false);
      }, 1000);
    };
  };

  const printBeritaAcara = async (assetsToPrint) => {
    Swal.fire({
      title: t('preparingBA'),
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const currentDate = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const rows = [];
    for (let i = 0; i < assetsToPrint.length; i++) {
      const asset = assetsToPrint[i];

      rows.push({
        asset_id: asset.id,
        no_pr: asset.pr_number || '',
        branch: asset.branch || '',
        nama_asset: asset.name || '',
        serial_number: asset.serial_number || '',
        user: asset.assignee || asset.user_name || '',
        department: asset.department || '',
        is_labeled: asset.is_labeled === true
      });
    }

    try {
      const payload = {
        tanggal: currentDate,
        assets: rows
      };
      
      const response = await api.post('/assets/export-ba', payload, { responseType: 'blob' });
      const contentType = response.headers['content-type'];
      const extension = contentType === 'application/pdf' ? 'pdf' : 'docx';
      
      let codePr = '-';
      let branchName = '-';
      if (assetsToPrint.length > 0) {
        branchName = assetsToPrint[0].branch || '-';
        const assetWithPr = assetsToPrint.find(a => a.pr_number && a.pr_number.trim() !== '');
        if (assetWithPr) codePr = assetWithPr.pr_number;
      }
      // Clean up for filename safety
      codePr = codePr.replace(/[^a-zA-Z0-9-]/g, '_');
      branchName = branchName.replace(/[^a-zA-Z0-9-]/g, '_');
      const filename = `ARSIP_${codePr}_${branchName}.${extension}`;
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      Swal.close();

    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal membuat Berita Acara', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Dual Validation Protection
    if (!form.name || !form.name.trim()) {
      return Swal.fire('Validation Error', 'Asset Name is required', 'warning');
    }
    if (!form.category || !form.category.trim()) {
      return Swal.fire('Validation Error', 'Category is required', 'warning');
    }
    if (!form.branch || !form.branch.trim()) {
      return Swal.fire('Validation Error', 'Branch is required', 'warning');
    }
    if (!form.status || !form.status.trim()) {
      return Swal.fire('Validation Error', 'Status is required', 'warning');
    }
    
    // Optimistic UI mutation
    const newAssets = isEditing 
      ? rawAssets.map(a => a.id === originalAssetId ? { ...a, ...form } : a)
      : [{ ...form, created_at: new Date().toISOString() }, ...rawAssets];
      
    mutateAssets(newAssets, false); // Update locally immediately
    setIsModalOpen(false);

    try {
      if (isEditing) {
        await api.put(`/assets/${originalAssetId}`, form);
        Swal.fire('Success', 'Asset updated!', 'success');
      } else {
        await api.post('/assets', form);
        Swal.fire('Success', 'Asset created!', 'success');
      }
      mutateAssets(); // revalidate
    } catch (err) {
      mutateAssets(); // rollback
      const detail = err.response?.data?.detail;
      const errMsg = Array.isArray(detail) ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ') : (detail || 'An error occurred');
      Swal.fire('Error', errMsg, 'error');
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) return Swal.fire('Error', 'Silakan pilih file Excel terlebih dahulu', 'error');
    
    const formData = new FormData();
    formData.append('file', importFile);
    
    Swal.fire({
      title: 'Memproses Import...',
      text: 'Mohon tunggu, sedang memproses data Excel.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
    
    try {
      const res = await api.postForm('/assets/import', formData);
      Swal.fire('Success', res.data.message || 'Import berhasil!', 'success');
      setIsModalOpen(false);
      setImportFile(null);
      fetchAssets();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.response?.data?.detail || 'Gagal melakukan import data', 'error');
    }
  };

  const handleDelete = async (id) => {
    if(await Swal.fire({title: t('areYouSure'), text: t('cantRevert'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: t('yesDeleteIt')}).then(res => res.isConfirmed)) {
      try {
        await api.delete(`/assets/${id}`);
        Swal.fire(t('deleted'), t('assetDeleted'), 'success');
        fetchAssets();
      } catch (err) {
        Swal.fire(t('error'), err.response?.data?.detail || t('anErrorOccurred'), 'error');
      }
    }
  };

  const handleToggleLabelStatus = async (asset) => {
    try {
      await api.put(`/assets/${asset.id}`, { is_labeled: !asset.is_labeled });
      fetchAssets();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal merubah status label', 'error');
    }
  };

  const handleBulkToggleLabel = async () => {
    try {
      await Promise.all(selectedAssetIds.map(id => api.put(`/assets/${id}`, { is_labeled: true })));
      Swal.fire('Success', 'Aset terpilih berhasil ditandai sebagai sudah dilabelin.', 'success');
      setSelectedAssetIds([]);
      fetchAssets();
    } catch (err) {
      console.error("Bulk update failed:", err);
      Swal.fire('Error', err.response?.data?.detail || 'Gagal update massal', 'error');
    }
  };

  const handleExportExcel = async () => {
    // If assets are selected, export only those, otherwise export filtered.
    const assetsToExport = selectedAssetIds.length > 0 
      ? assets.filter(a => selectedAssetIds.includes(a.id))
      : filteredAssets;

    const headers = ['Asset ID', 'Name', 'Category', 'Branch', 'Department', 'Condition', 'Status', 'Details'];
    const rows = assetsToExport.map(a => [a.id, a.name, a.category, a.branch, a.department, getTranslatedCondition(a.condition), a.status, a.details || '']);
    
    Swal.fire({ title: 'Generating Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
      const response = await api.post('/assets/export-excel', { headers, rows }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'assets_inventory.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      Swal.close();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal mengekspor Excel', 'error');
    }
  };
  const handleDownloadTemplate = async () => {
    Swal.fire({ title: 'Downloading Template...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const response = await api.get('/assets/import-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Asset_Import_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      Swal.close();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal mengunduh template', 'error');
    }
  };

  const filteredAssets = assets.filter(a => {
    const s = searchTerm ? searchTerm.toLowerCase() : '';
    const n = a.name ? a.name.toLowerCase() : '';
    const id = a.id ? String(a.id).toLowerCase() : '';
    const matchSearch = n.includes(s) || id.includes(s);

    let matchRegion = true;
    if (filterRegion !== 'All Regions') {
      const branchInfo = branches.find(b => b.name === a.branch || b.branch_code === a.branch);
      if (!branchInfo || branchInfo.region !== filterRegion) matchRegion = false;
    }
    
    let matchDepartment = filterDepartment === 'All Departments' || a.department === filterDepartment;

    return matchSearch && matchRegion && matchDepartment;
  });

  const regions = [...new Set(branches.map(b => b.region).filter(Boolean))];
  const availableBranches = filterRegion === 'All Regions' ? branches : branches.filter(b => b.region === filterRegion);
  const availableDepartments = [...new Set(assets.map(a => a.department).filter(Boolean))].sort();
  
  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedAssetIds(paginatedAssets.map(a => a.id));
    } else {
      setSelectedAssetIds([]);
    }
  };

  const toggleSelectAsset = (id) => {
    if (selectedAssetIds.includes(id)) {
      setSelectedAssetIds(selectedAssetIds.filter(i => i !== id));
    } else {
      setSelectedAssetIds([...selectedAssetIds, id]);
    }
  };

  const sortedAssets = React.useMemo(() => {
    let sortableItems = [...filteredAssets];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        if (sortConfig.key === 'created_at') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
        } else {
          if (typeof aValue === 'string') aValue = aValue.toLowerCase();
          if (typeof bValue === 'string') bValue = bValue.toLowerCase();
          aValue = aValue || '';
          bValue = bValue || '';
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredAssets, sortConfig]);

  const totalPages = Math.ceil(sortedAssets.length / itemsPerPage);
  const paginatedAssets = sortedAssets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key) => {
    if (sortConfig?.key !== key) {
      return <svg className="w-3 h-3 ml-1 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    }
    if (sortConfig.direction === 'asc') {
      return <svg className="w-3 h-3 ml-1 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>;
    }
    return <svg className="w-3 h-3 ml-1 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>;
  };

  // Reset page to 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterBranch, filterStatus, filterDepartment]);

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

  const hasLocalFilters = searchTerm !== '' || filterRegion !== 'All Regions' || filterBranch !== 'All Branches' || filterStatus !== 'All Status' || filterDepartment !== 'All Departments';
  const useStatsForKpi = !syncedAssets && !hasLocalFilters;

  const kpiTotal = useStatsForKpi ? (rawStats.totalAssets || 0) : assets.length;
  const kpiActive = useStatsForKpi 
    ? ((rawStats.statusDistribution?.find(s => s.name === 'Active')?.value || 0) + (rawStats.statusDistribution?.find(s => s.name === 'Deployed')?.value || 0))
    : assets.filter(a => a.status === 'Active' || a.status === 'Deployed').length;
  const kpiMaint = useStatsForKpi 
    ? (rawStats.maintenance || 0)
    : assets.filter(a => a.status === 'Maintenance').length;

  return (
    <div className="absolute inset-0 flex flex-col p-3 pb-24 md:p-6 lg:p-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="flex flex-col w-full gap-3 mb-4 md:mb-6 shrink-0 z-20">
        
        {/* ROW 1: MAIN TOOLBAR */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center w-full gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm relative z-50">
          
          {/* LEFT: Primary Navigation & KPI */}
          <div className="flex items-center gap-2 relative z-50 flex-1 min-w-0">
            {/* Refresh Button */}
            <button 
              onClick={() => mutateAssets()} 
              title="Refresh Data"
              className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all shrink-0"
            >
              <svg className={`w-4 h-4 ${isAssetsLoading || isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>

            {/* Filters Toggle Button */}
            <button 
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className={`border w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all shrink-0 ${isFiltersOpen ? 'bg-[#286086] border-[#286086] text-white' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'}`}
              title="Toggle Filters"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            </button>



            {/* MINI KPI (Always Visible) */}
            <div className="hidden xl:flex items-center gap-2 px-3 border-l border-slate-200/60 h-8 ml-2">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Total</span>
                <span className="text-[10px] font-extrabold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-100">{kpiTotal}</span>
              </div>
              
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Active</span>
                <span className="text-[10px] font-extrabold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-50">{kpiActive}</span>
              </div>
              
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
                <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">Maint.</span>
                <span className="text-[10px] font-extrabold text-amber-700 bg-white px-1.5 py-0.5 rounded border border-amber-50">{kpiMaint}</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Search & Actions */}
          <div className="flex items-center justify-center sm:justify-start w-full xl:w-auto gap-2 shrink-0 overflow-x-auto custom-scrollbar">
            {/* Search Bar */}
            <div className="relative w-full sm:w-64 shrink-0 bg-slate-50 p-1 rounded-xl border border-slate-100 shadow-inner flex items-center h-10">
              <svg className="w-4 h-4 absolute left-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input 
                type="text" 
                placeholder={t('searchAssets') || 'Search Assets...'} 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
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



            {canCreate && (
              <button 
                onClick={openAddModal} 
                className="bg-[#286086] hover:bg-[#1a4666] text-white px-4 h-10 rounded-xl font-bold text-xs shadow-lg shadow-blue-900/20 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              >
                <span className="text-sm leading-none">+</span> {t('addNewAsset') || 'Add New Asset'}
              </button>
            )}
          </div>
        </div>

        {/* ROW 2: BULK ACTIONS OR EXPANDABLE FILTERS */}
        {selectedAssetIds.length > 0 ? (
          <div className="flex items-center w-full bg-white p-3 rounded-2xl border border-[#286086]/30 shadow-[0_4px_20px_rgba(40,96,134,0.15)] gap-3 animate-[slideDown_0.2s_ease-out] origin-top flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1 bg-[#286086]/10 rounded-xl">
              <span className="text-[#286086] font-black">{selectedAssetIds.length}</span>
              <span className="text-xs font-bold text-[#286086]">Aset Terpilih</span>
            </div>
            
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            
            <button onClick={handleBulkGenerateComponentMulti} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Auto-Generate Komponen
            </button>
            <button onClick={openBulkPrintModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print Barcode
            </button>
            <button onClick={() => printBeritaAcara(assets.filter(a => selectedAssetIds.includes(a.id)))} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Cetak BA
            </button>
            {isAdminSystem && (
              <button onClick={handleBulkToggleLabel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                Tandai Dilabeli
              </button>
            )}

            {canDelete && (
              <button onClick={handleBulkDelete} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Hapus Terpilih
              </button>
            )}
          </div>
        ) : isFiltersOpen ? (
          <div className="flex flex-col lg:flex-row items-center w-full bg-white p-2 rounded-2xl border border-slate-200 shadow-sm gap-2 animate-[slideDown_0.2s_ease-out] origin-top">
            <div className="flex items-center flex-wrap gap-2 w-full lg:w-auto">
              
              {openDropdown && (
                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)}></div>
              )}
              
              {/* Custom Region Dropdown */}
              <div className="relative h-9 bg-slate-50 border border-slate-100 rounded-xl px-3 flex items-center shrink-0">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === 'region' ? null : 'region')}
                  className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold outline-none cursor-pointer flex items-center gap-1.5 transition-colors relative z-50"
                >
                  <span className="truncate max-w-[100px]">{filterRegion === 'All Regions' ? t('allRegions') || 'All Regions' : filterRegion}</span>
                  <svg className={`w-3 h-3 transition-transform ${openDropdown === 'region' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'region' && (
                  <div className="absolute top-full left-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-[fadeIn_0.1s_ease-out] flex flex-col">
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
                        className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterRegion === 'All Regions' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {t('allRegions') || 'All Regions'}
                      </div>
                      {regions.filter(r => r.toLowerCase().includes(regionSearch.toLowerCase())).map(r => (
                        <div 
                          key={r}
                          onClick={() => { setFilterRegion(r); setFilterBranch('All Branches'); setOpenDropdown(null); setRegionSearch(''); }}
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

              {/* Custom Branch Dropdown */}
              <div className="relative h-9 bg-slate-50 border border-slate-100 rounded-xl px-3 flex items-center shrink-0">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === 'branch' ? null : 'branch')}
                  className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold outline-none cursor-pointer flex items-center gap-1.5 transition-colors relative z-50"
                >
                  <span className="truncate max-w-[120px]">{filterBranch === 'All Branches' ? t('allBranches') : filterBranch}</span>
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
                        onClick={() => { setFilterBranch('All Branches'); setOpenDropdown(null); setBranchSearch(''); }}
                        className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterBranch === 'All Branches' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {t('allBranches')}
                      </div>
                      {availableBranches.filter(b => (b.name || b.branch_code).toLowerCase().includes(branchSearch.toLowerCase())).map(b => (
                        <div 
                          key={b.id}
                          onClick={() => { setFilterBranch(b.name || b.branch_code); setOpenDropdown(null); setBranchSearch(''); }}
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

              {/* Custom Department Dropdown */}
              <div className="relative h-9 bg-slate-50 border border-slate-100 rounded-xl px-3 flex items-center shrink-0">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === 'department' ? null : 'department')}
                  className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold outline-none cursor-pointer flex items-center gap-1.5 transition-colors relative z-50"
                >
                  <span className="truncate max-w-[120px]">{filterDepartment === 'All Departments' ? t('allDepartments') || 'All Departments' : filterDepartment}</span>
                  <svg className={`w-3 h-3 transition-transform ${openDropdown === 'department' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'department' && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-[fadeIn_0.1s_ease-out] flex flex-col">
                    <div className="p-2 border-b border-slate-100 bg-slate-50/80 shrink-0">
                      <input 
                        type="text" 
                        placeholder="Search Department..." 
                        value={departmentSearch}
                        onChange={e => setDepartmentSearch(e.target.value)}
                        className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#286086]/50 focus:ring-2 focus:ring-[#286086]/10"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto custom-scrollbar py-1">
                      <div 
                        onClick={() => { setFilterDepartment('All Departments'); setOpenDropdown(null); setDepartmentSearch(''); }}
                        className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterDepartment === 'All Departments' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {t('allDepartments') || 'All Departments'}
                      </div>
                      {availableDepartments.filter(d => d.toLowerCase().includes(departmentSearch.toLowerCase())).map((d, idx) => (
                        <div 
                          key={idx}
                          onClick={() => { setFilterDepartment(d); setOpenDropdown(null); setDepartmentSearch(''); }}
                          className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors truncate ${filterDepartment === d ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                          title={d}
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Status Dropdown */}
              <div className="relative h-9 bg-slate-50 border border-slate-100 rounded-xl px-3 flex items-center shrink-0">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                  className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold outline-none cursor-pointer flex items-center gap-1.5 transition-colors relative z-50"
                >
                  <span className="truncate max-w-[100px]">{filterStatus === 'All Status' ? t('allStatus') : getTranslatedAssetStatus(filterStatus)}</span>
                  <svg className={`w-3 h-3 transition-transform ${openDropdown === 'status' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'status' && (
                  <div className="absolute top-full left-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-[fadeIn_0.1s_ease-out]">
                    <div className="py-1">
                      <div 
                        onClick={() => { setFilterStatus('All Status'); setOpenDropdown(null); }}
                        className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterStatus === 'All Status' ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {t('allStatus')}
                      </div>
                      {['Active', 'Deployed', 'In Transit', 'Maintenance', 'Retired'].map(st => (
                        <div 
                          key={st}
                          onClick={() => { setFilterStatus(st); setOpenDropdown(null); }}
                          className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${filterStatus === st ? 'bg-[#286086]/10 text-[#286086]' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          {getTranslatedAssetStatus(st)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {(filterRegion !== 'All Regions' || filterBranch !== 'All Branches' || filterDepartment !== 'All Departments' || filterStatus !== 'All Status') && (
                <button 
                  onClick={() => {
                    setFilterRegion('All Regions');
                    setFilterBranch('All Branches');
                    setFilterDepartment('All Departments');
                    setFilterStatus('All Status');
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
                  onClick={handleExportExcel} 
                  title="Export Excel"
                  className="bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-600 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </button>
              )}
            </div>

          </div>
        ) : null}

      </div>

      <div className="flex-1 bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden flex flex-col relative z-10">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider w-[40px] text-center">
                  <input type="checkbox" onChange={toggleSelectAll} checked={paginatedAssets.length > 0 && selectedAssetIds.length === paginatedAssets.length} className="w-4 h-4 rounded border-slate-300 text-[#286086] focus:ring-[#286086] cursor-pointer" />
                </th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('id')}>
                  <div className="flex items-center">{t('assetId')} {renderSortIcon('id')}</div>
                </th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center">{t('nameAndCategory')} {renderSortIcon('name')}</div>
                </th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('branch')}>
                  <div className="flex items-center">{t('location')} & Dept {renderSortIcon('branch')}</div>
                </th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('condition')}>
                  <div className="flex items-center">{t('condition')} {renderSortIcon('condition')}</div>
                </th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('status')}>
                  <div className="flex items-center">{t('status')} {renderSortIcon('status')}</div>
                </th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isAssetsLoading ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center">
                    <div className="p-4">
                      <ShimmerLoader type="table" rows={5} />
                    </div>
                  </td>
                </tr>
              ) : paginatedAssets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-16 px-4">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center shadow-inner">
                        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      </div>
                      <div>
                         <p className="text-sm font-bold text-slate-600">{t('noAssetsFound')}</p>
                         <p className="text-[11px] text-slate-400 mt-0.5">{t('noAssetsFoundDesc')}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedAssets.map(asset => (
                  <tr key={asset.id} className={`${!asset.is_labeled ? 'bg-yellow-50/70 hover:bg-yellow-100/70' : 'hover:bg-slate-50/50'} transition-colors group relative`}>
                    <td className="px-4 py-3 align-top text-center relative">
                      <input type="checkbox" checked={selectedAssetIds.includes(asset.id)} onChange={() => toggleSelectAsset(asset.id)} className="w-4 h-4 rounded border-slate-300 text-[#286086] focus:ring-[#286086] cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-sm text-slate-500 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {!asset.is_labeled && (
                          <div className="group/tooltip relative flex items-center justify-center">
                            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block bg-slate-800 text-white text-[10px] px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl z-50 animate-[slideUp_0.2s_ease-out] border border-slate-700/50">Belum berlabel</div>
                          </div>
                        )}
                        {asset.id}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-bold text-sm text-slate-800 line-clamp-2 leading-snug group-hover:text-[#286086] transition-colors">{asset.name}</div>
                      <div className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-1 font-medium">{asset.category} {asset.brand ? `- ${asset.brand}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-xs font-bold text-slate-600">{asset.branch}</div>
                      <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{asset.department}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-[10px] font-bold text-slate-600 px-2 py-1 bg-slate-100 rounded-md inline-block">{getTranslatedCondition(asset.condition) || '-'}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest border inline-block ${
                        asset.status === 'Active' || asset.status === 'Deployed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                        asset.status === 'In Transit' ? 'bg-blue-50 text-blue-600 border-blue-200' : 
                        asset.status === 'Maintenance' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {getTranslatedAssetStatus(asset.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {canPrintBA && (
                          <div className="relative group/action">
                            <button onClick={() => printBeritaAcara([asset])} className="text-slate-400 hover:text-[#286086] hover:bg-blue-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Print B.A.</div>
                          </div>
                        )}
                        <div className="relative group/action">
                          <button onClick={() => openPrintModal(asset)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-all">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm13 0h3v3h-3v-3zm-3 3h3v3h-3v-3zm3 3h3v-3h-3v3zm-3-6h3v3h-3v-3z" /></svg>
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Print QR Code</div>
                        </div>
                        {asset.calibration_doc_url && (
                          <div className="relative group/action">
                            <a href={asset.calibration_doc_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-all inline-block">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </a>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Dokumen Kalibrasi</div>
                          </div>
                        )}
                        <div className="relative group/action">
                          <button onClick={() => openDetailModal(asset)} className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">View Details</div>
                        </div>
                        {canEdit && (
                          <div className="relative group/action">
                            <button onClick={() => openEditModal(asset)} className="text-slate-400 hover:text-amber-500 hover:bg-amber-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Edit</div>
                          </div>
                        )}
                        {canDelete && (
                          <div className="relative group/action">
                            <button onClick={() => handleDelete(asset.id)} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/action:block bg-slate-900 text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl z-50">Hapus</div>
                          </div>
                        )}
                        
                        {/* Deep Action Menu */}
                        <div className="relative inline-block text-left ml-1 group/menu">
                          <button className="text-slate-400 hover:text-slate-800 p-1 transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg></button>
                          <div className="absolute right-0 mt-0 w-48 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none hidden group-hover/menu:block z-50 overflow-hidden border border-slate-100">
                            <div className="py-1">
                              <button onClick={() => handleToggleLabelStatus(asset)} className="text-left w-full block px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-amber-600 font-bold transition-colors">
                                {asset.is_labeled ? `⚠️ ${t('markUnlabeled')}` : `✅ ${t('markLabeled')}`}
                              </button>
                              <div className="border-t border-slate-100 my-1"></div>
                              <button onClick={() => handleQuickAction('ticketing', asset)} className="text-left w-full block px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#286086] font-bold transition-colors">🛠️ {t('createTicket')}</button>
                              <button onClick={() => handleQuickAction('calibrations', asset)} className="text-left w-full block px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#286086] font-bold transition-colors">📏 Add Calibration</button>
                              <button onClick={() => handleQuickAction('deliveries', asset, false)} className="text-left w-full block px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 font-bold transition-colors">🚚 {t('permanentMutation')}</button>
                              <button onClick={() => handleQuickAction('deliveries', asset, true)} className="text-left w-full block px-4 py-2.5 text-xs text-[#286086] hover:bg-blue-50 font-bold transition-colors">🔄 {t('loanAsset')}</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/50">
            <span className="text-xs font-semibold text-slate-500 text-center sm:text-left">{t('showingEntries')} {((currentPage - 1) * itemsPerPage) + 1} {t('to')} {Math.min(currentPage * itemsPerPage, filteredAssets.length)} {t('of')} {filteredAssets.length} {t('entries')}</span>
            <div className="flex gap-1.5 items-center overflow-x-auto max-w-full custom-scrollbar pb-1 sm:pb-0 px-1">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0">{t('previous')}</button>
              {renderPagination(currentPage, totalPages, setCurrentPage)}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)} className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0">{t('next')}</button>
            </div>
          </div>
        )}
      </div>

      {/* COMBINED MODAL */}
      <BaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? t('editAsset') : t('addNewAsset')}
        maxWidth="max-w-4xl"
        footer={
          addMode === 'bulk' ? (
            <>
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors">{t('cancel')}</button>
              <button type="submit" form="importAssetForm" className="px-6 py-2.5 text-sm font-bold bg-[#286086] text-white rounded-xl shadow-[0_8px_20px_-6px_rgba(40,96,134,0.5)] hover:bg-[#1a4666] transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Upload & Import
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors">{t('cancel')}</button>
              <button type="submit" form="assetForm" className="px-6 py-2.5 text-sm font-bold bg-[#286086] text-white rounded-xl shadow-[0_8px_20px_-6px_rgba(40,96,134,0.5)] hover:bg-[#1a4666] transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                {t('saveAsset')}
              </button>
            </>
          )
        }
      >
        {!isEditing && (
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setAddMode('single')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${addMode === 'single' ? 'bg-white text-[#286086] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Input Satuan
            </button>
            <button
              type="button"
              onClick={() => setAddMode('bulk')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${addMode === 'bulk' ? 'bg-white text-[#286086] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Import Massal
            </button>
          </div>
        )}

        {addMode === 'bulk' ? (
          <form id="importAssetForm" onSubmit={handleImportSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Upload File (.xlsx)</label>
              <input type="file" accept=".xlsx, .xls" onChange={(e) => setImportFile(e.target.files[0])} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#286086]/10 file:text-[#286086] hover:file:bg-[#286086]/20 transition-colors" required />
            </div>
            <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg border border-blue-100 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p>Pastikan format excel sesuai dengan template master. Header harus berada di baris pertama.</p>
              </div>
              <button type="button" onClick={handleDownloadTemplate} className="self-start mt-1 text-sm font-semibold text-[#286086] hover:text-[#1a4666] underline flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Download Template Excel
              </button>
            </div>
          </form>
        ) : (
          <form id="assetForm" onSubmit={handleSubmit} className="space-y-6">
                
                {/* Section: Basic Info */}
                <div>
                  <h3 className="text-sm font-black text-[#286086] border-b pb-2 mb-4">Informasi Dasar</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Asset ID / Kode Aset *</label>
                      <input required type="text" value={form.id || ''} disabled={isEditing && !isAdminSystem} onChange={e => setForm({...form, id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Nama Asset *</label>
                      <input required type="text" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Kategori Asset *</label>
                      <select required value={form.category || ''} onChange={e => handleCategoryChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none cursor-pointer">
                        <option value="" disabled>Pilih Kategori</option>
                        <option value="Furniture">FFF : Furniture</option>
                        <option value="Elektronik Non Alat Kesehatan">ELK : Elektronik Non Alat Kesehatan</option>
                        <option value="Elektronik Alat Kesehatan">ALK : Elektronik Alat Kesehatan</option>
                        <option value="Kendaraan Roda 2">VH2 : Kendaraan Roda 2</option>
                        <option value="Kendaraan Roda 4">VH4 : Kendaraan Roda 4</option>
                        <option value="Hardware">HRW : Hardware</option>
                        <option value="Surat Berharga">LGL : Surat Berharga</option>
                        <option value="Perkakas">PRK : Perkakas</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Status Sistem *</label>
                      <select value={form.status || 'Active'} onChange={e => setForm({...form, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none cursor-pointer">
                        <option value="Active">{t('active')}</option>
                        <option value="Deployed">{t('deployed')}</option>
                        <option value="Maintenance">{t('maintenance')}</option>
                        <option value="Retired">{t('retired')}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section: Spesifikasi */}
                <div>
                  <h3 className="text-sm font-black text-[#286086] border-b pb-2 mb-4">Spesifikasi Detail</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Merk Barang</label>
                      <input type="text" value={form.brand || ''} onChange={e => setForm({...form, brand: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Serial Number</label>
                      <input type="text" value={form.serial_number || ''} onChange={e => setForm({...form, serial_number: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">No PR</label>
                      <input type="text" value={form.pr_number || ''} onChange={e => setForm({...form, pr_number: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Kondisi *</label>
                      <select required value={form.condition || ''} onChange={e => setForm({...form, condition: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none cursor-pointer">
                        <option value="" disabled>Pilih Kondisi</option>
                        <option value="BAGUS & DIGUNAKAN">{t('condGoodInUse')}</option>
                        <option value="BAGUS & TIDAK DIGUNAKAN">{t('condGoodNotInUse')}</option>
                        <option value="RUSAK & PERLU PERGANTIAN">{t('condBrokenReplace')}</option>
                        <option value="RUSAK & PERLU DIMUSNAHKAN">{t('condBrokenDispose')}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section: Lokasi & Penempatan */}
                <div>
                  <h3 className="text-sm font-black text-[#286086] border-b pb-2 mb-4">Lokasi & Penempatan</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Cabang / Branch *</label>
                      {(['Master Admin', 'Admin System'].includes(user?.role) || isAllBranch) ? (
                        <>
                          <div 
                            onClick={() => setFormDropdown(formDropdown === 'branch' ? null : 'branch')}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none cursor-pointer flex justify-between items-center"
                          >
                            <span className={form.branch ? "text-slate-800" : "text-slate-400"}>
                              {form.branch || "Select Branch"}
                            </span>
                            <svg className={`w-4 h-4 text-slate-400 transition-transform ${formDropdown === 'branch' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                          </div>
                          {formDropdown === 'branch' && (
                            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 flex flex-col">
                              <div className="p-2 border-b border-slate-100 bg-slate-50">
                                <input 
                                  type="text" 
                                  placeholder="Cari Branch..." 
                                  autoFocus
                                  value={formDropdownSearch}
                                  onChange={e => setFormDropdownSearch(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && formDropdownSearch.trim()) {
                                      e.preventDefault();
                                      const matchedBranch = branches.find(b => (b.name || b.branch_code).toLowerCase().includes(formDropdownSearch.trim().toLowerCase()));
                                      if (matchedBranch) {
                                        setForm({ ...form, branch: matchedBranch.name || matchedBranch.branch_code });
                                      } else {
                                        setForm({ ...form, branch: formDropdownSearch.trim() });
                                      }
                                      setFormDropdown(null);
                                      setFormDropdownSearch('');
                                    }
                                  }}
                                  className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none focus:border-[#286086]"
                                />
                              </div>
                              <div className="max-h-48 overflow-y-auto">
                                {branches.filter(b => (b.name || b.branch_code).toLowerCase().includes(formDropdownSearch.toLowerCase())).map(b => (
                                  <div 
                                    key={b.id}
                                    onClick={() => { setForm({ ...form, branch: b.name || b.branch_code }); setFormDropdown(null); setFormDropdownSearch(''); }}
                                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${form.branch === (b.name || b.branch_code) ? 'bg-[#286086]/10 text-[#286086] font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                                  >
                                    {b.name || b.branch_code}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-sm font-semibold text-slate-500 cursor-not-allowed flex items-center gap-2">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                          {user?.branch}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Department *</label>
                      <div 
                        onClick={() => setFormDropdown(formDropdown === 'department' ? null : 'department')}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none cursor-pointer flex justify-between items-center"
                      >
                        <span className={form.department ? "text-slate-800" : "text-slate-400"}>
                          {form.department || "Select Department"}
                        </span>
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${formDropdown === 'department' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                      {formDropdown === 'department' && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 flex flex-col">
                          <div className="p-2 border-b border-slate-100 bg-slate-50">
                            <input 
                              type="text" 
                              placeholder="Cari atau Ketik Department Baru..." 
                              autoFocus
                              value={formDropdownSearch}
                              onChange={e => setFormDropdownSearch(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && formDropdownSearch.trim()) {
                                  e.preventDefault();
                                  setForm({ ...form, department: formDropdownSearch.trim() });
                                  setFormDropdown(null);
                                  setFormDropdownSearch('');
                                }
                              }}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none focus:border-[#286086]"
                            />
                            {formDropdownSearch.trim() && (
                              <button type="button" onClick={() => {
                                setForm({ ...form, department: formDropdownSearch.trim() });
                                setFormDropdown(null);
                                setFormDropdownSearch('');
                              }} className="w-full mt-2 bg-[#286086]/10 text-[#286086] hover:bg-[#286086]/20 font-bold py-1.5 rounded-lg text-xs">
                                + Gunakan "{formDropdownSearch.trim()}"
                              </button>
                            )}
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {/* Derive unique departments from existing assets */}
                            {[...new Set(assets.map(a => a.department).filter(Boolean))]
                              .filter(d => d.toLowerCase().includes(formDropdownSearch.toLowerCase()))
                              .map((d, idx) => (
                                <div 
                                  key={idx}
                                  onClick={() => { setForm({ ...form, department: d }); setFormDropdown(null); setFormDropdownSearch(''); }}
                                  className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${form.department === d ? 'bg-[#286086]/10 text-[#286086] font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                  {d}
                                </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {(form.branch || '').toLowerCase().includes('head office') && (
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Lokasi Penempatan (HO) *</label>
                        <select required value={form.placement_location || ''} onChange={e => setForm({...form, placement_location: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none cursor-pointer">
                          <option value="" disabled>Pilih Lantai/Gudang</option>
                          <option value="Lantai 1">Lantai 1</option>
                          <option value="Lantai 2">Lantai 2</option>
                          <option value="Lantai 3">Lantai 3</option>
                          <option value="Lantai 4">Lantai 4</option>
                          <option value="Lantai 5">Lantai 5</option>
                          <option value="Lantai 6">Lantai 6</option>
                          <option value="Gudang">Gudang / Warehouse</option>
                        </select>
                      </div>
                    )}
                    
                    {form.placement_location === 'Gudang' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Nomor Rak Gudang *</label>
                        <input required type="text" value={form.rack_number || ''} onChange={e => setForm({...form, rack_number: e.target.value})} placeholder="Contoh: RAK-A-12" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
                      </div>
                    )}

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Ruangan *</label>
                      <input required type="text" value={form.room || ''} onChange={e => setForm({...form, room: e.target.value})} placeholder="Nama/Nomor Ruangan spesifik" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
                    </div>
                  </div>
                </div>

                {/* Section: Penanggung Jawab */}
                <div>
                  <h3 className="text-sm font-black text-[#286086] border-b pb-2 mb-4">Pengguna / Penanggung Jawab</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Nama User</label>
                      <input type="text" value={form.user_name || ''} onChange={e => setForm({...form, user_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">No. HP User</label>
                      <input type="text" value={form.user_phone || ''} onChange={e => setForm({...form, user_phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
                    </div>
                  </div>
                </div>

                {/* Section: Lampiran */}
                <div>
                  <h3 className="text-sm font-black text-[#286086] border-b pb-2 mb-4">Dokumen & Lampiran</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">URL Foto Asset *</label>
                      <div className="flex gap-2">
                        <input required type="url" value={form.photo_url || ''} onChange={e => setForm({...form, photo_url: e.target.value})} placeholder="https://..." className="flex-1 w-0 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
                        <label className="bg-white border border-slate-200 hover:border-[#286086] hover:text-[#286086] text-slate-500 px-3 py-2 rounded-lg cursor-pointer transition-all shrink-0 shadow-sm flex items-center justify-center gap-1.5" title="Upload Foto">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <span className="text-xs font-bold hidden sm:inline">Upload</span>
                          <input type="file" accept="image/*" className="hidden" onChange={e => handleUploadFile(e, 'photo_url')} />
                        </label>
                        <button type="button" onClick={startCamera} className="bg-white border border-slate-200 hover:border-[#286086] hover:text-[#286086] text-slate-500 px-3 py-2 rounded-lg cursor-pointer transition-all shrink-0 shadow-sm flex items-center justify-center gap-1.5" title="Ambil Foto">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span className="text-xs font-bold hidden sm:inline">Ambil Foto</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">URL Dokumen Kalibrasi</label>
                      <div className="flex gap-2">
                        <input type="url" value={form.calibration_doc_url || ''} onChange={e => setForm({...form, calibration_doc_url: e.target.value})} placeholder="https://..." className="flex-1 w-0 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none" />
                        <label className="bg-white border border-slate-200 hover:border-[#286086] hover:text-[#286086] text-slate-500 px-3 py-2 rounded-lg cursor-pointer transition-all shrink-0 shadow-sm flex items-center justify-center gap-1.5" title="Upload Dokumen">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <span className="text-xs font-bold hidden sm:inline">Upload</span>
                          <input type="file" accept="*/*" className="hidden" onChange={e => handleUploadFile(e, 'calibration_doc_url')} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

              </form>
        )}
      </BaseModal>

      {/* DETAIL MODAL */}
      <BaseModal
        isOpen={isDetailModalOpen && !!selectedAsset}
        onClose={() => setIsDetailModalOpen(false)}
        maxWidth="max-w-4xl"
        title={
          <>
            {t('assetDetails')}
            {selectedAsset && !selectedAsset.is_labeled && (
              <span className="ml-2 bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-wider font-bold">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                Belum Berlabel
              </span>
            )}
          </>
        }
        headerActions={selectedAsset && (
          <>
            <button onClick={() => { handleToggleLabelStatus(selectedAsset); setIsDetailModalOpen(false); }} className={`text-[10px] font-bold bg-white border border-slate-200 hover:text-amber-600 hover:border-amber-500 px-2 py-1 rounded-lg shadow-sm transition-all flex items-center gap-1 ${selectedAsset.is_labeled ? 'text-slate-600' : 'text-amber-600 border-amber-200'}`}>
              {selectedAsset.is_labeled ? `⚠️ ${t('markUnlabeled')}` : `✅ ${t('markLabeled')}`}
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1"></div>
            <button onClick={() => handleQuickAction('ticketing', selectedAsset)} className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 hover:text-[#286086] hover:border-[#286086] px-2 py-1 rounded-lg shadow-sm transition-all flex items-center gap-1">🛠️ {t('createTicket')}</button>
            <button onClick={() => handleQuickAction('calibrations', selectedAsset)} className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 hover:text-[#286086] hover:border-[#286086] px-2 py-1 rounded-lg shadow-sm transition-all flex items-center gap-1">📏 Add Calibration</button>
            <button onClick={() => handleQuickAction('deliveries', selectedAsset, false)} className="text-[10px] font-bold bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg shadow-sm transition-all flex items-center gap-1">🚚 {t('permanentMutation')}</button>
            <button onClick={() => handleQuickAction('deliveries', selectedAsset, true)} className="text-[10px] font-bold bg-white border border-blue-200 text-[#286086] hover:bg-blue-50 px-2 py-1 rounded-lg shadow-sm transition-all flex items-center gap-1">🔄 {t('loanAsset')}</button>
          </>
        )}
        subheader={selectedAsset && (
          <div className="flex px-6 pt-2 gap-6">
            <button onClick={() => setDetailTab('info')} className={`px-2 py-2 font-bold text-sm border-b-[3px] transition-all ${detailTab === 'info' ? 'border-[#286086] text-[#286086]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{t('tabInfo')}</button>
            <button onClick={() => setDetailTab('components')} className={`px-2 py-2 font-bold text-sm border-b-[3px] transition-all ${detailTab === 'components' ? 'border-[#286086] text-[#286086]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Komponen {assetComponents.length > 0 && <span className="ml-1 bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-[10px]">{assetComponents.length}</span>}</button>
            <button onClick={() => setDetailTab('history')} className={`px-2 py-2 font-bold text-sm border-b-[3px] transition-all ${detailTab === 'history' ? 'border-[#286086] text-[#286086]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{t('tabHistory')}</button>
            <button onClick={() => setDetailTab('calibration')} className={`px-2 py-2 font-bold text-sm border-b-[3px] transition-all ${detailTab === 'calibration' ? 'border-[#286086] text-[#286086]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{t('tabCalibration')}</button>
            <button onClick={() => setDetailTab('tickets')} className={`px-2 py-2 font-bold text-sm border-b-[3px] transition-all ${detailTab === 'tickets' ? 'border-[#286086] text-[#286086]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{t('tabTickets')} {assetTickets.length > 0 && <span className="ml-1 bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full text-[10px]">{assetTickets.length}</span>}</button>
          </div>
        )}
      >
        {selectedAsset && (
          <div className="p-2">
              {detailTab === 'info' && (
                <div className="flex flex-col md:flex-row gap-8 animate-[fadeIn_0.3s_ease-out]">
                  <div className="flex-1 space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID: {selectedAsset.id}</p>
                        <p className="text-2xl font-bold text-slate-800">{selectedAsset.name}</p>
                        <p className="text-sm font-medium text-[#286086] mt-0.5">{selectedAsset.category} {selectedAsset.brand ? `• ${selectedAsset.brand}` : ''}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lokasi Utama</span>
                        <span className="text-sm font-bold text-slate-800">{selectedAsset.branch}</span>
                        <span className="text-xs font-semibold text-[#286086] mt-1">{selectedAsset.department}</span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status Sistem</span>
                        <div>
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black tracking-wider uppercase inline-block ${
                            selectedAsset.status === 'Active' || selectedAsset.status === 'Deployed' ? 'bg-emerald-100 text-emerald-700' : 
                            selectedAsset.status === 'In Transit' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {getTranslatedAssetStatus(selectedAsset.status)}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-600 mt-2 block">Kondisi: {getTranslatedCondition(selectedAsset.condition) || '-'}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-inner">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2 mb-3">Detail Spesifikasi</h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                        <div><span className="text-[10px] text-slate-400 block">Serial Number</span><span className="text-xs font-bold text-slate-700">{selectedAsset.serial_number || '-'}</span></div>
                        <div><span className="text-[10px] text-slate-400 block">No. PR</span><span className="text-xs font-bold text-slate-700">{selectedAsset.pr_number || '-'}</span></div>
                        <div><span className="text-[10px] text-slate-400 block">Penempatan (HO)</span><span className="text-xs font-bold text-slate-700">{selectedAsset.placement_location || '-'}</span></div>
                        <div><span className="text-[10px] text-slate-400 block">Nomor Rak</span><span className="text-xs font-bold text-slate-700">{selectedAsset.rack_number || '-'}</span></div>
                        <div><span className="text-[10px] text-slate-400 block">Ruangan</span><span className="text-xs font-bold text-slate-700">{selectedAsset.room || '-'}</span></div>
                        <div><span className="text-[10px] text-slate-400 block">Didaftarkan Oleh</span><span className="text-xs font-bold text-slate-700">{selectedAsset.created_by_name || '-'}</span></div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-inner">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2 mb-3">Pengguna & Lampiran</h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                        <div><span className="text-[10px] text-slate-400 block">Nama User</span><span className="text-xs font-bold text-slate-700">{selectedAsset.user_name || '-'}</span></div>
                        <div><span className="text-[10px] text-slate-400 block">No. HP User</span><span className="text-xs font-bold text-slate-700">{selectedAsset.user_phone || '-'}</span></div>
                        
                        <div className="col-span-2 mt-2 flex gap-2">
                          {selectedAsset.photo_url && (
                            <a href={selectedAsset.photo_url} target="_blank" rel="noreferrer" className="flex-1 bg-white border border-slate-200 hover:border-[#286086] text-xs font-bold text-slate-600 hover:text-[#286086] px-3 py-2 rounded-lg text-center transition-colors">Lihat Foto</a>
                          )}
                          {selectedAsset.calibration_doc_url && (
                            <a href={selectedAsset.calibration_doc_url} target="_blank" rel="noreferrer" className="flex-1 bg-white border border-slate-200 hover:border-[#286086] text-xs font-bold text-slate-600 hover:text-[#286086] px-3 py-2 rounded-lg text-center transition-colors">Dokumen Kalibrasi</a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-full md:w-64 flex flex-col items-center justify-center bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm relative group cursor-pointer">
                    <div className="bg-white p-3 rounded-xl shadow-md border border-slate-200 mb-3 transition-transform group-hover:scale-105">
                      <QRCodeSVG value={`${window.location.origin}/public-asset/${selectedAsset.id}`} size={120} />
                    </div>
                    <span className="text-xs font-black tracking-widest text-[#286086] uppercase">{t('scanMe')}</span>
                    <p className="text-[10px] text-slate-400 mt-2 mb-3 text-center">{t('scanDesc')}</p>
                    <a 
                      href={`/public-asset/${selectedAsset.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      Buka Tautan Portal
                    </a>
                  </div>
                </div>
              )}

              {detailTab === 'components' && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      Komponen Asset
                    </h3>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <button onClick={handleBulkGenerateComponent} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          Generate dari Template
                        </button>
                        <button onClick={handleAddComponent} className="bg-[#286086] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-800 transition-colors flex items-center gap-1 shadow-sm">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                          Manual Input
                        </button>
                      </div>
                    )}
                  </div>
                  {assetComponents.length === 0 ? (
                    <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                      <p className="text-slate-400 text-sm font-semibold">Belum ada komponen yang terdaftar.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {assetComponents.map(comp => (
                        <div key={comp.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col justify-between hover:border-[#286086] transition-colors">
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-slate-800">{comp.name}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${comp.status === 'Bagus' ? 'bg-emerald-100 text-emerald-700' : comp.status === 'Rusak' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{comp.status}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 font-mono">SN: {comp.serial_number || '-'}</p>
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                              <button onClick={() => handleSwapComponent(comp)} className="flex-1 text-[11px] font-bold text-white bg-[#286086] hover:bg-[#1a4666] py-1.5 rounded transition-all shadow-sm flex justify-center items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                Swap
                              </button>
                              <button onClick={() => handleEditComponent(comp)} className="text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded transition-colors border border-slate-200">Info</button>
                              <button onClick={() => handleDeleteComponent(comp.id)} className="text-[11px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded transition-colors border border-red-100">Hapus</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'history' && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {t('movementHistory')}
                  </h3>
                  <div className="relative pl-4">
                    <div className="absolute left-[19px] top-4 bottom-8 w-[2px] border-l-2 border-dashed border-slate-200"></div>
                    {history.map((mov, idx) => (
                      <div key={idx} className="flex gap-4 mb-6 relative group">
                        <div className="relative z-10 flex flex-col items-center mt-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm border-[3px] border-white transition-transform group-hover:scale-110 ${mov.status.includes('Completed') || mov.status.includes('Received') ? 'bg-emerald-500 text-white' : mov.status.includes('Transit') || mov.status.includes('Pending') ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'}`}>
                            {mov.movement_type === 'Mutation' ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                            ) : mov.movement_type === 'Borrowing' ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex-1 pb-4">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4 mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-slate-800">{mov.movement_type || 'Delivery'}</h4>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-bold ${mov.status.includes('Completed') || mov.status.includes('Received') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : mov.status.includes('Transit') || mov.status.includes('Pending') ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>{mov.status}</span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 font-mono inline-block mt-0.5">#{mov.tracking_code}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                              <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              {new Date(mov.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative group-hover:border-blue-200 group-hover:shadow transition-all">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <span>{mov.from_location}</span>
                              </div>
                              <div className="h-[2px] w-4 bg-slate-300 rounded-full"></div>
                              <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                              <div className="h-[2px] w-4 bg-slate-300 rounded-full"></div>
                              <div className="flex items-center gap-1.5 text-[#286086]">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                                <span>{mov.to_location}</span>
                              </div>
                            </div>
                            
                            <p className="text-[11px] font-medium text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">{mov.purpose}</p>
                            
                            {mov.movement_logs && mov.movement_logs.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                                {mov.movement_logs.map((log, lIdx) => (
                                  <div key={lIdx} className="flex gap-3 relative">
                                    <div className="absolute left-[3px] top-[14px] bottom-[-16px] w-[1px] border-l border-dashed border-slate-200"></div>
                                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0 relative z-10 ring-4 ring-white"></div>
                                    <div className="text-[11px] bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 w-full">
                                      <div className="flex justify-between items-start">
                                        <span className="font-bold text-slate-700">{log.status_update}</span>
                                        <span className="text-[9px] text-slate-400 font-bold ml-2 shrink-0">{new Date(log.created_at || mov.created_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                      </div>
                                      {log.description && <p className="text-slate-500 mt-0.5 leading-relaxed">{log.description}</p>}
                                      <span className="text-[9px] text-slate-400 font-bold block mt-1">oleh <span className="text-blue-600">{log.updated_by}</span></span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <div className="p-8 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        {t('noMovementHistory')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'calibration' && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                  {assetCalibration ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      {(() => {
                        const nextCalDate = new Date(assetCalibration.next_calibration_date);
                        const now = new Date();
                        const isExpired = nextCalDate < now;
                        const isExpiringSoon = !isExpired && nextCalDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                        const displayStatus = isExpired ? 'Expired' : assetCalibration.status;
                        
                        return (
                          <>
                            {(isExpired || isExpiringSoon) && (
                              <div className={`p-4 border-b flex justify-between items-center ${isExpired ? 'bg-rose-100 border-rose-200' : 'bg-amber-100 border-amber-200'}`}>
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isExpired ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`}>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                  </div>
                                  <div>
                                    <h3 className={`text-sm font-black ${isExpired ? 'text-rose-800' : 'text-amber-800'}`}>
                                      {isExpired ? 'Kalibrasi Kadaluarsa!' : 'Kalibrasi Segera Berakhir!'}
                                    </h3>
                                    <p className={`text-[10px] font-bold mt-0.5 ${isExpired ? 'text-rose-600' : 'text-amber-600'}`}>
                                      {isExpired ? 'Masa berlaku sudah habis. Harap segera lakukan kalibrasi ulang.' : 'Harap jadwalkan kalibrasi ulang untuk aset ini.'}
                                    </p>
                                  </div>
                                </div>
                                <button onClick={() => { setIsDetailModalOpen(false); handleQuickAction('ticketing', selectedAsset); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-black shadow-sm transition-all flex items-center gap-1.5 ${isExpired ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}>
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                                  Request Kalibrasi
                                </button>
                              </div>
                            )}
                            <div className={`p-6 border-b flex justify-between items-center ${displayStatus === 'Valid' ? 'bg-emerald-50 border-emerald-100' : displayStatus === 'Expired' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
                              <div className="flex items-center gap-3">
                                 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${displayStatus === 'Valid' ? 'bg-emerald-200 text-emerald-800' : displayStatus === 'Expired' ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-800'}`}>
                                   <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                 </div>
                                 <div>
                                   <h3 className="text-sm font-black text-slate-800">{t('calibrationStatus')}</h3>
                                   <p className="text-xs font-bold text-slate-500 mt-0.5">Asset ID: {assetCalibration.asset_id}</p>
                                 </div>
                              </div>
                              <span className={`px-4 py-1.5 rounded-lg text-xs font-black tracking-widest uppercase shadow-sm ${displayStatus === 'Valid' ? 'bg-emerald-500 text-white' : displayStatus === 'Expired' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`}>
                                {displayStatus}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                      <div className="p-6 grid grid-cols-2 gap-6 bg-slate-50/50">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('lastCalibrated')}</p>
                          <p className="text-sm font-bold text-slate-800 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">{new Date(assetCalibration.last_calibration_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('nextCalibrationDue')}</p>
                          <p className="text-sm font-bold text-rose-600 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">{new Date(assetCalibration.next_calibration_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('notesRemarks')}</p>
                          <div className="text-sm font-medium text-slate-600 bg-white p-4 rounded-xl border border-slate-200 shadow-sm leading-relaxed">
                            {assetCalibration.notes || '-'}
                          </div>
                        </div>
                        {assetCalibration.certificate_url && (
                          <div className="col-span-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sertifikat Kalibrasi</p>
                            <a href={assetCalibration.certificate_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 rounded-xl font-bold text-sm transition-colors border border-blue-200 shadow-sm w-fit">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                              Lihat Dokumen
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-3">
                      <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      <p>{t('noCalibrationRecords')}</p>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'tickets' && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                   <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                    {t('relatedTickets')}
                  </h3>
                  
                  {assetTickets.length > 0 ? (
                    <div className="space-y-4">
                      {assetTickets.map(tck => (
                        <div key={tck.id} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{tck.ticket_number}</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border ${
                                  tck.ticket_type === 'Repair' ? 'bg-rose-50 text-rose-600 border-rose-200' : 
                                  tck.ticket_type === 'Replacement' ? 'bg-purple-50 text-purple-600 border-purple-200' : 
                                  tck.ticket_type === 'Calibration' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                  'bg-slate-50 text-slate-600 border-slate-200'
                                }`}>
                                  {tck.ticket_type}
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{tck.title}</h4>
                            <p className="text-[10px] font-semibold text-slate-400 mt-1">{new Date(tck.created_at).toLocaleString('id-ID')} • By {tck.created_by || 'System'}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm ${
                             tck.status === 'Closed' || tck.status === 'Resolved' ? 'bg-slate-100 text-slate-500' :
                             tck.status === 'Rejected' ? 'bg-rose-100 text-rose-600' : 'bg-blue-500 text-white'
                          }`}>
                            {tck.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-3">
                      <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                      <p>{t('noRelatedTickets')}</p>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}
      </BaseModal>

      {/* PRINT LABEL MODAL */}
      <BaseModal
        isOpen={isPrintModalOpen && printAssets.length > 0}
        onClose={() => setIsPrintModalOpen(false)}
        maxWidth="max-w-4xl"
        title={
          <span className="flex items-center gap-3">
            <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            {t('printAssetLabel') || 'Print Asset Label'} ({printAssets.length} labels)
          </span>
        }
      >
        <div className="flex flex-col items-center justify-center">
              <p className="text-xs font-bold text-slate-400 mb-6 uppercase tracking-widest">{t('labelPreview') || 'Thermal Label Preview (Brother PT-P750W / 24mm tape)'}</p>
              
              {/* THE PRINTABLE AREA */}
              <div id="asset-label-print-area" className="bg-transparent flex flex-col items-center">
                {printAssets.map((asset, index) => (
                  <div 
                    key={asset.id}
                    className="print-label bg-white overflow-hidden"
                    style={{ width: '24mm', height: '31.5mm', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', boxSizing: 'border-box', padding: '1mm', marginBottom: index < printAssets.length - 1 ? '10px' : '0' }}
                  >
                    {/* Top: Large QR Code */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '2.5mm', marginBottom: '0.5mm' }}>
                      <QRCodeSVG value={`${window.location.origin}/public-asset/${asset.id}`} style={{ width: '17.5mm', height: '17.5mm' }} />
                    </div>
                    
                    {/* Bottom: Logo, Name, ID */}
                    <div style={{ width: '18.5mm', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5mm', width: '100%', justifyContent: 'center', overflow: 'hidden' }}>
                        <img src={`${window.location.origin}/logo.png`} style={{ width: '2.5mm', height: 'auto', objectFit: 'contain', flexShrink: 0 }} alt="Logo" />
                        <span style={{ 
                          fontFamily: 'Arial, sans-serif', 
                          fontSize: asset.name.length > 15 ? '5px' : asset.name.length > 11 ? '5.5px' : '7px', 
                          fontWeight: '900', 
                          textTransform: 'uppercase', 
                          whiteSpace: 'normal', 
                          textAlign: 'center',
                          lineHeight: '1.1', 
                          color: 'black', 
                          letterSpacing: '-0.1px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word'
                        }}>{asset.name}</span>
                      </div>
                      <span style={{ 
                        fontFamily: 'Arial, sans-serif', 
                        fontSize: asset.id.length > 14 ? '5.5px' : asset.id.length > 10 ? '6.5px' : '8.5px', 
                        fontWeight: '900', 
                        letterSpacing: '0.1px', 
                        marginTop: '0.8mm', 
                        textTransform: 'uppercase', 
                        lineHeight: '1', 
                        color: 'black',
                        whiteSpace: 'nowrap'
                      }}>
                        {asset.id}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex gap-4 w-full">
                <button onClick={() => setIsPrintModalOpen(false)} className="flex-1 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">{t('cancel') || 'Cancel'}</button>
                <button onClick={handlePrintLabel} className="flex-1 py-3 text-sm font-bold bg-[#286086] hover:bg-[#1a4666] text-white rounded-xl shadow-[0_8px_20px_-6px_rgba(40,96,134,0.5)] transition-all flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  {t('downloadPrintPDF') || 'Download & Print PDF'}
                </button>
              </div>
            </div>
      </BaseModal>



      {/* CAMERA OVERLAY MODAL */}
      <BaseModal
        isOpen={isCameraOpen}
        onClose={stopCamera}
        maxWidth="max-w-4xl"
        title="Ambil Foto Asset"
      >
        <div className="flex flex-col items-center">
          <div className="w-full bg-black rounded-2xl overflow-hidden shadow-inner relative aspect-[4/3] flex items-center justify-center">
            {/* The video stream */}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
            {/* Viewfinder crosshairs */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-white/30">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-white -translate-x-1 -translate-y-1"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-white translate-x-1 -translate-y-1"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-white -translate-x-1 translate-y-1"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-white translate-x-1 translate-y-1"></div>
              </div>
            </div>
          </div>
          <div className="w-full flex justify-center gap-4 mt-6 mb-2">
            <button onClick={stopCamera} className="px-6 py-3 text-sm font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors">
              Batalkan
            </button>
            <button onClick={capturePhoto} className="px-8 py-3 text-sm font-black bg-[#286086] text-white rounded-xl shadow-[0_8px_20px_-6px_rgba(40,96,134,0.5)] hover:bg-[#1a4666] transition-all flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="4" /></svg>
              Jepret Foto
            </button>
          </div>
        </div>
      </BaseModal>

      {/* QR Scanner Modal */}
      <QRScannerModal 
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScanSuccess={(decodedText) => {
          setSearchTerm(decodedText);
          setIsFiltersOpen(false); // Close filters if open so results are clear
        }}
      />
      {/* COMPONENT ACTION MODAL (ADD / SWAP) */}
      <BaseModal
        isOpen={isComponentModalOpen}
        onClose={() => setIsComponentModalOpen(false)}
        title={componentMode === 'swap' ? 'Swap Komponen' : componentMode === 'edit' ? 'Edit Komponen' : 'Tambah Komponen'}
        maxWidth="max-w-md"
      >
        <div className="p-6">
          <div className="mb-6 flex items-center justify-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner ${componentMode === 'swap' ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-500'}`}>
              {componentMode === 'swap' ? (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
              ) : componentMode === 'edit' ? (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              ) : (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              )}
            </div>
          </div>
          
          {componentMode === 'swap' && (
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-6 text-sm text-blue-800">
              <span className="font-bold">Info Swap:</span> Mengganti <b>{componentForm.name}</b>. Sistem otomatis akan merekam riwayat penggantian ini pada log aset.
            </div>
          )}

          <div className="space-y-4">
            {(componentMode === 'add' || componentMode === 'edit') && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nama Komponen *</label>
                {componentMode === 'add' ? (
                  <select required value={componentForm.name} onChange={e => setComponentForm({...componentForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none transition-all focus:border-[#286086] focus:bg-white">
                    <option value="" disabled>Pilih dari Kamus Master Komponen</option>
                    {masterComponents.map(mc => (
                      <option key={mc.id} value={mc.name}>{mc.name}</option>
                    ))}
                  </select>
                ) : (
                  <input required type="text" value={componentForm.name} onChange={e => setComponentForm({...componentForm, name: e.target.value})} placeholder="Contoh: Baterai Lithium 4000mAh" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none transition-all focus:border-[#286086] focus:bg-white" />
                )}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{componentMode === 'swap' ? 'Serial Number Baru *' : 'Serial Number'}</label>
              <input type="text" value={componentForm.serial_number} onChange={e => setComponentForm({...componentForm, serial_number: e.target.value})} placeholder="S/N komponen" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none transition-all focus:border-[#286086] focus:bg-white" />
            </div>

            {componentMode === 'swap' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Alasan Penggantian *</label>
                <input required type="text" value={componentForm.reason} onChange={e => setComponentForm({...componentForm, reason: e.target.value})} placeholder="Contoh: Komponen lama terbakar" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none transition-all focus:border-[#286086] focus:bg-white" />
              </div>
            )}
            
            {(componentMode === 'add' || componentMode === 'edit') && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Status</label>
                <select value={componentForm.status} onChange={e => setComponentForm({...componentForm, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none transition-all focus:border-[#286086] focus:bg-white">
                  <option value="Bagus">Bagus</option>
                  <option value="Rusak">Rusak</option>
                  <option value="Perbaikan">Perbaikan</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-8">
            <button onClick={() => setIsComponentModalOpen(false)} className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">Batal</button>
            <button onClick={handleSaveComponent} className="flex-1 py-3 px-4 bg-[#286086] text-white font-bold rounded-xl hover:bg-[#1a4666] shadow-md shadow-blue-900/20 transition-all active:scale-95">Simpan Data</button>
          </div>
        </div>
      </BaseModal>

    </div>
  );
}
