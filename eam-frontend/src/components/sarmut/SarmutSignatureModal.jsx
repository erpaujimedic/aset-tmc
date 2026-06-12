import React, { useRef, useState } from 'react';

export default function SarmutSignatureModal({ isOpen, onClose, onApply, onDelete }) {
  const [base64Image, setBase64Image] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      alert("File size exceeds the 2MB limit.");
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setBase64Image(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (!base64Image) {
      alert("Please upload a signature image first.");
      return;
    }
    onApply(base64Image);
    setBase64Image(null);
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    setBase64Image(null);
    onClose();
  };

  const handleClose = () => {
    setBase64Image(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-[slideUp_0.3s_ease-out]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h6 className="font-bold text-[#286086] m-0 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Upload Signature
          </h6>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        {/* BODY */}
        <div className="p-5 bg-slate-50 text-center">
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept="image/png, image/jpeg, image/jpg" 
            onChange={handleFileChange} 
          />
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl h-36 flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden bg-white ${base64Image ? 'border-[#286086]' : 'border-slate-300 hover:border-[#286086]'}`}
          >
            {base64Image ? (
              <img src={base64Image} className="max-w-full max-h-full object-contain mix-blend-multiply p-2" alt="Signature Preview" />
            ) : (
              <>
                <svg className="w-10 h-10 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <span className="font-bold text-slate-500 text-xs">Click to Upload PNG/JPG</span>
              </>
            )}
          </div>
        </div>
        
        {/* FOOTER */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-white">
          <button onClick={handleDelete} className="text-rose-500 font-bold text-sm px-3 py-1.5 hover:bg-rose-50 rounded-lg transition-colors flex items-center">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Remove
          </button>
          <button onClick={handleApply} className="bg-[#286086] text-white font-bold text-sm px-4 py-2 rounded-lg shadow-sm hover:bg-[#1e4a68] transition-colors flex items-center">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Apply Sign
          </button>
        </div>

      </div>
    </div>
  );
}
