import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import api from '../services/api';
import useMasterStore from '../store/masterStore';

export default function PublicAssetPortal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const branches = useMasterStore(state => state.branches);
  const fetchBranches = useMasterStore(state => state.fetchBranches);

  // Data States
  const [asset, setAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [calibrations, setCalibrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // UI States
  const [activeTab, setActiveTab] = useState('info'); // info, history, tickets, calibrations
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [permissions, setPermissions] = useState(null);
  
  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'location', 'dispatch', 'receive', 'ticket', null
  const [gpsLocation, setGpsLocation] = useState(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [isBorrowingMode, setIsBorrowingMode] = useState(false);

  // Form States
  const [formUpdaterName, setFormUpdaterName] = useState('');
  const [formBranch, setFormBranch] = useState('');
  const [formStatus, setFormStatus] = useState('');
  const [formPurpose, setFormPurpose] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTrackingCode, setFormTrackingCode] = useState('');
  const [formFile, setFormFile] = useState(null);

  useEffect(() => {
    fetchData();
    fetchBranches();
  }, [id]);

  const fetchData = async () => {
    try {
      // 1. Fetch Asset
      const assetRes = await api.get('/assets');
      const match = assetRes.data.data.find(a => String(a.id) === String(id));

      if (!match) {
        setError('Asset not found');
        setLoading(false);
        return;
      }
      setAsset(match);
      setFormBranch(match.branch);
      setFormStatus(match.status);

      // 2. Fetch movements
      api.get('/movements').then(res => {
        const filteredMov = res.data.data.filter(m => m.asset_id === id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        setHistory(filteredMov);
      }).catch(() => {});
      
      // 3. Fetch tickets
      api.get('/tickets').then(res => {
        const filteredTick = res.data.data.filter(t => t.asset_id === id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        setTickets(filteredTick);
      }).catch(() => {});

      // 4. Fetch calibrations
      api.get('/calibrations').then(res => {
        const filteredCal = res.data.data.filter(c => c.asset_id === id);
        setCalibrations(filteredCal);
      }).catch(() => {});

      // 5. Fetch Public Permissions
      api.get('/permissions/Public Access').then(res => {
        const perms = res.data.data;
        const publicModule = perms.find(m => m.module === 'Public QR Portal');
        if (publicModule) {
          const permMap = {};
          publicModule.actions.forEach(a => { permMap[a.name] = a.enabled; });
          setPermissions(permMap);
        }
      }).catch(() => {});

    } catch(err) {
      setError('Failed to load asset details');
    }
    setLoading(false);
  };

  const captureGps = () => {
    if (navigator.geolocation) {
      setIsGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setIsGpsLoading(false);
        },
        (err) => {
          console.error("GPS error:", err);
          setIsGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const openModal = (type) => {
    setIsMenuOpen(false);
    setActiveModal(type);
    setFormUpdaterName('');
    setFormPurpose('');
    setFormFile(null);
    setFormTrackingCode('');
    setIsBorrowingMode(type === 'borrow');
    
    if (type === 'borrow') type = 'dispatch';
    
    if (type === 'location' || type === 'dispatch' || type === 'receive') {
      captureGps();
    }
    if (type === 'dispatch') {
      setFormTrackingCode(`TRK-${Date.now().toString().slice(-6)}`);
    }
    if (type === 'ticket') {
      setFormTitle(`[Report] Laporan kerusakan ${asset.name}`);
      setFormDesc('');
    }
  };

  const submitLocationUpdate = async (e) => {
    e.preventDefault();
    if (!formUpdaterName.trim()) return Swal.fire('Error', 'Nama wajib diisi', 'warning');
    
    try {
      await api.post('/movements/public-update', {
        asset_id: id,
        from_branch: asset.branch,
        to_branch: formBranch,
        status: formStatus,
        purpose: formPurpose || 'Update Lokasi Manual',
        tracking_code: `TRK-${Date.now().toString().slice(-6)}`,
        lat: gpsLocation?.lat,
        lng: gpsLocation?.lng,
        updater_name: formUpdaterName
      });

      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Lokasi diperbarui!', timer: 1500, showConfirmButton: false });
      setActiveModal(null);
      fetchData();
    } catch(err) {
      Swal.fire('Error', 'Gagal update lokasi', 'error');
    }
  };

  const submitTicket = async (e) => {
    e.preventDefault();
    if (!formUpdaterName.trim()) return Swal.fire('Error', 'Nama pelapor wajib diisi', 'warning');
    
    try {
      await api.post('/tickets', {
        title: formTitle,
        description: formDesc,
        branch: asset.branch,
        asset_id: id,
        ticket_type: 'Repair',
        priority: 'High',
        created_by: formUpdaterName
      });
      Swal.fire({ icon: 'success', title: 'Tiket Dibuat', text: 'Laporan kerusakan berhasil dikirim ke pusat.', timer: 2000, showConfirmButton: false });
      setActiveModal(null);
      fetchData();
    } catch(err) {
      Swal.fire('Error', 'Gagal membuat laporan', 'error');
    }
  };

  const submitDispatch = async (e) => {
    e.preventDefault();
    if (!formUpdaterName.trim()) return Swal.fire('Error', 'Nama pengirim wajib diisi', 'warning');
    if (!formFile) return Swal.fire('Error', 'Bukti foto wajib diunggah', 'warning');

    if (!isBorrowingMode) {
      const confirm = await Swal.fire({
        title: 'Konfirmasi Mutasi Permanen',
        text: 'Anda yakin ingin memindahkan aset ini secara permanen? Kepemilikan akan berpindah secara permanen.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Ya, Mutasi Permanen!'
      });
      if (!confirm.isConfirmed) return;
    }

    Swal.fire({title: 'Mengirim...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    try {
      const formData = new FormData();
      formData.append('tracking_code', formTrackingCode);
      formData.append('asset_ids', JSON.stringify([id]));
      formData.append('purpose', formPurpose || 'Kirim Aset');
      formData.append('from_location', asset.branch);
      formData.append('to_location', formBranch);
      formData.append('sender_name', formUpdaterName);
      formData.append('sender_role', 'Public Dispatcher');
      formData.append('movement_type', isBorrowingMode ? 'Borrowing' : 'Mutation');
      formData.append('proof_image', formFile);

      await api.post('/movements/dispatch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      Swal.fire({ icon: 'success', title: 'Dikirim', text: 'Permintaan pengiriman berhasil dicatat.', timer: 2000, showConfirmButton: false });
      setActiveModal(null);
      fetchData();
    } catch(err) {
      Swal.fire('Error', 'Gagal memproses pengiriman', 'error');
    }
  };

  const submitReceive = async (e) => {
    e.preventDefault();
    if (!formUpdaterName.trim()) return Swal.fire('Error', 'Nama penerima wajib diisi', 'warning');
    if (!formFile) return Swal.fire('Error', 'Bukti penerimaan wajib diunggah', 'warning');
    if (!formTrackingCode.trim()) return Swal.fire('Error', 'Tracking code wajib diisi', 'warning');

    Swal.fire({title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    try {
      const formData = new FormData();
      formData.append('tracking_code', formTrackingCode);
      formData.append('receiver_name', formUpdaterName);
      formData.append('notes', formPurpose);
      formData.append('proof_image', formFile);

      await api.post('/movements/receive', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      Swal.fire({ icon: 'success', title: 'Diterima', text: 'Barang berhasil dikonfirmasi.', timer: 2000, showConfirmButton: false });
      setActiveModal(null);
      fetchData();
    } catch(err) {
      Swal.fire('Error', err.response?.data?.detail || 'Gagal memproses penerimaan', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans p-6 text-center">
        <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-3xl flex items-center justify-center mb-5 rotate-12 shadow-inner">
          <svg className="w-10 h-10 -rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Aset Tidak Ditemukan</h2>
        <p className="text-sm text-slate-500 mb-8 max-w-xs leading-relaxed">Barcode yang Anda scan mungkin salah, atau data aset telah dihapus dari sistem pusat.</p>
        <Link to="/" className="px-8 py-3.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-2xl font-black text-sm shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)] hover:-translate-y-1 transition-all">Kembali ke Beranda</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-32 selection:bg-blue-200 relative">
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-[35vh] bg-gradient-to-br from-[#1a365d] via-[#286086] to-[#3b82f6] shadow-2xl rounded-b-[50px] overflow-hidden -z-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400 opacity-20 rounded-full blur-2xl -ml-10 -mb-10"></div>
      </div>

      <div className="px-5 pt-12 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20">
            <span className="font-black text-white text-lg">E</span>
          </div>
          <div>
            <h1 className="text-white text-sm font-black tracking-widest uppercase opacity-90">TMC Hub</h1>
            <p className="text-blue-100 text-[10px] font-medium tracking-widest opacity-80 uppercase">Scanner Portal</p>
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-full">
           <p className="text-white text-[10px] font-bold font-mono">{asset.id}</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5">
        
        {/* Main Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-[32px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-white overflow-hidden mb-6 relative">
          <div className="p-7">
            <h2 className="text-3xl font-black text-slate-800 leading-[1.1] tracking-tight mb-2">{asset.name}</h2>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xs font-bold text-[#286086] bg-blue-50 px-2.5 py-1 rounded-md">{asset.category}</span>
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase border ${asset.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : asset.status === 'In Transit' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                {asset.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center shadow-inner">
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1 flex items-center gap-1"><svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> Lokasi (Cabang)</p>
                <p className="text-[13px] font-black text-slate-700 leading-tight">{asset.branch}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center shadow-inner">
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1 flex items-center gap-1"><svg className="w-3 h-3 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> PIC / Pengguna</p>
                <p className="text-[13px] font-black text-slate-700 truncate leading-tight">{asset.assignee || 'Tidak Ada'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Tab Menu */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide snap-x">
          {['info', 'history', 'tickets', 'calibrations'].map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`snap-center shrink-0 px-5 py-2.5 rounded-full text-xs font-black tracking-wider uppercase transition-all shadow-sm ${activeTab === tab ? 'bg-[#286086] text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
            >
              {tab === 'info' ? 'Spesifikasi' : tab === 'history' ? 'Logistik' : tab === 'tickets' ? 'Tiket Rusak' : 'Kalibrasi'}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="bg-white rounded-[28px] shadow-sm border border-slate-100 p-6 min-h-[300px]">
          {activeTab === 'info' && (
            <div className="animate-[fadeIn_0.3s_ease-out] space-y-4">
              <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Asset ID / Kode</span>
                <span className="text-sm font-black text-slate-800">{asset.id}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Serial Number</span>
                <span className="text-sm font-black text-slate-800">{asset.serial_number || '-'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Merek / Brand</span>
                <span className="text-sm font-black text-slate-800">{asset.brand || '-'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ruangan</span>
                <span className="text-sm font-black text-slate-800">{asset.room || '-'}</span>
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Kondisi</span>
                <span className="text-sm font-black text-slate-800">{asset.condition || '-'}</span>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="animate-[fadeIn_0.3s_ease-out]">
              {history.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-[13px] top-2 bottom-4 w-[2px] bg-slate-100"></div>
                  {history.map((mov, idx) => (
                    <div key={idx} className="flex gap-4 mb-6 relative last:mb-0 group">
                      <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center relative z-10 shadow-sm border-[3px] border-white flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                      </div>
                      <div className="pb-1">
                        <h4 className="text-[13px] font-black text-slate-800">{mov.status}</h4>
                        <p className="text-xs font-medium text-slate-500 mt-0.5 leading-relaxed">{mov.purpose}</p>
                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{new Date(mov.created_at).toLocaleString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">Belum ada riwayat pergerakan.</div>
              )}
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="animate-[fadeIn_0.3s_ease-out]">
              {tickets.length > 0 ? (
                <div className="space-y-4">
                  {tickets.map(tck => (
                    <div key={tck.id} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                      <div className="flex justify-between mb-2">
                        <span className="font-mono text-[10px] font-black text-slate-500 bg-white px-2 py-1 rounded shadow-sm border border-slate-100">{tck.ticket_number}</span>
                        <span className={`px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase ${tck.status === 'Closed' ? 'bg-slate-200 text-slate-600' : 'bg-rose-100 text-rose-600'}`}>{tck.status}</span>
                      </div>
                      <h4 className="font-black text-sm text-slate-800">{tck.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tck.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">Belum ada tiket laporan kerusakan.</div>
              )}
            </div>
          )}

          {activeTab === 'calibrations' && (
            <div className="animate-[fadeIn_0.3s_ease-out]">
              {calibrations.length > 0 ? (
                <div className="space-y-4">
                  {calibrations.map(cal => (
                    <div key={cal.id} className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-black text-xs text-emerald-800 uppercase tracking-wider">Status: {cal.status}</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div>
                          <p className="text-[10px] font-bold text-emerald-600/70 uppercase">Kalibrasi Terakhir</p>
                          <p className="text-xs font-black text-emerald-900">{cal.last_calibration_date}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-rose-600/70 uppercase">Jadwal Berikutnya</p>
                          <p className="text-xs font-black text-rose-600">{cal.next_calibration_date}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">Belum ada riwayat kalibrasi.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button (Triggers Bottom Sheet) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-5">
        <button 
          onClick={() => setIsMenuOpen(true)}
          className="w-full bg-[#1e293b] text-white py-4 rounded-2xl shadow-[0_15px_30px_-10px_rgba(30,41,59,0.8)] font-black text-[14px] tracking-widest flex items-center justify-center gap-3 hover:-translate-y-1 hover:bg-black transition-all border border-slate-700"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" /></svg>
          TAMPILKAN MENU AKSI
        </button>
      </div>

      {/* ACTION MENU BOTTOM SHEET */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMenuOpen(false)}></div>
          <div className="bg-white w-full max-w-md rounded-t-[32px] shadow-[0_-20px_40px_rgba(0,0,0,0.2)] relative z-10 flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out]">
            <div className="w-full flex justify-center pt-3 pb-2"><div className="w-12 h-1.5 bg-slate-200 rounded-full"></div></div>
            
            <div className="px-6 py-4">
              <h2 className="text-xl font-black text-slate-800 mb-1">Aksi Cepat</h2>
              <p className="text-xs font-bold text-slate-400">Pilih tindakan untuk aset ini</p>
            </div>

            <div className="p-6 pt-2 grid grid-cols-2 gap-4">
              {(!permissions || permissions['Update Lokasi'] !== false) && (
                <button onClick={() => openModal('location')} className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-blue-100 transition-colors group">
                  <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
                  <span className="text-xs font-black text-blue-900 mt-1">Update Lokasi</span>
                </button>
              )}
              
              {(!permissions || permissions['Mutasi Permanen'] !== false) && (
                <button onClick={() => openModal('dispatch')} className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-rose-100 transition-colors group">
                  <div className="w-12 h-12 rounded-full bg-rose-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg></div>
                  <span className="text-xs font-black text-rose-900 mt-1">Mutasi Permanen</span>
                </button>
              )}

              {(!permissions || permissions['Pinjamkan Alat'] !== false) && (
                <button onClick={() => openModal('borrow')} className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-amber-100 transition-colors group">
                  <div className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></div>
                  <span className="text-xs font-black text-amber-900 mt-1">Pinjamkan Alat</span>
                </button>
              )}

              {(!permissions || permissions['Terima Aset'] !== false) && (
                <button onClick={() => openModal('receive')} className="bg-purple-50 border border-purple-100 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-purple-100 transition-colors group">
                  <div className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                  <span className="text-xs font-black text-purple-900 mt-1">Terima Aset</span>
                </button>
              )}

              {(!permissions || permissions['Lapor Rusak'] !== false) && (
                <button onClick={() => openModal('ticket')} className="bg-slate-100 border border-slate-200 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-200 transition-colors group">
                  <div className="w-12 h-12 rounded-full bg-slate-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                  <span className="text-xs font-black text-slate-700 mt-1">Lapor Rusak</span>
                </button>
              )}
            </div>
            
            <div className="pb-8 px-6">
               <button onClick={() => setIsMenuOpen(false)} className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200">Batal / Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORMS */}
      {activeModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0 sm:pb-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setActiveModal(null)}></div>
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-3xl shadow-2xl relative z-10 flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out] max-h-[95vh]">
            <div className="pt-6 px-6 pb-4 flex justify-between items-center border-b border-slate-100">
              <h2 className="text-xl font-black text-slate-800">
                {activeModal === 'location' ? 'Update Lokasi Manual' : activeModal === 'dispatch' ? (isBorrowingMode ? 'Form Pinjamkan Alat' : 'Form Mutasi Permanen') : activeModal === 'receive' ? 'Form Penerimaan Aset' : 'Laporan Kerusakan'}
              </h2>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            
            <form onSubmit={activeModal === 'location' ? submitLocationUpdate : activeModal === 'dispatch' ? submitDispatch : activeModal === 'receive' ? submitReceive : submitTicket} className="p-6 overflow-y-auto space-y-4">
              
              {/* Updater Name (Required for all) */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Nama Lengkap Anda</label>
                <input required type="text" value={formUpdaterName} onChange={e => setFormUpdaterName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-[#286086] focus:bg-white rounded-xl p-3.5 text-sm font-bold text-slate-700 outline-none transition-colors shadow-sm" placeholder="Contoh: Budi - Kurir" />
              </div>

              {/* LOCATION UPDATE & DISPATCH SPECIFIC */}
              {(activeModal === 'location' || activeModal === 'dispatch') && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Cabang Tujuan</label>
                  <select required value={formBranch} onChange={e => setFormBranch(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-[#286086] focus:bg-white rounded-xl p-3.5 text-sm font-bold text-slate-700 outline-none transition-colors appearance-none shadow-sm">
                    {branches.map(b => <option key={b.id || b.name || b} value={b.name || b}>{b.name || b}</option>)}
                  </select>
                </div>
              )}

              {/* DISPATCH & RECEIVE SPECIFIC */}
              {(activeModal === 'dispatch' || activeModal === 'receive') && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Tracking Code / Resi</label>
                    <input required type="text" value={formTrackingCode} onChange={e => setFormTrackingCode(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-mono font-bold text-slate-700 outline-none shadow-sm" placeholder="TRK-XXXXXX" readOnly={activeModal === 'dispatch'} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Unggah Foto Bukti</label>
                    <input required type="file" accept="image/*" onChange={e => setFormFile(e.target.files[0])} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-[#286086] file:text-white hover:file:bg-[#1a4666] bg-slate-50 border border-slate-200 rounded-xl p-1" />
                  </div>
                </>
              )}

              {/* LOCATION UPDATE SPECIFIC */}
              {activeModal === 'location' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Keterangan Tambahan</label>
                  <input required type="text" value={formPurpose} onChange={e => setFormPurpose(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-[#286086] rounded-xl p-3.5 text-sm font-bold text-slate-700 outline-none shadow-sm" placeholder="Contoh: Pindah ruangan" />
                </div>
              )}

              {/* TICKETING SPECIFIC */}
              {activeModal === 'ticket' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Judul Laporan</label>
                    <input required type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 rounded-xl p-3.5 text-sm font-bold text-slate-700 outline-none shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Deskripsi Kerusakan</label>
                    <textarea required rows="3" value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 rounded-xl p-3.5 text-sm font-medium text-slate-700 outline-none shadow-sm" placeholder="Jelaskan secara detail kerusakan yang terjadi..."></textarea>
                  </div>
                </>
              )}

              <div className="pt-4 pb-2">
                <button type="submit" disabled={isGpsLoading} className={`w-full py-4 text-[15px] font-black text-white rounded-2xl shadow-[0_8px_20px_-6px_rgba(0,0,0,0.6)] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${activeModal === 'ticket' ? 'bg-rose-600 hover:bg-rose-700' : activeModal === 'dispatch' && !isBorrowingMode ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#286086] hover:bg-[#1a4666]'}`}>
                  {activeModal === 'dispatch' && !isBorrowingMode ? 'KIRIM MUTASI' : activeModal === 'dispatch' && isBorrowingMode ? 'KIRIM PINJAMAN' : 'KIRIM SEKARANG'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
