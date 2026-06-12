import { useState } from 'react';
import api from '../../services/api';

const CloseIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const UserIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const CalendarIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const LocationIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const StarIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const MegaphoneIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>;

const TagIcon = () => <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
const ChartIcon = () => <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const GridIcon = () => <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
const EditIcon = () => <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const ChecklistIcon = () => <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
const TrashIcon = () => <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;

export default function ProjectDetailSidebar({ project, onClose, onEditSchedule, onUpdateActuals }) {
  const [activeTab, setActiveTab] = useState('verif');

  if (!project) return null;

  return (
    <div className="w-full h-full flex flex-col bg-white">
      
      {/* HEADER SECTION */}
      <div className="flex-shrink-0 pt-4 px-5 pb-5 border-b border-slate-100">
        
        {/* Top Action (Close Only) */}
        <div className="flex justify-between items-center mb-4">
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold tracking-widest uppercase">{project.type || 'MCU'}</span>
          <button onClick={onClose} className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <CloseIcon />
          </button>
        </div>

        {/* Title */}
        <div className="mb-5">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1 block">{project.id}</span>
          <h2 className="text-base font-extrabold text-slate-900 leading-tight">{project.company}</h2>
        </div>

        {/* Action Bar (Replaces Date) */}
        <div className="flex gap-2 mb-5">
            <button onClick={() => onUpdateActuals(project)} className="flex-1 py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 flex items-center justify-center gap-2 transition-all shadow-sm" title="Update Actuals">
                <EditIcon /> <span className="text-[10px] font-bold">Update</span>
            </button>
            <button className="flex-1 py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 flex items-center justify-center gap-2 transition-all shadow-sm" title="EAM Assets">
                <GridIcon /> <span className="text-[10px] font-bold">Assets</span>
            </button>
            <button onClick={() => onEditSchedule(project)} className="flex-1 py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 flex items-center justify-center gap-2 transition-all shadow-sm" title="Edit Schedule">
                <CalendarIcon /> <span className="text-[10px] font-bold">Edit</span>
            </button>
        </div>

        {/* Info List */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 mt-0.5 rounded bg-slate-50 flex items-center justify-center text-slate-400"><LocationIcon /></div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Location</div>
              <div className="text-xs font-bold text-slate-700 leading-tight truncate pr-1" title={project.location || 'Site Location'}>{project.location || 'Site Location'}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 mt-0.5 rounded bg-slate-50 flex items-center justify-center text-slate-400"><UserIcon /></div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">PIC Onsite</div>
              <div className="text-xs font-bold text-slate-700 leading-tight truncate pr-1" title={project.picOnsite || project.pic || 'Anjelia'}>{project.picOnsite || project.pic || 'Anjelia'}</div>
            </div>
          </div>
        </div>

        {/* COMPACT PROGRESS BAR */}
        <div className="bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-100 flex items-center gap-3">
          <div className="flex-1">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Progress</span>
                <span className="text-[10px] font-bold text-slate-500">{project.actual} / {project.target} Pax</span>
              </div>
              <div className="w-full bg-slate-200/60 rounded-full h-1 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (project.actual / (project.target || 1)) * 100)}%` }}></div>
              </div>
          </div>
          <div className="flex flex-col items-end border-l border-slate-200 pl-3">
             <span className="text-sm font-black text-blue-600 leading-none mb-1">{((project.actual / (project.target || 1)) * 100).toFixed(1)}%</span>
             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{project.status || 'Active'}</span>
          </div>
        </div>
      </div>

      {/* TABS Navigation (Underline Style) */}
      <div className="flex-shrink-0 flex items-center gap-5 px-5 pt-4 border-b border-slate-100">
        <button onClick={() => setActiveTab('verif')} className={`pb-2 text-xs font-bold border-b-2 transition-colors ${activeTab === 'verif' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Verification
        </button>
        <button onClick={() => setActiveTab('issues')} className={`pb-2 text-xs font-bold border-b-2 transition-colors ${activeTab === 'issues' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Issues
        </button>
        <button onClick={() => setActiveTab('logs')} className={`pb-2 text-xs font-bold border-b-2 transition-colors ${activeTab === 'logs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Logs
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className="flex-1 overflow-y-auto bg-white custom-scrollbar pb-6">
        {activeTab === 'verif' && (
          <div className="flex flex-col">
            {(() => {
                const checklistItems = [
                    "1. External Technical Meeting", "2. Internal Technical Meeting", 
                    "3. Equipment & Consumables Check", "4. Manpower Preparation Check", 
                    "5. Team Skill Check", "6. Actual Activity Achievement Check", 
                    "7. Billing Document Completeness", "8. Results Sent", 
                    "9. Post-MCU Consultation", "10. MCU Analysis Presentation"
                ];
                let savedChecklist = [];
                try {
                    let rawData = project.checklistData || project.parsedChecklist || "[]";
                    savedChecklist = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                } catch(e) { }

                return checklistItems.map((task, i) => {
                    let existing = savedChecklist.find(x => x.name === task);
                    let status = "PENDING";
                    if (existing) {
                        if (existing.status === true || existing.status === "DONE") status = "DONE";
                        else if (existing.status === "SKIPPED" || existing.status === "FAILED" || existing.status === "X") status = "SKIPPED";
                        else if (existing.status === "NA" || existing.status === "NREQ" || existing.status === "-") status = "NREQ";
                    }

                    return (
                      <div key={i} className="px-5 py-3 flex items-start gap-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <div className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${status === 'DONE' ? 'bg-emerald-500 border-emerald-500 text-white' : status === 'SKIPPED' ? 'bg-rose-500 border-rose-500 text-white' : status === 'NREQ' ? 'bg-slate-300 border-slate-300 text-white' : 'border-slate-200'}`}>
                           {status === 'DONE' && <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg>}
                           {status === 'SKIPPED' && <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg>}
                           {status === 'NREQ' && <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 12h14"></path></svg>}
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-[12px] font-bold leading-tight transition-colors ${status === 'DONE' ? 'text-emerald-700' : status === 'SKIPPED' ? 'text-rose-700 line-through opacity-70' : status === 'NREQ' ? 'text-slate-500' : 'text-slate-700'}`}>{task}</span>
                          <div className="flex items-center gap-2 mt-1">
                             <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${status === 'DONE' ? 'bg-emerald-100 text-emerald-600' : status === 'SKIPPED' ? 'bg-rose-100 text-rose-600' : status === 'NREQ' ? 'bg-slate-200 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>{status}</span>
                             {existing && existing.by && <span className="text-[9px] font-semibold text-slate-400">{existing.by.split(' ')[0]} {existing.date ? `(${existing.date.substring(5)})` : ''}</span>}
                          </div>
                        </div>
                      </div>
                    );
                });
            })()}
          </div>
        )}

        {activeTab === 'issues' && (
          <div className="p-5">
            <div className="mt-2">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Reported Issues</h3>
              {project.issues ? (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                  {project.issues}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-24 opacity-50">
                  <p className="text-[10px] font-bold text-slate-500">No issues reported</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="flex flex-col p-5">
            {(() => {
                let logsHtml = [];
                let hasLogs = false;
                
                // 1. Daily Actuals
                if (project.daily && project.daily.length > 0) {
                    let tsStr = String(project.sortTimestamp || new Date().getFullYear());
                    let yearNum = parseInt(tsStr.substring(0, 4)) || new Date().getFullYear();
                    let monthIdxNum = parseInt(tsStr.substring(4, 6)) - 1 || 0;
                    const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    let monthNameStr = shortMonths[monthIdxNum] || '';
                    
                    project.daily.forEach((val, idx) => {
                        let pax = parseInt(val);
                        if (pax > 0) {
                            hasLogs = true;
                            logsHtml.push(
                                <div key={`daily-${idx}`} className="flex items-start gap-3 mb-4">
                                    <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 shadow-[0_0_0_4px_rgba(96,165,250,0.2)] shrink-0"></div>
                                    <div className="flex-1 bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
                                        <div className="text-[10px] font-bold text-slate-400 mb-1">{idx + 1} {monthNameStr} {yearNum}</div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-700">Daily Actual</span>
                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">+{pax}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                    });
                }

                // 2. GAP Allocation
                let gapRecords = [];
                try { gapRecords = typeof project.gapData === 'string' ? JSON.parse(project.gapData) : (project.gapData || []); } catch(e) {}
                
                if (gapRecords.length > 0) {
                    hasLogs = true;
                    logsHtml.push(<div key="gap-divider" className="h-px bg-slate-100 my-4 w-full"></div>);
                    logsHtml.push(<div key="gap-title" className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">GAP Allocation</div>);
                    
                    gapRecords.forEach((rec, idx) => {
                        let kat = String(rec.kategori).toLowerCase();
                        let isReduction = kat.includes('resign') || kat.includes('phk') || kat.includes('leave') || kat.includes('cuti') || kat.includes('visit');
                        
                        logsHtml.push(
                            <div key={`gap-${idx}`} className={`flex items-center justify-between p-2.5 mb-2 rounded-lg border-l-4 bg-white shadow-sm border border-slate-100 ${isReduction ? 'border-l-rose-400' : 'border-l-emerald-400'}`}>
                                <div>
                                    <div className="text-[11px] font-bold text-slate-700 leading-tight mb-0.5">{rec.kategori}</div>
                                    <div className="text-[9px] font-semibold text-slate-400">{rec.tanggal || '-'}</div>
                                </div>
                                <span className={`text-xs font-black ${isReduction ? 'text-rose-600' : 'text-emerald-600'}`}>{isReduction ? '-' : '+'}{rec.pax} <span className="text-[9px] font-medium text-slate-400">Pax</span></span>
                            </div>
                        );
                    });
                }

                if (!hasLogs) {
                    return (
                        <div className="flex flex-col items-center justify-center h-full opacity-50 py-10 mt-10">
                            <i className="fa-regular fa-clock text-slate-300 text-3xl mb-2"></i>
                            <p className="text-[10px] font-bold text-slate-500">No logs available for this project</p>
                        </div>
                    );
                }
                
                return logsHtml;
            })()}
          </div>
        )}
      </div>

    </div>
  );
}
