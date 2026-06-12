import { useState, useEffect } from 'react';
import api from '../../services/api';

const CloseIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const SettingsIcon = () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const UserIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const BriefcaseIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
const PlusIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;

export default function SetupProjectModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('clients'); // 'clients' or 'marketing'
  const [setupData, setSetupData] = useState({ clients: [], marketings: [] });

  useEffect(() => {
    if (isOpen) {
      api.get('/master/setup-data').then(res => {
        if (res.data && res.data.success) {
          setSetupData({
            clients: res.data.clients || [],
            marketings: res.data.marketings || []
          });
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className={`fixed top-4 bottom-4 w-[420px] bg-white rounded-[24px] z-[9999] flex flex-col border border-slate-200 shadow-[0_20px_60px_rgba(0,0,0,0.15)] transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'right-4 opacity-100' : 'right-[-460px] opacity-0 pointer-events-none'}`}>
        
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 rounded-t-[24px] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <h3 className="text-xs font-extrabold text-slate-800 tracking-wider uppercase">Setup Data</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-rose-500 transition-colors shadow-sm"><CloseIcon /></button>
        </div>

        <div className="px-6 pt-4 pb-2 shrink-0 border-b border-slate-100">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('clients')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'clients' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BriefcaseIcon /> Clients
            </button>
            <button 
              onClick={() => setActiveTab('marketing')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'marketing' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserIcon /> Marketing
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-white">
          {activeTab === 'clients' && (
            <div className="space-y-3 animate-[slideUpFade_0.3s_ease-out]">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase">Registered Clients</p>
                <button className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                  <PlusIcon /> Add
                </button>
              </div>
              
              {setupData.clients.map((client, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800">{client.perusahaan}</span>
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${client.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`}></span> {client.status || 'Active'} • {(() => { try { return JSON.parse(client.lokasiJson).length; } catch { return 1; } })()} Locations
                    </span>
                  </div>
                  <button className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 flex items-center justify-center transition-colors">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'marketing' && (
            <div className="space-y-3 animate-[slideUpFade_0.3s_ease-out]">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase">Marketing Team</p>
                <button className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                  <PlusIcon /> Add
                </button>
              </div>
              
              {setupData.marketings.map((marketing, i) => (
                <div key={i} className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 font-black text-sm flex items-center justify-center border border-blue-100/50">
                    {marketing.nama.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800">{marketing.nama}</span>
                    <span className="text-[10px] font-bold text-slate-400 mt-0.5">{marketing.noHp || 'No Phone'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 rounded-b-[24px] text-[9px] font-black text-slate-400 tracking-widest uppercase text-center flex flex-col gap-2 shrink-0">
           <button className="w-full py-2 bg-white border border-red-200 text-red-500 text-[10px] font-bold rounded-lg shadow-sm hover:bg-red-50 hover:border-red-300 transition-colors">
              ARCHIVE OLD PROJECTS
           </button>
           <div className="flex items-center justify-center gap-1.5 mt-1">
             <svg className="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Security Shield Enabled
           </div>
        </div>
      </div>
    </>
  );
}
