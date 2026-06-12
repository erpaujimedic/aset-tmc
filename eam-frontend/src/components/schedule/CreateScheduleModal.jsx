import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/themes/airbnb.css';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const CloseIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const SaveIcon = () => <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const CalendarIcon = () => <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;

const CustomSelect = ({ name, value, onChange, options, placeholder, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside both the select box and the portal dropdown
      if (ref.current && !ref.current.contains(event.target) && !event.target.closest('.custom-select-dropdown')) {
        setIsOpen(false);
      }
    };
    
    const handleScroll = (e) => {
       // Close on scroll ONLY if the scroll originated from outside the dropdown list itself
       if (isOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
           setIsOpen(false);
       }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true); // capture scroll on any element
    
    return () => {
       document.removeEventListener("mousedown", handleClickOutside);
       window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  const handleOpen = () => {
    if (!isOpen && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
    setIsOpen(!isOpen);
  };

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div 
        className="w-full h-full px-3 text-sm font-bold bg-transparent flex items-center justify-between cursor-pointer"
        onClick={handleOpen}
      >
        <span className={`truncate ${value ? "text-slate-700" : "text-slate-400"}`}>{selectedLabel}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''} shrink-0 ml-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
      
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="custom-select-dropdown z-[999999] bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-auto custom-scrollbar"
          style={dropdownStyle}
        >
          {options.map((option, idx) => (
            <div 
              key={idx}
              className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-blue-50 transition-colors ${value === option.value ? 'bg-blue-50 text-[#30528A] font-bold' : 'text-slate-600 font-medium'}`}
              onClick={() => {
                onChange({ target: { name, value: option.value } });
                setIsOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default function CreateScheduleModal({ isOpen, onClose, editingProject = null, onSaved }) {
  const [loading, setLoading] = useState(false);
  const isEditMode = !!editingProject;

  const [setupData, setSetupData] = useState({ branches: [], clients: [], marketings: [] });
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [activityDates, setActivityDates] = useState([]); // Store Date objects
  const [formData, setFormData] = useState({
    branchName: '',
    ptName: '',
    location: '',
    activityDate: '',
    activityEndDate: '', // For range mode
    jenis: '',
    target: '',
    petugas: '',
    settingDate: '',
    endDate: '',
    picName: '',
    picPhone: '',
    marketing: ''
  });

  // Memoize options to prevent Flatpickr from destroying itself on re-render
  const flatpickrOptions = useMemo(() => ({
    mode: isRangeMode ? 'range' : 'multiple',
    closeOnSelect: false,
    dateFormat: "Y-m-d",
    onReady: (selectedDates, dateStr, instance) => {
      // Avoid duplicate wrappers
      if (instance.calendarContainer.querySelector('.flatpickr-apply-wrapper')) return;
      const wrapper = document.createElement("div"); 
      wrapper.className = "flatpickr-apply-wrapper p-2 bg-white border-t border-slate-100";
      const btn = document.createElement("button"); 
      btn.type = "button"; 
      btn.className = "w-full py-2 bg-[#30528A] text-white text-xs font-black rounded-lg shadow-sm hover:bg-blue-800 transition-colors flex items-center justify-center gap-2";
      btn.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Apply Dates`;
      btn.onclick = () => { instance.close(); };
      wrapper.appendChild(btn); 
      instance.calendarContainer.appendChild(wrapper);
    }
  }), [isRangeMode]);

  const { user } = useAuthStore();
  const oldSession = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('onsite_session') || '{}'); } catch { return {}; }
  }, []);
  const uData = user && Object.keys(user).length > 0 ? user : oldSession;
  const roleStr = `${uData.role || ''} ${uData.roleType || ''}`.toUpperCase();
  const isAdminOrSpv = roleStr.includes('ADMIN') || roleStr.includes('SPV_REGIONAL') || roleStr.includes('SUPPORT') || roleStr.includes('HO') || roleStr.includes('ERP');

  const filteredClients = useMemo(() => {
    if (!formData.branchName) return setupData.clients;
    return setupData.clients.filter(c => {
      let branches = [];
      try { branches = typeof c.aksesCabang === 'string' ? JSON.parse(c.aksesCabang) : c.aksesCabang; } catch (e) { branches = [c.aksesCabang]; }
      if (!Array.isArray(branches)) branches = [branches];
      return branches.includes('ALL') || branches.includes(formData.branchName);
    });
  }, [setupData.clients, formData.branchName]);

  useEffect(() => {
    if (isOpen) {
      // Fetch dynamic options from backend
      api.get('/master/setup-data').then(res => {
        if (res.data && res.data.success) {
          setSetupData({
            branches: res.data.branches || [],
            clients: res.data.clients || [],
            marketings: res.data.marketings || []
          });
        }
      }).catch(err => console.error("Failed to load setup data:", err));

      if (editingProject) {
        // Check if the date is a range
        const isRange = editingProject.date?.includes(' - ');
        const [start, end] = isRange ? editingProject.date.split(' - ') : [editingProject.date, ''];
      
        setIsRangeMode(isRange);
        // Parse activity dates back to Array if possible, for edit mode
        let parsedDates = [];
        if (editingProject.date) {
           if (isRange) {
             parsedDates = editingProject.date.split(' - ');
           } else if (editingProject.date.includes(',')) {
             parsedDates = editingProject.date.split(', ');
           } else {
             parsedDates = [editingProject.date];
           }
        }
        setActivityDates(parsedDates);

        setFormData({
          branchName: editingProject.branch || '',
          ptName: editingProject.company || '',
          location: editingProject.location || '',
          jenis: editingProject.type || '',
          target: editingProject.target || '',
          petugas: editingProject.petugas || '',
          settingDate: editingProject.settingDate || '',
          endDate: editingProject.endDate || '',
          picName: editingProject.picOnsite || '',
          picPhone: editingProject.picPhone || '',
          marketing: editingProject.marketing || ''
        });
      } else {
        // Reset form on open Create
        setFormData({
          branchName: isAdminOrSpv ? '' : (uData.branchName || ''),
          ptName: '',
          location: '',
          jenis: '',
          target: '',
          petugas: '',
          settingDate: '',
          endDate: '',
          picName: '',
          picPhone: '',
          marketing: ''
        });
      }
    }
  }, [isOpen, editingProject]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'ptName') {
        const client = setupData.clients.find(c => c.perusahaan === value);
        if (client) {
          let locs = [];
          try { locs = typeof client.lokasiJson === 'string' ? JSON.parse(client.lokasiJson) : client.lokasiJson; } catch { locs = [client.lokasiJson]; }
          if (!Array.isArray(locs)) locs = [locs];
          next.location = locs.filter(Boolean).join(', ');
          next.marketing = client.defaultMarketing || '';
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
         branchName: formData.branchName,
         ptName: formData.ptName,
         locationText: formData.location, 
         activityDate: isRangeMode && activityDates.length === 2 
            ? `${formatDateObj(activityDates[0])} - ${formatDateObj(activityDates[1])}`
            : activityDates.map(d => formatDateObj(d)).join(', '),
         jenis: formData.jenis,
         target: formData.target,
         petugas: formData.petugas,
         settingDate: formData.settingDate,
         endDate: formData.endDate,
         picOnsite: formData.picName,
         noHpPic: formData.picPhone,
         marketing: formData.marketing
      };

      if (isEditMode) {
        payload.projectId = editingProject.id;
        await api.post('/schedule/update_event', payload);
      } else {
        await api.post('/schedule/create_new_event', payload);
      }
      
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Failed to save schedule.");
    } finally {
      setLoading(false);
    }
  };

  // Custom Date Formatter for Flatpickr Display
  const formatGroupedDates = (datesArray) => {
    if (!datesArray || datesArray.length === 0) return "";
    
    // Sort dates
    const sorted = [...datesArray].sort((a, b) => a - b);
    
    // Group by Month and Year
    const groups = {};
    sorted.forEach(d => {
      const key = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); // "Jun 2026"
      if (!groups[key]) groups[key] = [];
      groups[key].push(d.getDate());
    });

    const formattedGroups = Object.keys(groups).map(monthYear => {
      const days = groups[monthYear];
      const uniqueDays = [...new Set(days)].sort((a, b) => a - b);
      
      const ranges = [];
      let start = uniqueDays[0];
      let prev = uniqueDays[0];
      
      for (let i = 1; i <= uniqueDays.length; i++) {
        const curr = uniqueDays[i];
        if (curr === prev + 1) {
          prev = curr;
        } else {
          if (start === prev) {
            ranges.push(`${start}`);
          } else {
            ranges.push(`${start}-${prev}`);
          }
          start = curr;
          prev = curr;
        }
      }
      
      let daysString = "";
      if (ranges.length === 1) {
        daysString = ranges[0];
      } else {
        const last = ranges.pop();
        daysString = ranges.join(', ') + ' & ' + last;
      }
      
      return `${daysString} ${monthYear}`;
    });

    return formattedGroups.join(' | ');
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="relative z-[99999]">
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[3px] transition-opacity animate-[fadeIn_0.2s_ease-out]" 
        onClick={onClose}
      />
      
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div className="w-full max-w-4xl bg-white shadow-2xl rounded-2xl flex flex-col pointer-events-auto animate-[slideUpFade_0.3s_cubic-bezier(0.16,1,0.3,1)] overflow-hidden max-h-[95vh]">
          
          {/* Header */}
          <div className="relative border-b border-slate-100 bg-white py-4 px-6 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <CalendarIcon />
              <h2 className="text-[17px] font-black text-[#30528A] tracking-tight">
                {isEditMode ? 'Edit Schedule' : 'Create New Schedule'}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-50/50">
            
            {/* Info Banner */}
            <div className="bg-blue-50/80 border border-blue-100 rounded-lg p-2.5 flex items-center gap-3 mb-4">
              <div className="w-5 h-5 rounded-full bg-[#30528A] text-white flex items-center justify-center text-[10px] font-bold">i</div>
              <p className="text-xs font-bold text-[#30528A]">Ensure Client & Date data are valid before saving.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-3">
               
               {/* Row 1: Branch */}
               {isAdminOrSpv && (
                 <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden h-9 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all bg-white">
                    <div className="bg-white px-4 flex items-center justify-center border-r border-slate-200 h-full shrink-0">
                      <span className="text-xs font-black text-slate-500">Branch</span>
                    </div>
                    <CustomSelect 
                      name="branchName" 
                      value={formData.branchName} 
                      onChange={handleChange} 
                      placeholder="-- Select Branch --"
                      options={setupData.branches.map(b => ({ label: b.name, value: b.name }))}
                      className="flex-1 h-full"
                    />
                 </div>
               )}
               
               {/* Row 2: Client & Location */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                       <label className="block text-xs font-black text-slate-700">Client / Company <span className="text-red-500">*</span></label>
                       <button type="button" className="text-[10px] font-bold text-[#30528A] hover:underline flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                          Request Here
                       </button>
                    </div>
                    <div className="flex gap-2">
                      <CustomSelect 
                        name="ptName" 
                        value={formData.ptName} 
                        onChange={handleChange} 
                        placeholder={formData.branchName ? "-- Select Client --" : "-- Select Branch First --"}
                        options={filteredClients.map(c => ({ label: c.perusahaan, value: c.perusahaan }))}
                        className="flex-1 h-9 border border-slate-200 rounded-lg focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all bg-white"
                      />
                      <button type="button" className="w-9 h-9 flex items-center justify-center border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">Location <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input type="text" name="location" value={formData.location} onChange={handleChange} required placeholder="-- Select Client First --" className="w-full h-9 px-3 pr-10 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"/>
                      <div className="absolute right-2 top-1 w-7 h-7 bg-slate-50 border border-slate-200 rounded flex items-center justify-center text-slate-400">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                      </div>
                    </div>
                  </div>
               </div>

               {/* Row 3: Activity Date & Onsite Type */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                       <label className="block text-xs font-black text-slate-700">Activity Date <span className="text-red-500">*</span></label>
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500">Range Mode:</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={isRangeMode} onChange={() => { setIsRangeMode(!isRangeMode); setActivityDates([]); }} className="sr-only peer" />
                            <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#30528A]"></div>
                          </label>
                       </div>
                    </div>
                    <div className="relative">
                      <Flatpickr
                        value={activityDates}
                        onChange={dates => setActivityDates(dates)}
                        options={flatpickrOptions}
                        className="w-full h-9 px-3 text-sm font-bold text-[#30528A] bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all cursor-pointer opacity-0 absolute inset-0 z-10"
                      />
                      <div className="w-full h-9 px-3 text-sm font-bold text-[#30528A] bg-white border border-slate-200 rounded-lg outline-none flex items-center justify-between">
                         <span className="truncate">{formatGroupedDates(activityDates) || (isRangeMode ? "Select Date Range..." : "Select Dates...")}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">Onsite Type <span className="text-red-500">*</span></label>
                    <CustomSelect 
                      name="jenis" 
                      value={formData.jenis} 
                      onChange={handleChange} 
                      placeholder="-- Select Type --"
                      options={[
                        { label: 'MCU', value: 'MCU' },
                        { label: 'Vaccine', value: 'Vaccine' },
                        { label: 'Laboratory', value: 'Laboratory' },
                        { label: 'Screening X-Ray', value: 'Screening X-Ray' },
                        { label: 'Others', value: 'Others' }
                      ]}
                      className="w-full h-9 border border-slate-200 rounded-lg focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all bg-white"
                    />
                  </div>
               </div>

               {/* Row 4: 4 Columns */}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">Target Pax</label>
                    <input type="number" name="target" value={formData.target} onChange={handleChange} placeholder="0" className="w-full h-9 px-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-blue-500 outline-none"/>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">Total Staff</label>
                    <input type="number" name="petugas" value={formData.petugas} onChange={handleChange} placeholder="0" className="w-full h-9 px-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-blue-500 outline-none"/>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">Setup Date</label>
                    <Flatpickr
                      value={formData.settingDate}
                      onChange={([date]) => setFormData(prev => ({...prev, settingDate: date ? date.toLocaleDateString('en-GB') : ''}))}
                      options={{ dateFormat: "d/m/Y" }}
                      placeholder="mm/dd/yyyy"
                      className="w-full h-9 px-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-blue-500 outline-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">End Date</label>
                    <Flatpickr
                      value={formData.endDate}
                      onChange={([date]) => setFormData(prev => ({...prev, endDate: date ? date.toLocaleDateString('en-GB') : ''}))}
                      options={{ dateFormat: "d/m/Y" }}
                      placeholder="mm/dd/yyyy"
                      className="w-full h-9 px-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-blue-500 outline-none cursor-pointer"
                    />
                  </div>
               </div>

               {/* Row 5: 3 Columns */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-red-500 mb-1.5">PIC Full Name</label>
                    <input type="text" name="picName" value={formData.picName} onChange={handleChange} placeholder="Type Name..." className="w-full h-9 px-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-blue-500 outline-none"/>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 mb-1.5">Phone No.</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-500">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                      </div>
                      <input type="text" name="picPhone" value={formData.picPhone} onChange={handleChange} placeholder="E.g., 0812xxxx" className="w-full h-9 pl-9 pr-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-blue-500 outline-none"/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 mb-1.5">Marketing</label>
                    <CustomSelect 
                      name="marketing" 
                      value={formData.marketing} 
                      onChange={handleChange} 
                      placeholder="-- Select Marketing --"
                      options={setupData.marketings.map(m => ({ label: m.nama, value: m.nama }))}
                      className="w-full h-9 border border-slate-200 rounded-lg focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all bg-white"
                    />
                  </div>
               </div>

            </div>
          </form>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-white py-4 px-6 flex items-center justify-end gap-3 z-10">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-full text-sm font-black text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center px-6 py-2.5 rounded-full text-sm font-black text-white bg-[#30528A] hover:bg-blue-800 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Saving...' : <><SaveIcon /> Save Schedule</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
