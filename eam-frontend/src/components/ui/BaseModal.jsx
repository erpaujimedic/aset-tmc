import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const BaseModal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer, 
  maxWidth = 'max-w-2xl',
  icon = null,
  headerActions = null,
  subheader = null
}) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-[fadeIn_0.2s_ease-out]">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className={`relative w-full ${maxWidth} bg-white rounded-t-[32px] sm:rounded-2xl shadow-[0_-20px_60px_rgba(0,0,0,0.15)] sm:shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden animate-[slideUp_0.3s_ease-out]`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-[#286086]/10 flex items-center justify-center text-[#286086]">
                {icon}
              </div>
            )}
            <div className="text-xl font-bold text-slate-800 flex items-center gap-2">{title}</div>
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors outline-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Subheader (e.g. Tabs) */}
        {subheader && (
          <div className="bg-slate-50/80 border-b border-slate-100">
            {subheader}
          </div>
        )}

        {/* Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar pb-8 sm:pb-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 sm:px-6 py-4 sm:py-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 rounded-b-none sm:rounded-b-2xl pb-safe">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default BaseModal;
