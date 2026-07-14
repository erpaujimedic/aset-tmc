import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

const CustomSelect = ({ name, value, onChange, options, placeholder, className = "", creatable = false, defaultHiddenPredicate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target) && !event.target.closest('.custom-select-dropdown')) {
        setIsOpen(false);
      }
    };
    
    const handleScroll = (e) => {
       if (isOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
           setIsOpen(false);
       }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    
    return () => {
       document.removeEventListener("mousedown", handleClickOutside);
       window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      // Small timeout to ensure it's rendered in portal before focusing
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      // Reset search when closed
      setSearchTerm("");
      setActiveIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchTerm]);

  const handleKeyDown = (e) => {
    if (!isOpen) return;
    
    const maxIndex = creatable && searchTerm && !options.find(o => o.label.toLowerCase() === searchTerm.toLowerCase()) 
      ? filteredOptions.length 
      : filteredOptions.length - 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < maxIndex ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length === 0 && !creatable) return;
      
      if (activeIndex < filteredOptions.length) {
        const selected = filteredOptions[activeIndex];
        if (selected) {
          onChange({ target: { name, value: selected.value } });
          setIsOpen(false);
          setSearchTerm("");
          setTimeout(() => ref.current?.querySelector('[tabindex="0"]')?.focus(), 10);
        }
      } else if (creatable) {
        onChange({ target: { name, value: searchTerm } });
        setIsOpen(false);
        setSearchTerm("");
        setTimeout(() => ref.current?.querySelector('[tabindex="0"]')?.focus(), 10);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setTimeout(() => ref.current?.querySelector('[tabindex="0"]')?.focus(), 10);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (filteredOptions.length > 0 && activeIndex < filteredOptions.length) {
         const selected = filteredOptions[activeIndex];
         onChange({ target: { name, value: selected.value } });
      } else if (creatable && activeIndex === filteredOptions.length) {
         onChange({ target: { name, value: searchTerm } });
      }
      setIsOpen(false);
      setSearchTerm("");
      
      setTimeout(() => {
          if (ref.current) {
              const trigger = ref.current.querySelector('[tabindex="0"]');
              if (trigger) {
                  const focusable = Array.from(document.querySelectorAll('a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'))
                    .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null && !el.closest('.custom-select-dropdown'));
                  const index = focusable.indexOf(trigger);
                  if (index > -1 && index + 1 < focusable.length) {
                      focusable[index + 1].focus();
                  } else {
                      trigger.focus();
                  }
              }
          }
      }, 10);
    }
  };

  const handleOpen = () => {
    if (!isOpen && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const scaleStr = getComputedStyle(document.documentElement).getPropertyValue('--app-scale');
      const scale = parseFloat(scaleStr) || 1;
      
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 300; // Approximate max height of dropdown (search + max-h-60)
      
      let style = {
        position: 'fixed',
        left: rect.left / scale,
        width: rect.width / scale,
        opacity: 1
      };
      
      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
          // Open upwards
          style.bottom = (window.innerHeight - rect.top + 4) / scale;
      } else if (spaceBelow < dropdownHeight && rect.top > spaceBelow) {
          // Open upwards (if both top and bottom are small, pick the larger one)
          style.bottom = (window.innerHeight - rect.top + 4) / scale;
      } else {
          // Open downwards
          style.top = (rect.bottom + 4) / scale;
      }
      
      setDropdownStyle(style);
    }
    setIsOpen(!isOpen);
  };

  const selectedLabel = options.find(o => o.value === value)?.label || value || placeholder;

  const filteredOptions = useMemo(() => {
    if (!searchTerm) {
        if (defaultHiddenPredicate) {
            return options.filter(opt => !defaultHiddenPredicate(opt));
        }
        return options;
    }
    return options.filter(opt => 
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm, defaultHiddenPredicate]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div 
        className="w-full h-full px-3 text-sm font-bold bg-transparent flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all rounded"
        onClick={handleOpen}
        tabIndex={0}
        onKeyDown={(e) => {
           if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
               e.preventDefault();
               handleOpen();
           }
        }}
      >
        <span className={`truncate ${value ? "text-slate-700" : "text-slate-400"}`}>{selectedLabel}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''} shrink-0 ml-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
      
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          ref={dropdownRef}
          className="custom-select-dropdown z-[999999] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col"
          style={dropdownStyle}
        >
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                   <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <input 
                  ref={searchInputRef}
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Cari..."
                  className="w-full h-8 pl-8 pr-3 text-[13px] font-bold text-slate-700 bg-white border border-slate-200 rounded outline-none focus:border-[#30528A] focus:ring-1 focus:ring-[#30528A] transition-all"
                />
             </div>
          </div>
          
          <ul className="max-h-60 overflow-auto custom-scrollbar py-1 bg-white flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => (
                <li 
                  key={idx}
                  className={`px-3 py-2 text-[13px] font-bold cursor-pointer transition-colors flex items-center justify-between
                    ${activeIndex === idx ? 'bg-blue-100 text-[#30528A]' : (value === opt.value ? 'bg-blue-50 text-[#30528A]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800')}`}
                  onClick={() => {
                    onChange({ target: { name, value: opt.value } });
                    setIsOpen(false);
                    setSearchTerm("");
                    setTimeout(() => ref.current?.querySelector('[tabindex="0"]')?.focus(), 10);
                  }}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                     <span className={`truncate ${opt.isClosed ? 'text-slate-400' : ''}`}>{opt.label}</span>
                     {opt.badge && <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-400 border border-slate-200 leading-none shrink-0">{opt.badge}</span>}
                  </div>
                  {value === opt.value && <i className="fa-solid fa-check text-[11px] ml-auto shrink-0"></i>}
                </li>
              ))
            ) : (
              !creatable && <li className="px-3 py-4 text-center text-[12px] font-bold text-slate-400">Tidak ada opsi ditemukan</li>
            )}
            
            {/* CREATABLE OPTION */}
            {creatable && searchTerm && !options.find(o => o.label.toLowerCase() === searchTerm.toLowerCase()) && (
              <li 
                className={`px-3 py-2 text-[13px] font-bold cursor-pointer transition-colors border-t border-slate-100 flex items-center gap-2
                  ${activeIndex === filteredOptions.length ? 'bg-blue-100 text-[#30528A]' : 'text-blue-600 hover:bg-blue-50'}`}
                onClick={() => {
                  onChange({ target: { name, value: searchTerm } });
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                <i className="fa-solid fa-plus"></i>
                Gunakan "{searchTerm}" (Freetext)
              </li>
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomSelect;
