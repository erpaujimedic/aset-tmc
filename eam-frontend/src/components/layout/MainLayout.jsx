import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import useI18nStore from '../../store/i18nStore';
import useChatStore from '../../store/chatStore';
import BaseModal from '../ui/BaseModal';
import UserGuideModal from '../ui/UserGuideModal';

// 🎨 PREMIUM UNIFIED SVG ICONS
const KeyIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>;
const DashboardIcon = () => <svg className="w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-105" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>;
const AssetIcon = () => <svg className="w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-105" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>;
const DeliveryIcon = () => <svg className="w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-105" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>;
const CalibrationIcon = () => <svg className="w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-105" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const BorrowIcon = () => <svg className="w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-105" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path><path d="M8 12h8"></path><path d="M12 8v8"></path></svg>;
const BranchIcon = () => <svg className="w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-105" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>;
const TicketIcon = () => <svg className="w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-105" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>;
const UserMgmtIcon = () => <svg className="w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-105" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><circle cx="19" cy="11" r="2"/><path d="M19 8v1"/><path d="M19 13v1"/><path d="M21.6 9.5l-.87.5"/><path d="M17.27 12l-.87.5"/><path d="M21.6 12.5l-.87-.5"/><path d="M17.27 10l-.87-.5"/></svg>;
const ChatIcon = () => <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
const ShortcutsIcon = () => <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
const ApprovalIcon = () => <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 11 2 2 4-4" /></svg>;
const LiveUsersIcon = () => <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><path d="M2 12h20" /></svg>;
const LogoutIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>;
const CloseIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const TrashIcon = () => <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
const GuideIcon = () => <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, permissions, setPermissions } = useAuthStore();
  const { lang, setLang, t } = useI18nStore();
  
  const { messages, isReady, fetchHistory, sendMessage, deleteMessage, subscribeToChat, unreadCount, resetUnreadCount } = useChatStore();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null); 
  const [chatState, setChatState] = useState('closed'); 
  const [openMenus, setOpenMenus] = useState({});

  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [isLoadingPanel, setIsLoadingPanel] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Change password state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm_password: '' });

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      return Swal.fire({ icon: 'warning', title: 'Oops...', text: 'Password baru dan konfirmasi tidak cocok!' });
    }
    try {
      await api.post('/auth/change-password', {
        user_id: user.id,
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password
      });
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Password berhasil diubah!' });
      setIsChangePasswordOpen(false);
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch(err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.detail || err.message });
    }
  };

  const handleApprove = async (trackingCode) => {
    try {
      await api.post('/movements/approve', { tracking_code: trackingCode, approver_name: displayName });
      setPendingApprovals(prev => prev.filter(p => p.tracking_code !== trackingCode));
      Swal.fire({ icon: 'success', title: 'Disetujui', text: `Pengiriman ${trackingCode} disetujui.`, timer: 2000, showConfirmButton: false });
    } catch(err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.detail || err.message });
    }
  };

  const handleReject = async (trackingCode) => {
    try {
      await api.post('/movements/reject', { tracking_code: trackingCode, approver_name: displayName, reason: 'Ditolak oleh Admin' });
      setPendingApprovals(prev => prev.filter(p => p.tracking_code !== trackingCode));
      Swal.fire({ icon: 'info', title: 'Ditolak', text: `Pengiriman ${trackingCode} ditolak.`, timer: 2000, showConfirmButton: false });
    } catch(err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.detail || err.message });
    }
  };

  const toggleMenu = (path) => {
    setOpenMenus(prev => ({...prev, [path]: !prev[path]}));
  }; 

  const profileRef = useRef(null);
  const chatContainerRef = useRef(null);

  const displayName = user?.fullName || user?.name || user?.username || 'EAM Account';
  const initialName = displayName.substring(0, 2).toUpperCase();
  const displayBranch = user?.branchName || user?.branch || 'Head Office';
  const displayRole = user?.roleType || user?.role || 'CLIENT';
  const roleStr = `${user?.role || ''} ${user?.roleType || ''}`.toUpperCase();
  const isAdminOrSpv = roleStr.includes('ADMIN') || roleStr.includes('SPV') || roleStr.includes('SUPPORT');

  useEffect(() => {
    fetchHistory();
    const chatSub = subscribeToChat();
    
    // Fetch Pending Approvals
    const fetchPendingApprovals = async () => {
      try {
        const res = await api.get('/movements/pending-approvals');
        setPendingApprovals(res.data.data || []);
      } catch(err) { console.error(err); }
    };
    fetchPendingApprovals();
    const interval = setInterval(fetchPendingApprovals, 15000);

    return () => {
      if (chatSub) chatSub.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (chatState === 'open') {
      resetUnreadCount();
    }
  }, [chatState, resetUnreadCount]);

  useEffect(() => {
    if (user && user.role) {
      api.get(`/permissions/${user.role}`).then(res => {
        setPermissions(res.data.data);
      }).catch(console.error);
    }
  }, [user]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      // Gunakan Alt + Shift untuk menghindari konflik dengan shortcut bawaan browser (misal Alt+D untuk Address Bar)
      if (e.altKey && e.shiftKey) {
        switch(e.code) {
          case 'KeyD':
            e.preventDefault();
            setActivePanel(null);
            navigate('/dashboard');
            break;
          case 'KeyA':
            e.preventDefault();
            setActivePanel(null);
            navigate('/assets');
            break;
          case 'KeyB':
            e.preventDefault();
            setActivePanel(null);
            navigate('/borrowing');
            break;
          case 'KeyL':
            e.preventDefault();
            setActivePanel(null);
            navigate('/deliveries');
            break;
          case 'KeyC':
            e.preventDefault();
            setActivePanel(null);
            navigate('/calibrations');
            break;
          case 'KeyU':
            e.preventDefault();
            setActivePanel(null);
            navigate('/user-managements/users');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // --- GUIDED TOUR LOGIC ---
  useEffect(() => {
    if (localStorage.getItem('startTour') === 'true' && permissions && permissions.length > 0) {
      localStorage.removeItem('startTour');
      startInteractiveTour();
    }
  }, [permissions]);

  const startInteractiveTour = () => {
    setIsSidebarOpen(true); // Ensure sidebar is open to show all items

    const baseSteps = [
      { element: '#nav-dashboard', popover: { title: 'Dashboard', description: 'Pusat kendali (Command Center) untuk memantau performa dan lokasi seluruh aset.', side: "right", align: 'start' } },
    ];

    if (canView('Asset Management')) {
      baseSteps.push({ element: '#nav-assets', popover: { title: 'Manajemen Aset', description: 'Halaman utama untuk menambah, mengedit, menghapus, atau mencetak barcode aset fisik perusahaan.', side: "right", align: 'start' } });
    }
    if (canView('Deliveries & Tracking')) {
      baseSteps.push({ element: '#nav-borrowing', popover: { title: 'Peminjaman Aset', description: 'Alur request peminjaman antar cabang hingga proses pengembalian barang.', side: "right", align: 'start' } });
      baseSteps.push({ element: '#nav-deliveries', popover: { title: 'Logistik & Tracking', description: 'Pantau aset yang sedang dalam proses pengiriman (In Transit) dengan bukti resi.', side: "right", align: 'start' } });
    }
    if (canView('Calibration Schedules')) {
      baseSteps.push({ element: '#nav-calibrations', popover: { title: 'Jadwal Kalibrasi', description: 'Pemantauan masa aktif kalibrasi alat ukur agar selalu akurat.', side: "right", align: 'start' } });
    }
    if (canView('Ticketing')) {
      baseSteps.push({ element: '#nav-ticketing', popover: { title: 'Ticketing & Keluhan', description: 'Modul laporan perbaikan kerusakan aset yang membutuhkan penanganan teknisi.', side: "right", align: 'start' } });
    }
    if (user?.role?.toLowerCase() === 'master admin' || canView('User Managements - Users')) {
      baseSteps.push({ element: '#nav-users', popover: { title: 'Manajemen Pengguna', description: 'Area konfigurasi sistem untuk mengatur Role (Hak Akses) dan akun pengguna.', side: "right", align: 'start' } });
    }

    baseSteps.push({ element: '#action-guide', popover: { title: 'User Guide', description: 'Klik ikon ini kapan saja jika Anda membutuhkan buku panduan tertulis secara lengkap.', side: "bottom", align: 'end' } });
    baseSteps.push({ element: '#action-chat', popover: { title: 'Global Chat', description: 'Ruang komunikasi real-time antar pengguna sistem.', side: "bottom", align: 'end' } });
    baseSteps.push({ element: '#action-approval', popover: { title: 'Approval Center', description: 'Pusat persetujuan (Approve/Reject) untuk pengajuan pinjaman/mutasi aset.', side: "bottom", align: 'end' } });

    const driverFn = window.driver.js.driver;
    const tourObj = driverFn({
      showProgress: true,
      animate: true,
      allowClose: false,
      doneBtnText: 'Selesai',
      nextBtnText: 'Lanjut',
      prevBtnText: 'Kembali',
      steps: baseSteps,
      onDestroyStarted: () => {
        setIsSidebarOpen(false);
        tourObj.destroy();
      }
    });

    setTimeout(() => {
      tourObj.drive();
    }, 500);
  };

  const canView = (moduleName) => {
    if (user?.role?.toLowerCase() === 'master admin') return true; // Master Admin bypass
    if (!permissions || permissions.length === 0) return false;
    const mod = permissions.find(p => p.module === moduleName);
    if (!mod) return false;
    const viewAction = mod.actions.find(a => a.name === 'View');
    return viewAction ? viewAction.enabled : false;
  };

  useEffect(() => {
    if (chatState === 'open' && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, chatState]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setProfileOpen(false);
    Swal.fire({
      title: t('readyLeave') || 'Ready to leave?',
      text: t('logoutDesc') || 'You will be securely logged out from the system.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EC363A',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: t('yesLogout') || 'Yes, Sign Out',
      cancelButtonText: t('cancel') || 'Cancel',
      customClass: { popup: 'rounded-[24px] font-sans z-[99999]' }
    }).then((result) => {
      if (result.isConfirmed) {
        logout();
        navigate('/');
      }
    });
  };

  const handleActionClick = async (btnId) => {
    if (btnId === 'chat') {
      if (chatState === 'closed' || chatState === 'minimized') setChatState('open');
      else setChatState('closed');
    } else if (btnId === 'guide') {
      setIsGuideOpen(true);
    } else {
      if (activePanel === btnId) {
        setActivePanel(null);
      } else {
        setActivePanel(btnId);
        // Fetch specific data when panel opens
        if (btnId === 'approval') fetchOverdueAlerts();
        if (btnId === 'users') fetchSystemUsers();
      }
    }
  };

  const fetchOverdueAlerts = async () => {
    setIsLoadingPanel(true);
    try {
      const res = await api.get('/movements'); // We can filter this on frontend
      const transits = res.data.data.filter(m => m.status === 'In Transit' && m.expected_return_date);
      const overdues = transits.filter(m => new Date() > new Date(m.expected_return_date));
      setOverdueAlerts(overdues);
    } catch(err) { console.error(err); }
    setIsLoadingPanel(false);
  };

  const fetchSystemUsers = async () => {
    setIsLoadingPanel(true);
    try {
      const res = await api.get('/users');
      // Mix with chat presence: users who sent messages are "Recently Active"
      const activeNames = [...new Set(messages.map(m => m.sender_name))];
      const usersData = res.data.data.map(u => ({
        ...u,
        isOnline: activeNames.includes(u.name || u.full_name) || (u.name || u.full_name) === displayName
      }));
      setSystemUsers(usersData);
    } catch(err) { console.error(err); }
    setIsLoadingPanel(false);
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    const text = e.target.msg.value.trim();
    if (text) {
      sendMessage(displayName, displayBranch, displayRole, text); 
      e.target.reset();
    }
  };

  const getPanelTitle = () => {
    if (activePanel === 'shortcuts') return t('shortcuts') || 'Command Center';
    if (activePanel === 'approval') return t('approval') || 'Approval Center';
    if (activePanel === 'users') return t('liveUsers') || 'Live Users';
    return '';
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 text-slate-800 font-sans antialiased selection:bg-blue-500/10 selection:text-blue-600 relative">
      
      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[990] md:hidden animate-[fadeIn_0.2s_ease-out]" />
      )}

      {/* 1. SIDEBAR */}
      <aside className={`fixed md:relative top-0 left-0 h-full bg-gradient-to-b from-white to-slate-100/80 text-slate-700 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-200 z-[1000] md:z-[60] shadow-[4px_0_24px_rgba(0,0,0,0.02)] ${isSidebarOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full md:translate-x-0 w-[260px] md:w-[78px]'}`}>
        <div 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="h-[75px] min-h-[75px] flex items-center px-5 border-b border-slate-100/50 gap-3 overflow-hidden cursor-pointer hover:bg-slate-50/50 transition-colors"
          title="Toggle Sidebar"
        >
          <div className="relative w-[36px] h-[36px] min-w-[36px] flex-shrink-0 flex items-center justify-center">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-sm" />
          </div>
          <div className={`flex flex-col transition-all duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <span className="font-bold tracking-widest text-sm text-slate-800 leading-none whitespace-nowrap">EAM SYSTEM</span>
          </div>
        </div>

        <nav className={`flex-1 px-3 py-6 space-y-1.5 custom-scrollbar ${isSidebarOpen ? 'overflow-y-auto overflow-x-hidden' : 'overflow-visible'}`}>
          {[
            { id: 'nav-dashboard', path: '/dashboard', label: t('dashboard') || 'Dashboard', icon: <DashboardIcon />, module: 'Dashboard' },
            { type: 'section', label: t('coreSystem') || 'Core System' },
            { id: 'nav-assets', path: '/assets', label: t('assetManagement') || 'Asset Management', icon: <AssetIcon />, module: 'Asset Management' },
            { id: 'nav-borrowing', path: '/borrowing', label: t('borrowingAsset') || 'Peminjaman Aset', icon: <BorrowIcon />, module: 'Deliveries & Tracking' },
            { id: 'nav-deliveries', path: '/deliveries', label: t('logisticsTracking') || 'Logistik & Tracking', icon: <DeliveryIcon />, module: 'Deliveries & Tracking' },
            { id: 'nav-calibrations', path: '/calibrations', label: t('calibrationSchedules') || 'Calibration Schedules', icon: <CalibrationIcon />, module: 'Calibration Schedules' },
            { id: 'nav-ticketing', path: '/ticketing', label: t('ticketing') || 'Ticketing', icon: <TicketIcon />, module: 'Ticketing' },
            { type: 'section', label: 'Settings' },
            { id: 'nav-file-naming', path: '/settings/file-naming', label: 'File Naming Config', icon: <ShortcutsIcon />, module: 'Settings - File Naming Config' },
            { id: 'nav-sla', path: '/settings/sla-settings', label: 'SLA Setting', icon: <ApprovalIcon />, module: 'Settings - SLA Setting' },
            { id: 'nav-master-components', path: '/settings/master-components', label: 'Master Components', icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>, module: 'Settings - File Naming Config' },
            { id: 'nav-users', path: '/user-managements', label: t('userManagements') || 'User Managements', icon: <UserMgmtIcon />, subItems: [
              { path: '/user-managements/roles', label: t('roles') || 'Roles', module: 'User Managements - Roles' },
              { path: '/user-managements/profile-configurations', label: t('profileConfigs') || 'Profile Configurations', module: 'User Managements - Profile Configurations' },
              { path: '/user-managements/users', label: t('users') || 'Users', module: 'User Managements - Users' }
            ]},
          ].map((item, index) => {
            if (item.type === 'section') return item;
            if (item.adminOnly && user?.role?.toLowerCase() !== 'master admin') return null;
            if (item.subItems) {
              const filteredSubs = item.subItems.filter(sub => canView(sub.module));
              if (filteredSubs.length > 0) return { ...item, subItems: filteredSubs };
              return null;
            }
            return canView(item.module) ? item : null;
          }).filter(Boolean).filter((item, idx, arr) => {
            // Remove empty sections (sections followed by another section or at the end)
            if (item.type === 'section') {
              const nextItem = arr[idx + 1];
              return nextItem && nextItem.type !== 'section';
            }
            return true;
          }).map((item, idx) => {
            if (item.type === 'section') {
              return (
                <div key={`section-${idx}`} className="px-4 pt-4 pb-1 mt-1 flex items-center h-8">
                  {isSidebarOpen ? (
                    <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase w-full text-left animate-[fadeIn_0.2s_ease-out]">
                      {item.label}
                    </span>
                  ) : (
                    <div className="w-6 h-[2px] bg-slate-200/60 rounded-full mx-auto animate-[fadeIn_0.2s_ease-out]"></div>
                  )}
                </div>
              );
            }
            
            return item.subItems ? (
               <div key={item.path} id={item.id} className="flex flex-col relative group">
                 <div 
                   onClick={() => toggleMenu(item.path)} 
                   className={`flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-[13px] transition-all duration-200 cursor-pointer ${location.pathname.startsWith(item.path) ? 'bg-white shadow-sm border border-slate-200/60 text-[#286086]' : 'text-slate-500 hover:bg-white hover:shadow-sm hover:border-slate-200/50 hover:text-[#286086] border border-transparent'}`}
                 >
                   <div className="flex-shrink-0">{item.icon}</div>
                   <span className={`whitespace-nowrap flex-1 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>{item.label}</span>
                   <svg className={`w-3.5 h-3.5 transition-transform ${openMenus[item.path] || location.pathname.startsWith(item.path) ? 'rotate-180' : ''} ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                 </div>
                 
                 {/* CSS TOOLTIP */}
                 {!isSidebarOpen && (
                   <div className="absolute left-full top-[24px] -translate-y-1/2 ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-[99999] flex items-center">
                     {item.label}
                     <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2.5 h-2.5 bg-slate-800 rotate-45 rounded-[2px]"></div>
                   </div>
                 )}
                 {(openMenus[item.path] || location.pathname.startsWith(item.path)) && isSidebarOpen && (
                   <div className="flex flex-col mt-2 ml-6 pl-4 border-l-2 border-slate-200/60 space-y-1.5">
                     {item.subItems.map(sub => (
                       <NavLink key={sub.path} to={sub.path} className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg font-medium text-[12px] transition-all duration-200 ${isActive ? 'text-[#286086] bg-white shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-[#286086] hover:bg-white/60 border border-transparent'}`}>
                         {sub.label}
                       </NavLink>
                     ))}
                   </div>
                 )}
               </div>
            ) : (
              <NavLink 
                key={item.path} 
                id={item.id}
                to={item.path} 
                className={({ isActive }) => `group relative flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-[13px] transition-all duration-200 border ${isActive ? 'bg-[#286086] border-[#286086] text-white shadow-md shadow-blue-900/20' : 'border-transparent text-slate-500 hover:bg-white hover:shadow-sm hover:border-slate-200/50 hover:text-[#286086]'}`}
              >
                <div className="flex-shrink-0">{item.icon}</div>
                <span className={`whitespace-nowrap ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>{item.label}</span>
                
                {/* CSS TOOLTIP */}
                {!isSidebarOpen && (
                   <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-[99999] flex items-center">
                     {item.label}
                     <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2.5 h-2.5 bg-slate-800 rotate-45 rounded-[2px]"></div>
                   </div>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* 2. WORKSPACE CONTROLLER */}
      <div className="flex-1 flex flex-col relative h-full min-w-0">
        
        <header className="h-[75px] min-h-[75px] bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-[100]">
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <span className="text-base md:text-lg font-bold md:font-semibold text-slate-700 capitalize truncate max-w-[120px] md:max-w-none">
              {location.pathname === '/' ? 'Dashboard' : location.pathname.substring(1).replace('-', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden md:flex items-center gap-2">
              {[
                { id: 'guide', icon: <GuideIcon />, label: t('userGuide') || 'User Guide', color: 'hover:text-purple-600 hover:bg-purple-50/50' },
                { id: 'chat', icon: <ChatIcon />, label: t('chat') || 'Global Chat', color: 'hover:text-blue-600 hover:bg-blue-50/50' },
                { id: 'shortcuts', icon: <ShortcutsIcon />, label: t('shortcuts') || 'Command Center', color: 'hover:text-amber-600 hover:bg-amber-50/50' },
                { id: 'approval', icon: <ApprovalIcon />, label: t('approval') || 'Approval Center', color: 'hover:text-rose-600 hover:bg-rose-50/50', badge: pendingApprovals.length > 0 },
                { id: 'users', icon: <LiveUsersIcon />, label: t('liveUsers') || 'Live Users', color: 'hover:text-emerald-600 hover:bg-emerald-50/50' }
              ].map((btn) => {
                const isActive = btn.id === 'chat' ? chatState !== 'closed' : activePanel === btn.id;
                return (
                  <button key={btn.id} id={`action-${btn.id}`} onClick={() => handleActionClick(btn.id)} title={btn.label} className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-200 relative group shadow-sm ${isActive ? 'bg-[#286086] text-white border-[#286086]' : `bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:shadow ${btn.color}`}`}>
                    {btn.icon}
                    {btn.id === 'approval' && btn.badge && <span className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-rose-500 text-[10px] text-white flex items-center justify-center font-bold ring-2 ring-white animate-bounce shadow-sm">{pendingApprovals.length}</span>}
                    {btn.id === 'chat' && unreadCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-blue-500 text-[10px] text-white flex items-center justify-center font-bold ring-2 ring-white shadow-sm">{unreadCount}</span>}
                  </button>
                );
              })}
            </div>

            <div className="hidden md:block w-[1px] h-5 bg-slate-200 mx-1.5"></div>

            <div className="relative" ref={profileRef}>
              <button onClick={() => setProfileOpen(!profileOpen)} className={`flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-xl border transition-all duration-200 shadow-sm ${profileOpen ? 'border-[#286086] bg-[#286086]/5 ring-2 ring-[#286086]/10' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow hover:bg-slate-50'}`}>
                <div className="w-[34px] h-[34px] rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 font-extrabold text-xs uppercase shadow-inner">{initialName}</div>
                <div className="text-left hidden sm:flex flex-col max-w-[130px]">
                  <span className="text-[13px] font-bold text-slate-700 truncate leading-tight">{displayName}</span>
                  <span className="text-[10px] font-semibold text-slate-400 truncate mt-0.5 uppercase tracking-wider">{displayRole}</span>
                </div>
                <span className={`text-[9px] text-slate-400 transition-transform duration-300 select-none ml-1 ${profileOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-[240px] bg-white rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.12)] border border-slate-200 p-2 animate-[slideUpFade_0.2s_ease-out] z-[9999]">
                  <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/60 rounded-xl mb-1.5">
                    <p className="text-[9px] font-extrabold tracking-widest text-slate-400 uppercase">{t('role') || 'Access Role'}</p>
                    <p className="text-xs font-bold text-[#30528A] mt-0.5 uppercase tracking-wide truncate">{displayRole}</p>
                  </div>
                  <div className="p-1 bg-slate-100 border border-slate-200/50 rounded-xl flex gap-1 mb-1.5">
                    <button onClick={() => setLang('id')} className={`flex-1 py-1.5 text-[10px] font-extrabold rounded-lg transition-all ${lang === 'id' ? 'bg-white text-[#30528A] shadow-sm' : 'text-slate-400 hover:text-slate-800'}`}>🇮🇩 ID</button>
                    <button onClick={() => setLang('en')} className={`flex-1 py-1.5 text-[10px] font-extrabold rounded-lg transition-all ${lang === 'en' ? 'bg-white text-[#30528A] shadow-sm' : 'text-slate-400 hover:text-slate-800'}`}>🇺🇸 EN</button>
                  </div>
                  <button onClick={() => { setProfileOpen(false); setIsChangePasswordOpen(true); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><KeyIcon /> Ganti Password</button>
                  <button onClick={() => { setProfileOpen(false); Swal.fire({ icon: 'info', title: 'System Cache', text: 'Cache synchronized successfully.', confirmButtonColor: '#30528A', customClass: { popup: 'rounded-[24px] z-[99999]' } }); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><span className="text-sm text-slate-400">↻</span> {t('clearCache') || 'Clear System Cache'}</button>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all mt-0.5"><LogoutIcon /> {t('logout') || 'Sign Out'}</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 3. CONTENT OUTLET */}
        <div className="flex-1 bg-[#F8F9FA] p-3 pb-24 md:p-4 md:pb-4 overflow-hidden flex flex-col relative z-0">
          <div className="flex-1 bg-transparent overflow-hidden flex flex-col">
            <main className="flex-1 overflow-y-auto custom-scrollbar p-1">
              <Outlet />
            </main>
          </div>

          {/* 4. 🔥 SUPABASE REAL-TIME CHAT POPUP 🔥 */}
          {chatState !== 'closed' && (
            <div className={`absolute right-4 z-[990] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] bg-white border border-slate-200 shadow-[0_20px_50px_-12px_rgba(48,82,138,0.25)] overflow-hidden ${chatState === 'open' ? 'bottom-[85px] md:bottom-4 w-[340px] max-w-[calc(100vw-32px)] h-[450px] md:h-[480px] rounded-[24px]' : 'bottom-[85px] md:bottom-4 w-[240px] md:w-[280px] h-[52px] rounded-full cursor-pointer hover:bg-slate-50 hover:border-blue-300'}`}>
              <div className={`flex justify-between items-center px-4 select-none transition-colors ${chatState === 'open' ? 'py-4 bg-[#30528A] text-white rounded-t-[22px]' : 'h-full text-slate-700'}`} onClick={() => chatState === 'minimized' && setChatState('open')}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${chatState === 'open' ? 'bg-white/20' : 'bg-blue-50 text-blue-600'}`}><ChatIcon /></div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold leading-tight">Global Chat</span>
                    {chatState === 'minimized' && <span className="text-[10px] text-emerald-500 font-bold">Online</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {chatState === 'open' && <button onClick={(e) => { e.stopPropagation(); setChatState('minimized'); }} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"><span className="text-xl font-bold mb-2">_</span></button>}
                  <button onClick={(e) => { e.stopPropagation(); setChatState('closed'); }} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${chatState === 'open' ? 'hover:bg-rose-500/80' : 'hover:bg-rose-100 hover:text-rose-600'}`}><CloseIcon /></button>
                </div>
              </div>

              {chatState === 'open' && (
                <div className="flex-1 flex flex-col bg-slate-50/50">
                  
                  <div ref={chatContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
                    <div className="text-center mt-2 mb-4"><span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 px-3 py-1 rounded-full uppercase tracking-wider">Live Chat</span></div>
                    
                    {!isReady ? (
                      <div className="text-center text-xs text-slate-400 animate-pulse mt-10">Connecting to server...</div>
                    ) : messages.length === 0 ? (
                      <div className="text-center text-xs text-slate-400 mt-10">No messages yet. Be the first to say hi!</div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = msg.sender_name === displayName;
                        const timeString = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const userRole = msg.role || 'STAFF';

                        return (
                          <div key={msg.id} className={`flex gap-3 ${isMe ? 'self-end flex-col items-end' : ''} max-w-[85%] animate-[slideUpFade_0.2s_ease-out]`}>
                            
                            {!isMe && (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 border border-slate-200 flex-shrink-0 mt-1 flex items-center justify-center text-slate-600 text-[10px] font-black shadow-sm">
                                {msg.sender_name.substring(0,2).toUpperCase()}
                              </div>
                            )}
                            
                            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              
                              <div className={`flex flex-col mb-1.5 ${isMe ? 'items-end mr-1' : 'items-start ml-1'}`}>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[11px] font-extrabold ${isMe ? 'text-slate-600' : 'text-slate-700'}`}>
                                    {msg.sender_name}
                                  </span>
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md tracking-wider uppercase ${isMe ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                    {userRole}
                                  </span>
                                </div>
                                {msg.branch && msg.branch !== '-' && (
                                  <span className="text-[9px] font-semibold text-slate-400 mt-0.5 flex items-center gap-1">
                                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                    {msg.branch}
                                  </span>
                                )}
                              </div>
                              
                              <div className={`relative group px-4 py-3 rounded-[20px] text-[13px] shadow-sm ${isMe ? 'bg-[#30528A] text-white rounded-tr-sm shadow-md' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                                <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                <div className={`text-[9px] text-right mt-2 font-semibold ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                  {timeString}
                                </div>
                                
                                {isMe && (
                                  <button onClick={() => deleteMessage(msg.id)} className="absolute -left-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-rose-500 hover:text-white hover:bg-rose-500 transition-all p-2 bg-white rounded-full shadow-md border border-slate-100" title="Hapus Pesan">
                                    <TrashIcon />
                                  </button>
                                )}
                              </div>
                              
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="p-3 bg-white border-t border-slate-100 rounded-b-[24px]">
                    <form className="relative" onSubmit={handleChatSubmit}>
                      <input type="text" name="msg" placeholder="Type your message..." className="w-full bg-slate-100 border-transparent rounded-xl pl-4 pr-12 py-3 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 transition-all" autoComplete="off"/>
                      <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#30528A] rounded-lg flex items-center justify-center text-white hover:bg-blue-700 transition-colors shadow-sm"><svg className="w-4 h-4 transform translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>
                    </form>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. SLIDER PANEL KANAN */}
        <div className={`fixed top-4 bottom-4 w-[420px] bg-white rounded-[24px] z-[9999] flex flex-col border border-slate-200 shadow-[0_20px_60px_rgba(0,0,0,0.15)] transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${activePanel ? 'right-4 opacity-100' : 'right-[-460px] opacity-0 pointer-events-none'}`}>
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 rounded-t-[24px]">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <h3 className="text-xs font-extrabold text-slate-800 tracking-wider uppercase">{getPanelTitle()}</h3>
            </div>
            <button onClick={() => setActivePanel(null)} className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-rose-500 transition-colors shadow-sm"><CloseIcon /></button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-white relative">
            {isLoadingPanel && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            )}

            {activePanel === 'shortcuts' && (
              <div className="space-y-2.5 animate-[slideUpFade_0.3s_ease-out]">
                <p className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase mb-3">Keyboard Shortcuts</p>
                {[
                  { label: 'Go to Dashboard', keys: ['Alt', 'Shift', 'D'] },
                  { label: 'Manage Assets', keys: ['Alt', 'Shift', 'A'] },
                  { label: 'Borrowing Asset', keys: ['Alt', 'Shift', 'B'] },
                  { label: 'Logistics & Tracking', keys: ['Alt', 'Shift', 'L'] },
                  { label: 'Calibration Schedules', keys: ['Alt', 'Shift', 'C'] },
                  { label: 'User Managements', keys: ['Alt', 'Shift', 'U'] }
                ].map((shortcut, i) => (
                  <div key={i} className="w-full text-left p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl flex justify-between items-center group shadow-sm transition-all hover:bg-blue-50/50 hover:border-blue-200">
                    <span className="font-bold text-xs text-slate-700">{shortcut.label}</span>
                    <div className="flex gap-1.5">
                      {shortcut.keys.map((k, j) => (
                        <span key={j} className="min-w-[24px] px-1.5 h-6 rounded-md bg-white border border-slate-300 shadow-sm flex items-center justify-center text-[10px] font-black text-slate-500 uppercase font-mono">{k}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activePanel === 'approval' && (
              <div className="animate-[slideUpFade_0.3s_ease-out]">
                <p className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase mb-3">Pending Asset Approvals</p>
                {pendingApprovals.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4 border border-emerald-100"><ApprovalIcon /></div>
                    <h4 className="text-sm font-bold text-slate-800 mb-1.5">No Pending Approvals</h4>
                    <p className="text-xs font-semibold text-slate-400 max-w-[240px] mx-auto leading-relaxed">All asset tracking and deliveries are on schedule or already approved.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingApprovals.map(approval => (
                      <div key={approval.id} className="p-4 bg-blue-50 border border-blue-200 rounded-xl relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#286086]"></div>
                        <h4 className="text-sm font-bold text-[#286086] mb-1 flex justify-between">
                          <span>{approval.tracking_code}</span>
                          <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">{approval.movement_type}</span>
                        </h4>
                        <p className="text-xs font-semibold text-slate-600 mb-2">Requested by <b>{approval.sender_name}</b> for branch <b>{approval.to_location}</b>.</p>
                        <p className="text-[10px] font-medium text-slate-500 mb-3 italic">Purpose: {approval.purpose}</p>
                        <div className="flex gap-2">
                           <button onClick={() => handleApprove(approval.tracking_code)} className="flex-1 text-xs font-bold bg-[#30528A] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                             Approve
                           </button>
                           <button onClick={() => handleReject(approval.tracking_code)} className="flex-1 text-xs font-bold bg-white text-rose-600 px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors shadow-sm">
                             Reject
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activePanel === 'users' && (
              <div className="space-y-3 animate-[slideUpFade_0.3s_ease-out]">
                <p className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase mb-2">System Users Status</p>
                {systemUsers.map((u, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm transition-all ${u.isOnline ? 'border-emerald-200 bg-emerald-50/30' : 'opacity-70 grayscale-[50%]'}`}>
                    <div className={`w-10 h-10 rounded-xl font-black text-sm flex items-center justify-center border shadow-inner ${u.isOnline ? 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {(u.name || u.full_name || 'US').substring(0,2).toUpperCase()}
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="text-xs font-bold text-slate-800 flex justify-between items-center">
                        {u.name || u.full_name || 'Unknown User'} {(u.name || u.full_name) === displayName && <span className="text-[9px] bg-[#30528A] text-white px-1.5 py-0.5 rounded uppercase tracking-widest">(You)</span>}
                      </span>
                      <span className={`text-[10px] font-bold flex items-center gap-1 mt-0.5 ${u.isOnline ? 'text-emerald-500' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isOnline ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-300'}`}></span> 
                        {u.isOnline ? 'Active Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                ))}
                {systemUsers.length === 0 && !isLoadingPanel && <p className="text-xs text-slate-400 italic text-center py-10">No users found.</p>}
              </div>
            )}
          </div>
          <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 rounded-b-[24px] text-[9px] font-black text-slate-400 tracking-widest uppercase text-center flex items-center justify-center gap-1.5"><svg className="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Security Shield Enabled</div>
        </div>
      </div>
      
      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[75px] bg-white border-t border-slate-200 z-[900] flex items-center justify-between px-4 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-safe">
        <NavLink to="/dashboard" onClick={() => setIsSidebarOpen(false)} className={({isActive}) => `flex flex-col items-center gap-1.5 p-2 w-[20%] transition-all ${isActive ? 'text-[#30528A]' : 'text-slate-400 hover:text-slate-600'}`}>
          <div className={`transition-transform duration-300 ${location.pathname === '/dashboard' ? 'scale-110' : ''}`}><DashboardIcon /></div>
          <span className={`text-[10px] font-extrabold tracking-tight ${location.pathname === '/dashboard' ? 'text-[#30528A]' : ''}`}>Dashboard</span>
        </NavLink>
        <NavLink to="/assets" onClick={() => setIsSidebarOpen(false)} className={({isActive}) => `flex flex-col items-center gap-1.5 p-2 w-[20%] transition-all ${isActive ? 'text-[#30528A]' : 'text-slate-400 hover:text-slate-600'}`}>
          <div className={`transition-transform duration-300 ${location.pathname.startsWith('/assets') ? 'scale-110' : ''}`}><AssetIcon /></div>
          <span className={`text-[10px] font-extrabold tracking-tight ${location.pathname.startsWith('/assets') ? 'text-[#30528A]' : ''}`}>Assets</span>
        </NavLink>
        
        {/* CENTER ACTION (Add Asset) */}
        <div className="w-[20%] flex justify-center">
          <NavLink to="/assets" state={{ action: 'new' }} onClick={() => setIsSidebarOpen(false)} className={({isActive}) => `absolute -top-6 flex flex-col items-center justify-center w-[60px] h-[60px] rounded-full border-[5px] border-[#F8F9FA] shadow-lg transition-all duration-300 bg-[#30528A] text-white hover:scale-105`}>
            <NavLink
              to="/settings/sla-settings"
              className={({ isActive }) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive ? 'bg-[#286086] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span className="font-semibold text-sm">SLA Setting</span>
            </NavLink>

            <NavLink
              to="/settings/master-components"
              className={({ isActive }) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive ? 'bg-[#286086] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <span className="font-semibold text-sm">Master Components</span>
            </NavLink>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </NavLink>
        </div>
        
        <NavLink to="/ticketing" onClick={() => setIsSidebarOpen(false)} className={({isActive}) => `flex flex-col items-center gap-1.5 p-2 w-[20%] transition-all ${isActive ? 'text-[#30528A]' : 'text-slate-400 hover:text-slate-600'}`}>
          <div className={`transition-transform duration-300 ${location.pathname.startsWith('/ticketing') ? 'scale-110' : ''}`}><TicketIcon /></div>
          <span className={`text-[10px] font-extrabold tracking-tight ${location.pathname.startsWith('/ticketing') ? 'text-[#30528A]' : ''}`}>Tickets</span>
        </NavLink>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`flex flex-col items-center gap-1.5 p-2 w-[20%] transition-all ${isSidebarOpen ? 'text-[#30528A]' : 'text-slate-400 hover:text-slate-600'}`}>
          <div className={`transition-transform duration-300 ${isSidebarOpen ? 'scale-110' : ''}`}>
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </div>
          <span className={`text-[10px] font-extrabold tracking-tight ${isSidebarOpen ? 'text-[#30528A]' : ''}`}>Menu</span>
        </button>
      </nav>
      
      {/* CHANGE PASSWORD MODAL */}
      <BaseModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        title="Ganti Password"
        maxWidth="max-w-4xl"
        footer={
          <>
            <button type="button" onClick={() => setIsChangePasswordOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Batal</button>
            <button type="submit" form="changePasswordForm" className="px-6 py-2 text-sm font-bold bg-[#30528A] text-white rounded-xl shadow-md hover:bg-[#286086]">Simpan Password</button>
          </>
        }
      >
        <form id="changePasswordForm" onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Password Lama</label>
            <input required type="password" value={passwordForm.old_password} onChange={e => setPasswordForm({...passwordForm, old_password: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-[#286086]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Password Baru</label>
            <input required type="password" value={passwordForm.new_password} onChange={e => setPasswordForm({...passwordForm, new_password: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-[#286086]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Konfirmasi Password Baru</label>
            <input required type="password" value={passwordForm.confirm_password} onChange={e => setPasswordForm({...passwordForm, confirm_password: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-[#286086]" />
          </div>
        </form>
      </BaseModal>

      {/* USER GUIDE MODAL */}
      <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

    </div>
  );
}