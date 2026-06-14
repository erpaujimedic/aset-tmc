import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../services/api';
import useI18nStore from '../store/i18nStore';
import useSWR from 'swr';
import ShimmerLoader from '../components/ui/ShimmerLoader';
import Swal from 'sweetalert2';

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import useAuthStore from '../store/authStore';

export default function Dashboard() {
  const { t } = useI18nStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [calibrationAlerts, setCalibrationAlerts] = useState([]);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMapItem, setSelectedMapItem] = useState(null);
  
  // Advanced Filter States
  const [filterRegion, setFilterRegion] = useState('All');
  const [filterBranch, setFilterBranch] = useState('All');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [regionSearch, setRegionSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [branchChartPage, setBranchChartPage] = useState(0);

  // SWR Fetchers
  const fetchStats = url => api.get(url).then(res => res.data);
  const fetchCalibrations = url => api.get(url).then(res => res.data.data || []);
  const fetchSetup = url => api.get(url).then(res => res.data.branches || []);
  const fetchAssets = url => api.get(url).then(res => res.data.data || []);

  const defaultStats = {
    totalAssets: 0,
    inTransit: 0,
    maintenance: 0,
    openTickets: 0,
    totalBranches: 0,
    statusDistribution: [],
    assetGrowth: [],
    recentActivities: [],
    alerts: []
  };
  
  const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';
  const isAdminSystem = ['Master Admin', 'Admin System'].includes(user?.role);
  const apiBranchParam = (isAdminSystem || isAllBranch) ? '' : (Array.isArray(user?.branch) ? user.branch.join(',') : user?.branch);

  const statsEndpoint = apiBranchParam ? `/dashboard/stats?branch=${encodeURIComponent(apiBranchParam)}` : '/dashboard/stats';
  const { data: stats = defaultStats, isLoading: isStatsLoading, mutate: mutateStats } = useSWR(statsEndpoint, fetchStats);
  
  const calEndpoint = apiBranchParam ? `/calibrations?branch=${encodeURIComponent(apiBranchParam)}` : '/calibrations';
  const { data: allCalibrations = [], isLoading: isCalLoading } = useSWR(calEndpoint, fetchCalibrations);
  
  const { data: mapBranches = [] } = useSWR('/master/setup-data', fetchSetup);
  
  const assetsEndpoint = apiBranchParam ? `/assets?branch=${encodeURIComponent(apiBranchParam)}` : '/assets';
  const { data: allAssets = [] } = useSWR(assetsEndpoint, fetchAssets);

  const [hasShownTicketAlert, setHasShownTicketAlert] = useState(false);

  useEffect(() => {
    if (!isCalLoading && allCalibrations.length > 0) {
      const expired = allCalibrations.filter(c => c.status === 'Expired');
      const soon = allCalibrations.filter(c => c.status === 'Valid' && new Date(c.next_calibration_date) < new Date(Date.now() + 30*24*60*60*1000));
      setCalibrationAlerts([...expired, ...soon]);
    }
  }, [allCalibrations, isCalLoading]);

  // SMART ALERT FOR TICKETS
  useEffect(() => {
    if (!isStatsLoading && stats?.ticketStats && !hasShownTicketAlert) {
      const openCount = stats.ticketStats.Open || 0;
      const inProgressCount = stats.ticketStats["In Progress"] || 0;
      
      if (openCount > 0 || inProgressCount > 0) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'warning',
          title: `Ada ${openCount} tiket Open & ${inProgressCount} In Progress.`,
          showConfirmButton: false,
          timer: 6000,
          timerProgressBar: true,
          background: '#fff',
          iconColor: '#e11d48',
          customClass: { title: 'text-sm font-bold text-slate-700' }
        });
        setHasShownTicketAlert(true);
      }
    }
  }, [isStatsLoading, stats, hasShownTicketAlert]);

  // DYNAMIC COMPUTATIONS (Optimized with useMemo)
  const branchMap = React.useMemo(() => {
    const map = {};
    mapBranches.forEach(b => {
      if (b.name) map[b.name.toLowerCase()] = b;
      if (b.branch_code) map[b.branch_code.toLowerCase()] = b;
    });
    return map;
  }, [mapBranches]);

  const { filteredAssets, dynTotalAssets, dynInTransit, dynMaintenance, regionCounts, branchCounts } = React.useMemo(() => {
    const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';
    const baseAssets = (['Master Admin', 'Admin System'].includes(user?.role) || isAllBranch)
      ? allAssets 
      : allAssets.filter(a => {
          if (Array.isArray(user?.branch)) return user.branch.includes(a.branch);
          return a.branch === user?.branch;
        });

    const filtered = baseAssets.filter(a => {
      const branchLower = a.branch?.toLowerCase();
      if (filterRegion !== 'All' && filterRegion !== 'All Regions') {
        const branchInfo = branchLower ? branchMap[branchLower] : null;
        let reg = branchInfo?.region;
        if (!reg) {
          reg = branchLower === 'head office' ? 'Head Office' : 'Onsite / Field';
        }
        if (reg !== filterRegion) return false;
      }
      if (filterBranch !== 'All' && filterBranch !== 'All Branches' && a.branch !== filterBranch) return false;
      return true;
    });

    let dynInTransit = 0;
    let dynMaintenance = 0;
    const rCounts = {};
    const bCounts = {};

    filtered.forEach(a => {
      if (a.status === 'Deployed' || a.status === 'In Transit') dynInTransit++;
      if (a.status === 'Maintenance') dynMaintenance++;

      const branchLower = a.branch?.toLowerCase();
      const branchInfo = branchLower ? branchMap[branchLower] : null;
      let reg = branchInfo?.region;
      if (!reg) {
        reg = branchLower === 'head office' ? 'Head Office' : 'Onsite / Field';
      }
      rCounts[reg] = (rCounts[reg] || 0) + 1;

      const br = a.branch || 'Unassigned';
      bCounts[br] = (bCounts[br] || 0) + 1;
    });

    return {
      filteredAssets: filtered,
      dynTotalAssets: filtered.length,
      dynInTransit,
      dynMaintenance,
      regionCounts: rCounts,
      branchCounts: bCounts
    };
  }, [allAssets, filterRegion, filterBranch, branchMap]);

  const regionChartData = Object.entries(regionCounts).map(([name, value]) => ({ name, value }));
  const allSortedBranches = Object.entries(branchCounts).sort((a,b) => b[1] - a[1]);
  const branchesPerPage = 5;
  const totalBranchPages = Math.max(1, Math.ceil(allSortedBranches.length / branchesPerPage));
  const currentBranchPage = Math.min(branchChartPage, Math.max(0, totalBranchPages - 1));
  const topBranches = allSortedBranches.slice(currentBranchPage * branchesPerPage, (currentBranchPage + 1) * branchesPerPage);
  const branchChartCategories = topBranches.map(t => t[0]);
  const branchChartValues = topBranches.map(t => t[1]);

  const regionChartOptions = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { show: false },
    series: [
      {
        name: 'Assets by Region',
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
        label: { show: true, formatter: '{b}\n{c} Assets', fontSize: 11, fontWeight: 'bold', color: '#475569' },
        labelLine: { show: true, length: 15, length2: 15, smooth: true },
        data: regionChartData.length ? regionChartData : [{ name: 'No Data', value: 0 }]
      }
    ]
  };

  const branchChartOptions = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '8%', top: '5%', bottom: '5%', containLabel: true },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
    yAxis: { type: 'category', data: branchChartCategories.reverse(), axisLabel: { fontSize: 10, width: 90, overflow: 'truncate' } },
    series: [
      {
        name: 'Total Assets',
        type: 'bar',
        barWidth: '45%',
        itemStyle: { color: '#286086', borderRadius: [0, 4, 4, 0] },
        data: branchChartValues.reverse()
      }
    ]
  };

  const getBranchIcon = (region) => {
    const colors = { 'Region 1': '#3b82f6', 'Region 2': '#10b981', 'Region 3': '#f59e0b', 'Region 4': '#8b5cf6', 'default': '#286086' };
    const color = colors[region] || colors['default'];
    return L.divIcon({
      className: 'custom-branch-marker',
      html: `<div style="background-color: ${color}; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; position: relative;">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M9 8h1"></path><path d="M9 12h1"></path><path d="M9 16h1"></path><path d="M14 8h1"></path><path d="M14 12h1"></path><path d="M14 16h1"></path><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"></path></svg>
               <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid ${color};"></div>
             </div>`,
      iconSize: [36, 42],
      iconAnchor: [18, 42],
      popupAnchor: [0, -42]
    });
  };

  const getAssetIcon = (status) => {
    const colors = { 'Active': '#10b981', 'Maintenance': '#f43f5e', 'Deployed': '#3b82f6' };
    const color = colors[status] || '#64748b';
    return L.divIcon({
      className: 'custom-asset-marker',
      html: `<div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; position: relative;">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
               <div style="position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid ${color};"></div>
             </div>`,
      iconSize: [28, 33],
      iconAnchor: [14, 33],
      popupAnchor: [0, -33]
    });
  };

  // Derived State
  const activeStats = stats || defaultStats;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-[fadeIn_0.3s_ease-out]">
      
      {/* UNIFIED STICKY TOP BAR & KPI (Always visible on Overview, Top Bar always visible on Map) */}
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md pt-4 pb-4 mb-6">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center w-full gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm relative z-50">
          {/* LEFT: Primary Navigation & Filters */}
          <div className="flex items-center gap-2 relative z-50 flex-1 min-w-0 flex-wrap xl:flex-nowrap shrink-0">
            {/* Refresh Button */}
            <button 
              onClick={() => mutateStats()} 
              title={t('refreshData') || 'Refresh Data'}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all shrink-0"
            >
              <svg className={`w-4 h-4 ${isStatsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>

            {/* Custom Filters */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm relative z-50 shrink-0 h-10">
              <svg className="w-4 h-4 text-[#286086] ml-2 mr-1 shrink-0 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              
              {openDropdown && (
                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)}></div>
              )}
              
              <div className="relative h-8 flex items-center shrink-0">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === 'region' ? null : 'region')}
                  className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold px-3 outline-none cursor-pointer flex items-center gap-2 transition-colors relative z-50"
                >
                  <span className="truncate max-w-[120px]">{filterRegion === 'All Regions' || filterRegion === 'All' ? t('allRegions') || 'All Regions' : filterRegion}</span>
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

              <div className="w-px h-5 bg-slate-200 shrink-0 mx-1"></div>
              
              <div className="relative h-8 flex items-center shrink-0">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === 'branch' ? null : 'branch')}
                  className="bg-transparent h-full text-slate-700 hover:text-[#286086] text-xs font-bold px-3 outline-none cursor-pointer flex items-center gap-2 transition-colors relative z-50"
                >
                  <span className="truncate max-w-[160px]">{filterBranch === 'All Branches' || filterBranch === 'All' ? t('allBranches') || 'All Branches' : filterBranch}</span>
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

            <div className="w-px h-6 bg-slate-200 mx-1 shrink-0 hidden sm:block"></div>

            {/* TABS */}
            <div className="bg-slate-200/60 p-1 rounded-xl flex gap-1 border border-slate-200/50 shadow-inner h-10 items-center shrink-0">
              <button onClick={() => setActiveTab('overview')} className={`px-4 py-1.5 h-full rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-white text-[#286086] shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                Overview
              </button>
              <button onClick={() => setActiveTab('map')} className={`px-4 py-1.5 h-full rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'map' ? 'bg-white text-[#286086] shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Geographic Map
              </button>
            </div>
          </div>

          {/* RIGHT: Actions */}
          <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto shrink-0 justify-between xl:justify-end">
            {user?.role === 'Sandbox Admin' && (
              <button 
                onClick={() => {
                  Swal.fire({
                    title: 'Reset Data Sandbox?',
                    text: 'Semua Aset, Tiket, dan Pergerakan di akun dummy akan dihapus permanen. Lanjutkan?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#EC363A',
                    cancelButtonColor: '#94a3b8',
                    confirmButtonText: 'Ya, Bersihkan!',
                    cancelButtonText: 'Batal'
                  }).then(async (result) => {
                    if (result.isConfirmed) {
                      try {
                        Swal.fire({ title: 'Membersihkan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                        await api.post('/dashboard/reset-sandbox');
                        await mutateStats();
                        Swal.fire('Berhasil!', 'Data sandbox telah di-reset.', 'success');
                      } catch (err) {
                        Swal.fire('Gagal', 'Terjadi kesalahan saat mereset data', 'error');
                      }
                    }
                  });
                }} 
                className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-4 h-10 rounded-xl flex items-center justify-center border border-red-200 shadow-sm transition-all shrink-0 text-[11px]"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Reset Sandbox
              </button>
            )}

            <div className="flex gap-2 w-full sm:w-auto justify-center shrink-0">
              <button onClick={() => navigate('/deliveries')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 h-10 rounded-xl font-bold text-[11px] shadow-sm transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none">
                <svg className="w-4 h-4 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                {t('dispatchAsset')}
              </button>
              <button onClick={() => navigate('/assets', { state: { action: 'new' } })} className="bg-[#286086] hover:bg-[#1a4666] text-white px-4 h-10 rounded-xl font-bold text-[11px] shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none whitespace-nowrap">
                <span className="text-sm leading-none">+</span> {t('addNewAsset')}
              </button>
            </div>
          </div>
        </div>

        {/* SHIMMER STATE FOR KPI */}
        {isStatsLoading ? (
          <div className="mt-4 flex md:grid md:grid-cols-4 gap-4 overflow-x-auto custom-scrollbar pb-2">
            <ShimmerLoader type="card" className="h-[100px] shrink-0 w-[75vw] sm:w-[240px] md:w-auto" />
            <ShimmerLoader type="card" className="h-[100px] shrink-0 w-[75vw] sm:w-[240px] md:w-auto" />
            <ShimmerLoader type="card" className="h-[100px] shrink-0 w-[75vw] sm:w-[240px] md:w-auto" />
            <ShimmerLoader type="card" className="h-[100px] shrink-0 w-[75vw] sm:w-[240px] md:w-auto" />
          </div>
        ) : (
          <>
            {/* STICKY KPI SECTION (Only shown in Overview tab) */}
            {activeTab === 'overview' && (
              <div className="mt-4">
            <div className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto custom-scrollbar pb-2 snap-x snap-mandatory">
              {[
                { label: 'Total Assets', value: dynTotalAssets, icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', color: 'text-blue-600', bg: 'bg-blue-50', onClick: null },
                { label: 'Deployed / In Transit', value: dynInTransit, icon: 'M13 10V3L4 14h7v8l9-11h-7z', color: 'text-purple-600', bg: 'bg-purple-50', onClick: null },
                { label: 'Maintenance', value: dynMaintenance, icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', color: 'text-amber-600', bg: 'bg-amber-50', onClick: null },
                { label: 'Ticket Open', value: stats.openTickets || 0, icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z', color: 'text-rose-600', bg: 'bg-rose-50', onClick: () => navigate('/ticketing') },
              ].map((metric, i) => (
                <div key={i} onClick={metric.onClick} className={`shrink-0 w-[75vw] sm:w-[240px] md:w-auto snap-center bg-white/80 rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-4 transition-all ${metric.onClick ? 'cursor-pointer hover:border-rose-300 hover:shadow-md hover:-translate-y-0.5' : ''}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${metric.bg}`}>
                    <svg className={`w-6 h-6 ${metric.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d={metric.icon} /></svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{metric.label}</p>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">{metric.value}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
        )}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* CHARTS SECTION */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col">
                  <h3 className="text-sm font-black text-slate-800 mb-2 uppercase tracking-widest">Assets per Region</h3>
                  <div className="flex-1 min-h-[260px]">
                    <ReactECharts option={regionChartOptions} style={{ height: '100%' }} />
                  </div>
                </div>
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col relative">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Top Branches (Assets)</h3>
                    <div className="flex gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                      <button 
                        onClick={() => setBranchChartPage(p => Math.max(0, p - 1))}
                        disabled={currentBranchPage === 0}
                        className="p-1 rounded-md text-slate-400 hover:text-[#286086] hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <button 
                        onClick={() => setBranchChartPage(p => Math.min(totalBranchPages - 1, p + 1))}
                        disabled={currentBranchPage >= totalBranchPages - 1}
                        className="p-1 rounded-md text-slate-400 hover:text-[#286086] hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-[260px]">
                    <ReactECharts option={branchChartOptions} style={{ height: '100%' }} />
                  </div>
                </div>
              </div>

              {/* CALIBRATION ALERTS - SLEEK UI */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Action Required: Calibrations ({calibrationAlerts.length})
                  </h3>
                </div>
                <div className="p-0 overflow-y-auto max-h-[220px] custom-scrollbar">
                  {calibrationAlerts.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {calibrationAlerts.map((cal, idx) => (
                        <div key={idx} onClick={() => navigate('/calibrations')} className="p-3 px-4 hover:bg-slate-50 transition-colors flex justify-between items-center cursor-pointer group">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${cal.status === 'Expired' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                            <div>
                              <p className="text-sm font-bold text-slate-800 group-hover:text-[#286086] transition-colors">{cal.assets?.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{cal.asset_id} • Due: {new Date(cal.next_calibration_date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <button className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border ${cal.status === 'Expired' ? 'bg-rose-50 text-rose-700 border-rose-200 group-hover:bg-rose-500 group-hover:text-white' : 'bg-amber-50 text-amber-700 border-amber-200 group-hover:bg-amber-500 group-hover:text-white'}`}>
                            Calibrate Now
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-sm italic font-bold">All assets are properly calibrated.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
                {t('recentActivities')}
                <button onClick={() => mutateStats()} className="text-slate-400 hover:text-[#286086]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </h3>
              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {stats.recentActivities && stats.recentActivities.length > 0 ? (
                  stats.recentActivities.map(act => (
                    <div key={act.id} className="relative pl-6 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-[-16px] before:w-[2px] before:bg-slate-100 last:before:hidden">
                      <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-blue-50 border-2 border-white flex items-center justify-center shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-[#286086]"></div>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-700">{act.status_update}</h4>
                        <p className="text-xs text-slate-500 mt-1">{act.asset_name} ({act.tracking_code})</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-semibold">{new Date(act.created_at).toLocaleString()} • {act.updated_by}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 italic">{t('noRecentActivities')}</p>
                )}
              </div>
              <button onClick={() => navigate('/deliveries')} className="mt-4 w-full py-2 bg-slate-50 hover:bg-slate-100 text-[#286086] font-bold text-sm rounded-xl transition-colors border border-slate-100">
                {t('viewAllDeliveries')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAP VIEW TAB */}
      {activeTab === 'map' && (() => {
        const filteredMapBranches = mapBranches.filter(b => {
          if (filterRegion !== 'All' && b.region !== filterRegion) return false;
          if (filterBranch !== 'All' && b.name !== filterBranch) return false;
          return true;
        });
        
        return (
        <div className="h-[75vh] w-full rounded-2xl overflow-hidden border border-slate-200 flex relative z-0">
          
          <div className="flex-1 relative z-0 h-full">
            <MapContainer 
              center={[-2.5, 118.0]} 
              zoom={5} 
              minZoom={5}
              maxBounds={[[-11.0, 94.0], [6.0, 141.0]]}
              maxBoundsViscosity={1.0}
              scrollWheelZoom={true} 
              style={{ height: '100%', width: '100%', zIndex: 0 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filteredMapBranches.map(branch => {
                if (!branch.lat || !branch.lng) return null;
                const branchAssets = filteredAssets.filter(a => a.branch === branch.name || a.branch === branch.branch_code);
                return (
                  <Marker 
                    key={branch.id} 
                    position={[branch.lat, branch.lng]} 
                    icon={getBranchIcon(branch.region)}
                    eventHandlers={{
                      click: () => setSelectedMapItem({ type: 'branch', data: { ...branch, assets: branchAssets } })
                    }}
                  >
                    <Popup>
                      <div className="font-sans min-w-[140px] text-center">
                        <h4 className="font-bold text-slate-800 text-sm">{branch.name}</h4>
                        <p className="text-[10px] text-slate-500 mt-1">{branchAssets.length} Assets Found</p>
                        <p className="text-[9px] text-[#286086] mt-1 font-bold italic">Click for Full Details</p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
              
              {filteredAssets.map(asset => {
                if (!asset.lat || !asset.lng) return null;
                const myBranch = mapBranches.find(b => b.name === asset.branch || b.branch_code === asset.branch);
                if (myBranch && myBranch.lat === asset.lat && myBranch.lng === asset.lng) return null; // Clustered in branch

                return (
                  <Marker 
                    key={`asset-${asset.id}`} 
                    position={[asset.lat, asset.lng]} 
                    icon={getAssetIcon(asset.status)}
                    eventHandlers={{
                      click: () => setSelectedMapItem({ type: 'asset', data: asset })
                    }}
                  >
                    <Popup>
                      <div className="font-sans min-w-[140px] text-center">
                        <h4 className="font-bold text-slate-800 text-sm">{asset.name}</h4>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${asset.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : asset.status === 'Maintenance' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {asset.status}
                        </span>
                        <p className="text-[9px] text-[#286086] mt-2 font-bold italic">Click for Detail</p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* ADVANCED DETAIL PANEL */}
          {selectedMapItem && selectedMapItem.type === 'branch' && (
            <div className="w-96 bg-slate-50 border-l border-slate-200 flex flex-col relative z-10 animate-[slideLeftFade_0.3s_ease-out] shadow-[-10px_0_20px_rgba(0,0,0,0.02)]">
              <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-start shadow-sm">
                <div>
                  <h3 className="font-black text-slate-800 flex items-center gap-2 text-lg">
                    <svg className="w-5 h-5 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    {selectedMapItem.data.name}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${selectedMapItem.data.region === 'Region 1' ? 'bg-blue-500' : selectedMapItem.data.region === 'Region 2' ? 'bg-emerald-500' : selectedMapItem.data.region === 'Region 3' ? 'bg-amber-500' : 'bg-purple-500'}`}></span>
                    {selectedMapItem.data.region || 'Unassigned Region'}
                  </p>
                </div>
                <button onClick={() => setSelectedMapItem(null)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold text-slate-500">Total Assets Managed</span>
                  <span className="text-lg font-black text-[#286086]">{selectedMapItem.data.assets.length}</span>
                </div>

                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 pb-2">Assets in this Location</h4>
                  
                  {selectedMapItem.data.assets.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs font-bold text-slate-400">No assets registered in this branch.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedMapItem.data.assets.map(asset => {
                        const cal = allCalibrations.find(c => c.asset_id === asset.id);
                        return (
                          <div key={asset.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:border-blue-300 transition-colors group">
                            <div className="p-3 border-b border-slate-50 bg-slate-50/50 flex justify-between items-start">
                              <div>
                                <h5 className="text-sm font-bold text-slate-800 leading-tight">{asset.name}</h5>
                                <p className="text-[10px] text-slate-500 mt-0.5">{asset.id} • {asset.category}</p>
                              </div>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${asset.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : asset.status === 'Maintenance' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                {asset.status}
                              </span>
                            </div>
                            
                            {/* Detailed Dropdown inside Asset Card */}
                            <div className="p-3 bg-white text-xs space-y-2">
                              <div className="flex justify-between">
                                <span className="font-bold text-slate-500">Assignee:</span>
                                <span className="font-semibold text-slate-800">{asset.assignee || 'None'}</span>
                              </div>
                              {cal ? (
                                <div className="mt-2 pt-2 border-t border-slate-100">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Calibration:</span>
                                    <span className={`text-[9px] font-black uppercase ${cal.status === 'Valid' ? 'text-emerald-600' : cal.status === 'Expired' ? 'text-rose-600' : 'text-amber-600'}`}>{cal.status}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[9px] text-slate-400">Next Due:</span>
                                    <span className="text-[9px] font-bold text-slate-700">{new Date(cal.next_calibration_date).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-2 pt-2 border-t border-slate-100 text-[9px] text-slate-400 italic">No calibration required.</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button onClick={() => navigate('/assets')} className="w-full py-2.5 bg-white border border-[#286086] text-[#286086] font-bold text-xs rounded-xl shadow-sm hover:bg-[#286086] hover:text-white transition-colors">
                    Manage All Assets
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DETAIL PANEL FOR INDIVIDUAL ASSET (In Field) */}
          {selectedMapItem && selectedMapItem.type === 'asset' && (() => {
            const asset = selectedMapItem.data;
            const cal = allCalibrations.find(c => c.asset_id === asset.id);
            return (
              <div className="w-80 bg-slate-50 border-l border-slate-200 flex flex-col relative z-10 animate-[slideLeftFade_0.3s_ease-out] shadow-[-10px_0_20px_rgba(0,0,0,0.02)]">
                <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                  <h3 className="font-black text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#286086]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Field Asset Detail
                  </h3>
                  <button onClick={() => setSelectedMapItem(null)} className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Asset Name</p>
                      <h2 className="text-lg font-bold text-slate-800 leading-tight">{asset.name}</h2>
                      <p className="text-xs font-bold text-[#286086] mt-0.5">{asset.category}</p>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-3 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Status</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${asset.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : asset.status === 'Maintenance' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{asset.status}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Asset ID</span>
                        <span className="text-xs font-bold text-slate-800 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{asset.id}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Current Location</span>
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          <svg className="w-3 h-3 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {asset.location_name || 'Onsite Project / Field'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Home Branch</span>
                        <span className="text-xs font-bold text-slate-600">{asset.branch}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Assignee</span>
                        <span className="text-xs font-bold text-slate-800">{asset.assignee || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>

                  {cal ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        Calibration Records
                      </p>
                      <div className={`p-3 rounded-xl border flex flex-col gap-2 shadow-sm ${cal.status === 'Valid' ? 'bg-emerald-50 border-emerald-200' : cal.status === 'Expired' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800">Status</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase ${cal.status === 'Valid' ? 'bg-emerald-200 text-emerald-800' : cal.status === 'Expired' ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-800'}`}>
                            {cal.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1 pt-2 border-t border-white/50">
                          <span className="text-[10px] font-bold text-slate-600">Last Calibrated:</span>
                          <span className="text-[10px] font-bold text-slate-800">{new Date(cal.last_calibration_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-600">Next Due:</span>
                          <span className="text-[10px] font-bold text-slate-800">{new Date(cal.next_calibration_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-600">Vendor:</span>
                          <span className="text-[10px] font-bold text-slate-800">{cal.calibration_vendor}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-100 border border-slate-200 border-dashed rounded-xl p-4 text-center">
                      <p className="text-xs font-bold text-slate-400">No Calibration Data</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-200">
                    <button onClick={() => navigate('/assets')} className="w-full py-2.5 bg-white border border-[#286086] text-[#286086] font-bold text-xs rounded-xl shadow-sm hover:bg-[#286086] hover:text-white transition-colors">
                      Manage this Asset
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
        );
      })()}

    </div>
  );
}