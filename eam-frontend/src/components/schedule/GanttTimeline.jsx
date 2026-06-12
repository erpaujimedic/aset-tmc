import React from 'react';

const parseDateRange = (dateStr) => {
  if (!dateStr) return { start: 1, end: 1 };
  const numbers = dateStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) return { start: 1, end: 1 };
  const days = numbers.map(Number).filter(n => n >= 1 && n <= 31);
  if (days.length === 0) return { start: 1, end: 1 };
  return { start: Math.min(...days), end: Math.max(...days) };
};

const getStatusColor = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('selesai') || s.includes('done') || s.includes('good')) return 'bg-emerald-500 border-emerald-600 shadow-emerald-500/30';
  if (s.includes('batal') || s.includes('cancel') || s.includes('critical')) return 'bg-rose-500 border-rose-600 shadow-rose-500/30';
  if (s.includes('tunda') || s.includes('pending') || s.includes('warning')) return 'bg-amber-500 border-amber-600 shadow-amber-500/30';
  return 'bg-blue-500 border-blue-600 shadow-blue-500/30'; // default Active
};

export default function GanttTimeline({ data, onRowClick, selectedProject, selectedMonth }) {
  // Always assume 31 days for the grid scale (can be enhanced later to use specific month length)
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  // Group data by branch
  const groupedData = data.reduce((acc, item) => {
    const branch = item.cleanBranch || item.cabang || item.branch || 'Unknown Branch';
    if (!acc[branch]) acc[branch] = [];
    acc[branch].push(item);
    return acc;
  }, {});

  // Map short month to full month name
  const monthMap = {
    'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
    'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
    'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
  };
  const displayMonth = monthMap[selectedMonth] || selectedMonth || 'All Months';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden mb-2 animate-[slideUpFade_0.3s_ease-out]">
      
      {/* 📅 HEADER: Days Scale */}
      <div className="flex border-b border-slate-200 bg-slate-50 shrink-0 relative z-40">
        <div className="w-[280px] shrink-0 border-r border-slate-200 px-6 py-3.5 flex items-center">
          <span className="text-sm font-black text-slate-800 uppercase tracking-widest">{displayMonth}</span>
        </div>
        <div className="flex-1 flex overflow-hidden relative">
          {daysInMonth.map(day => (
            <div key={day} className="flex-1 min-w-[28px] border-r border-slate-100 last:border-r-0 flex items-center justify-center py-3.5">
              <span className="text-[10px] font-bold text-slate-400">{day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 📊 BODY: Gantt Rows */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-slate-400 font-semibold text-sm">No data available</span>
          </div>
        ) : (
          <div className="flex flex-col relative min-w-max">
            {/* Background Grid Lines (Absolute overlay to ensure bars align) */}
            <div className="absolute top-0 bottom-0 left-[280px] right-0 flex pointer-events-none z-0">
              {daysInMonth.map(day => (
                <div key={day} className="flex-1 min-w-[28px] border-r border-slate-100/50 last:border-r-0"></div>
              ))}
            </div>

            {/* Render Grouped Rows */}
            {Object.entries(groupedData).map(([branch, projects]) => (
              <React.Fragment key={branch}>
                {/* Branch Header Row */}
                <div className="flex border-b border-slate-200 bg-slate-100/80 sticky top-0 z-30 shadow-sm">
                  <div className="w-[280px] shrink-0 border-r border-slate-200 p-2 pl-4 flex items-center">
                    <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                      {branch}
                    </span>
                  </div>
                  <div className="flex-1 relative min-w-[28px*31]"></div>
                </div>

                {/* Branch Projects */}
                {projects.map((item, idx) => {
                  const { start, end } = parseDateRange(item.date || item.tglDisplay);
                  
                  const leftOffset = ((start - 1) / 31) * 100;
                  const width = (((end - start) + 1) / 31) * 100;
                  const colorClass = getStatusColor(item.status);
                  
                  const isSelected = selectedProject?.id === item.id;

                  return (
                    <div 
                      key={item.id || idx}
                      onClick={() => onRowClick && onRowClick(item)}
                      className={`flex border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors relative z-10 ${isSelected ? 'bg-blue-50/30 shadow-[inset_4px_0_0_0_#3b82f6]' : ''}`}
                    >
                      {/* Left Column: Info */}
                      <div className="w-[280px] shrink-0 border-r border-slate-200 p-3 pl-8 flex items-center justify-between bg-white group-hover:bg-transparent">
                        <div className="flex flex-col overflow-hidden pr-3">
                          <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest truncate">{item.id}</span>
                          <span className="text-xs font-bold text-slate-700 truncate">{item.company || item.pt}</span>
                        </div>
                        <span className="text-xs font-black text-slate-400 shrink-0">{item.target || 0}</span>
                      </div>
                      
                      {/* Right Column: Timeline Bar Container */}
                      <div className="flex-1 relative min-w-[28px*31] h-[52px]">
                        <div 
                          className={`absolute top-1/2 -translate-y-1/2 h-6 rounded border ${colorClass} shadow-sm group-hover:brightness-110 transition-all z-20 overflow-hidden flex items-center px-2`}
                          style={{ 
                            left: `calc(${leftOffset}% + 4px)`, 
                            width: `calc(${width}% - 8px)` 
                          }}
                          title={`${item.date || item.tglDisplay} (${item.status})`}
                        >
                          {width > 15 && (
                            <span className="text-[9px] font-bold text-white/90 truncate drop-shadow-md">
                              {item.type || item.jenis}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
