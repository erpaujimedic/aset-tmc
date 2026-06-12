import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';

const CloseIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const CheckIcon = () => <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;

export default function UpdateActualsModal({ isOpen, onClose, project, onSaved }) {
  const [activeTab, setActiveTab] = useState('gap'); // 'gap' or 'issues'
  const [loading, setLoading] = useState(false);
  const [dailyData, setDailyData] = useState([]);
  
  // Gap State
  const [gapType, setGapType] = useState('');
  const [gapQty, setGapQty] = useState('');
  const [gapDate, setGapDate] = useState('');

  useEffect(() => {
    if (isOpen && project) {
      setDailyData(project.daily || Array(31).fill(0));
      // You could map the exact days of the month here based on project.date
    }
  }, [isOpen, project]);

  if (!isOpen || !project) return null;

  // Mock calendar generation (for visual purpose)
  const renderCalendar = () => {
    const days = [];
    for (let i = 1; i <= 31; i++) {
      const val = dailyData[i - 1] || 0;
      days.push(
        <div key={i} className={`p-2 border rounded-lg flex flex-col justify-between h-16 cursor-pointer hover:border-blue-500 transition-colors ${val > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
          <div className="text-[10px] font-bold text-slate-400">{i}</div>
          <div className="text-center font-black text-slate-700">{val > 0 ? val : '-'}</div>
        </div>
      );
    }
    return days;
  };

  const handleSaveGap = async () => {
    if (!gapType || !gapQty || !gapDate) return alert("Fill all gap fields!");
    setLoading(true);
    try {
      // Mapping to old backend logic or placeholder
      const payload = {
        projectId: project.id,
        date: gapDate,
        type: gapType,
        qty: parseInt(gapQty)
      };
      await api.post('/schedule/update_inline_target', payload);
      onSaved();
    } catch (e) {
      console.error(e);
      alert("Failed to save GAP.");
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div className="relative z-[99999]">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity animate-[fadeIn_0.2s_ease-out]" onClick={onClose} />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl bg-white shadow-2xl rounded-2xl flex flex-col animate-[slideUpFade_0.3s_cubic-bezier(0.16,1,0.3,1)] overflow-hidden h-[85vh]">
          
          {/* Header */}
          <div className="border-b border-slate-100 bg-white py-4 px-6 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <CheckIcon />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Update Achievement</h2>
                <p className="text-xs font-bold text-[#30528A] uppercase tracking-wider">{project.company}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <CloseIcon />
            </button>
          </div>

          {/* Body Split */}
          <div className="flex flex-1 overflow-hidden">
            
            {/* Left: Calendar Grid */}
            <div className="w-3/5 border-r border-slate-100 p-6 flex flex-col bg-slate-50/50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-[#30528A] tracking-wider uppercase">Daily Actuals</h3>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-white border border-slate-200 text-slate-500 text-[9px] font-black rounded-md">Empty</span>
                  <span className="px-2 py-1 bg-blue-50 border border-blue-200 text-blue-600 text-[9px] font-black rounded-md">Filled</span>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[10px] font-black text-slate-400">
                <div className="text-red-400">SUN</div><div>MON</div><div>TUE</div><div>WED</div><div>THU</div><div>FRI</div><div>SAT</div>
              </div>
              
              <div className="grid grid-cols-7 gap-2 overflow-y-auto custom-scrollbar pr-2 pb-4">
                {renderCalendar()}
              </div>

              <div className="mt-auto pt-4 border-t border-slate-200">
                 <button className="w-full py-2.5 bg-[#30528A] text-white font-black rounded-xl hover:bg-blue-800 transition-colors shadow-sm text-sm">
                    Save Daily Actuals
                 </button>
              </div>
            </div>

            {/* Right: Tabs */}
            <div className="w-2/5 flex flex-col bg-white">
              <div className="p-2 border-b border-slate-100">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => setActiveTab('gap')} className={`flex-1 py-1.5 text-xs font-black rounded-md transition-all ${activeTab === 'gap' ? 'bg-white shadow-sm text-[#30528A]' : 'text-slate-500'}`}>
                    GAP Allocations
                  </button>
                  <button onClick={() => setActiveTab('issues')} className={`flex-1 py-1.5 text-xs font-black rounded-md transition-all ${activeTab === 'issues' ? 'bg-white shadow-sm text-[#30528A]' : 'text-slate-500'}`}>
                    Issue Logs
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                {activeTab === 'gap' && (
                  <div className="flex flex-col gap-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex gap-2 mb-3">
                        <input type="date" value={gapDate} onChange={e => setGapDate(e.target.value)} className="flex-1 px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
                      </div>
                      <div className="flex gap-2 mb-3">
                        <select value={gapType} onChange={e => setGapType(e.target.value)} className="flex-1 px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg outline-none focus:border-blue-500">
                          <option value="">Select Type...</option>
                          <option value="Resign/PHK">Resign/PHK (-)</option>
                          <option value="Leave">Leave (-)</option>
                          <option value="On Clinic">On Clinic (+)</option>
                        </select>
                        <input type="number" value={gapQty} onChange={e => setGapQty(e.target.value)} placeholder="Pax" className="w-20 px-3 py-2 text-sm text-center font-black border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
                      </div>
                      <button onClick={handleSaveGap} disabled={loading} className="w-full py-2 bg-slate-800 text-white text-xs font-black rounded-lg hover:bg-slate-700 transition-colors">
                        {loading ? 'Adding...' : 'Add GAP'}
                      </button>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">History</h4>
                      {/* History list could be parsed from project.gapData */}
                      <div className="text-center text-slate-400 text-xs py-4">History will appear here</div>
                    </div>
                  </div>
                )}

                {activeTab === 'issues' && (
                  <div className="flex flex-col gap-4 animate-[fadeIn_0.2s_ease-out]">
                     <textarea className="w-full p-3 text-sm font-semibold border border-slate-300 rounded-xl outline-none focus:border-blue-500 min-h-[120px]" placeholder="Type field issues..."></textarea>
                     <button className="w-full py-2 bg-slate-800 text-white text-xs font-black rounded-lg hover:bg-slate-700 transition-colors">
                        Save Issue
                      </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
