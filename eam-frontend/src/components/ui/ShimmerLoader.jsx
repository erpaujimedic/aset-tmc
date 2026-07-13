import React from 'react';

const ShimmerLoader = ({ type = 'card', rows = 3, className = '' }) => {
  // Premium skeleton sweep styling
  const baseShimmer = "relative overflow-hidden bg-slate-100 rounded-xl before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmerSweep_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent";

  if (type === 'table') {
    return (
      <div className={`w-full ${className}`}>
        {/* Table Header Shimmer */}
        <div className="flex gap-4 mb-4 pb-4 border-b border-slate-100">
          {[...Array(5)].map((_, i) => (
            <div key={`th-${i}`} className={`${baseShimmer} h-6 w-full max-w-[150px] bg-slate-200`}></div>
          ))}
        </div>
        {/* Table Body Shimmer */}
        <div className="flex flex-col gap-4">
          {[...Array(rows)].map((_, rowIdx) => (
            <div key={`tr-${rowIdx}`} className="flex gap-4 items-center">
              <div className={`${baseShimmer} h-5 w-8`}></div> {/* Checkbox */}
              {[...Array(4)].map((_, colIdx) => (
                <div key={`td-${rowIdx}-${colIdx}`} className={`${baseShimmer} h-5 w-full`}></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`p-5 bg-white rounded-2xl border border-slate-100 shadow-sm ${className}`}>
        <div className="flex gap-4 items-center mb-4">
          <div className={`${baseShimmer} h-12 w-12 rounded-xl bg-slate-200`}></div>
          <div className="flex-1 space-y-2">
            <div className={`${baseShimmer} h-4 w-1/3 bg-slate-200`}></div>
            <div className={`${baseShimmer} h-3 w-1/4`}></div>
          </div>
        </div>
        <div className="space-y-3">
          <div className={`${baseShimmer} h-8 w-1/2`}></div>
        </div>
      </div>
    );
  }

  if (type === 'text') {
    return (
      <div className={`space-y-2 ${className}`}>
        {[...Array(rows)].map((_, i) => (
          <div key={`txt-${i}`} className={`${baseShimmer} h-4 ${i === rows - 1 ? 'w-2/3' : 'w-full'}`}></div>
        ))}
      </div>
    );
  }

  if (type === 'kpi') {
    return (
      <div className={`p-4 bg-white/80 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 ${className}`}>
        <div className={`${baseShimmer} w-12 h-12 rounded-xl bg-slate-200 shrink-0`}></div>
        <div className="flex-1 space-y-2">
          <div className={`${baseShimmer} h-3 w-1/2 bg-slate-200 rounded`}></div>
          <div className={`${baseShimmer} h-6 w-1/3 bg-slate-200 rounded`}></div>
        </div>
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className={`bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col ${className}`}>
        <div className="flex justify-between items-center mb-4">
          <div className={`${baseShimmer} h-4 w-1/3 bg-slate-200 rounded`}></div>
          <div className={`${baseShimmer} h-6 w-16 bg-slate-200 rounded-lg`}></div>
        </div>
        <div className={`flex-1 w-full ${baseShimmer} bg-slate-100 rounded-xl min-h-[260px]`}></div>
      </div>
    );
  }

  if (type === 'activities') {
    return (
      <div className={`bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col ${className}`}>
        <div className={`${baseShimmer} h-6 w-1/2 bg-slate-200 rounded mb-6`}></div>
        <div className="flex-1 space-y-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className={`${baseShimmer} w-6 h-6 rounded-full bg-slate-200 shrink-0`}></div>
              <div className="flex-1 space-y-2 pt-1">
                <div className={`${baseShimmer} h-4 w-3/4 bg-slate-200 rounded`}></div>
                <div className={`${baseShimmer} h-3 w-1/2 bg-slate-200 rounded`}></div>
                <div className={`${baseShimmer} h-2 w-1/3 bg-slate-200 rounded`}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

export default ShimmerLoader;
