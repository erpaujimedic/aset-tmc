import React, { useState } from 'react';
import useI18nStore from '../../store/i18nStore';

export default function SLASettings() {
  const { t } = useI18nStore();
  const [slaTargets, setSlaTargets] = useState({
    repair: 3,
    replacement: 5,
    calibration: 14
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // In a real app, this would make an API call to save the setting
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateTarget = (key, value) => {
    setSlaTargets(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-8 h-full flex flex-col bg-slate-50/50">

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 max-w-2xl">
        <h3 className="font-bold text-slate-800 mb-6 uppercase tracking-widest text-sm border-b border-slate-100 pb-3">Service Level Agreement (Days)</h3>
        
        <div className="space-y-6">
          
          <div className="flex items-center justify-between p-4 bg-rose-50/50 border border-rose-100 rounded-xl">
            <div>
              <h4 className="font-bold text-rose-800 text-sm">Repair / Perbaikan</h4>
              <p className="text-xs text-rose-600/70 mt-0.5 font-medium">Batas waktu tiket perbaikan aset dari Open hingga Closed.</p>
            </div>
            <input 
              type="number" 
              value={slaTargets.repair} 
              onChange={(e) => updateTarget('repair', e.target.value)}
              min="1"
              className="w-20 px-3 py-2 bg-white border border-rose-200 rounded-lg text-center font-bold text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-purple-50/50 border border-purple-100 rounded-xl">
            <div>
              <h4 className="font-bold text-purple-800 text-sm">Replacement / Pergantian Alat</h4>
              <p className="text-xs text-purple-600/70 mt-0.5 font-medium">Batas waktu logistik dan penerimaan aset pengganti di cabang.</p>
            </div>
            <input 
              type="number" 
              value={slaTargets.replacement} 
              onChange={(e) => updateTarget('replacement', e.target.value)}
              min="1"
              className="w-20 px-3 py-2 bg-white border border-purple-200 rounded-lg text-center font-bold text-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
            <div>
              <h4 className="font-bold text-emerald-800 text-sm">Calibration / Kalibrasi</h4>
              <p className="text-xs text-emerald-600/70 mt-0.5 font-medium">Batas waktu proses kalibrasi (termasuk pengiriman ke vendor/HO).</p>
            </div>
            <input 
              type="number" 
              value={slaTargets.calibration} 
              onChange={(e) => updateTarget('calibration', e.target.value)}
              min="1"
              className="w-20 px-3 py-2 bg-white border border-emerald-200 rounded-lg text-center font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 flex gap-3 mt-8">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
              Updating these values will instantly change how SLA progress bars are calculated across all active tickets in the Ticketing Center.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button 
              onClick={handleSave}
              className="bg-[#286086] hover:bg-[#1a4666] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 transition-all active:scale-95"
            >
              Save Configuration
            </button>
            {saved && (
              <span className="text-emerald-600 font-bold text-sm flex items-center gap-1 animate-[fadeIn_0.3s_ease-out]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Settings saved!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
