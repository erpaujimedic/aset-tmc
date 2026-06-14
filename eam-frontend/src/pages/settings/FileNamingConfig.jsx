import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import api from '../../services/api';

export default function FileNamingConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    naming_format_asset_photo: '',
    naming_format_calibration: '',
    naming_format_borrow: '',
    naming_format_return: '',
    naming_format_dispatch: '',
    naming_format_receive: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setForm(res.data.data);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/settings', { settings: form });
      Swal.fire({ icon: 'success', title: 'Saved!', text: 'File naming configurations saved successfully!', timer: 2000, showConfirmButton: false });
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>;
  }

  const variablesList = [
    { code: '{asset_code}', desc: 'Asset ID/Code (e.g. AST-2026-123)' },
    { code: '{date}', desc: 'Current Date (YYYY-MM-DD)' },
    { code: '{time}', desc: 'Current Time (HHMMSS)' },
    { code: '{original_filename}', desc: 'Original uploaded file name' }
  ];

  const renderField = (name, label, placeholder) => (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:border-[#286086]/30 transition-all flex flex-col h-full group">
      <label className="text-sm font-semibold text-slate-700 mb-2">{label}</label>
      <input
        type="text"
        name={name}
        value={form[name] || ''}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#286086]/20 focus:border-[#286086] text-slate-800 font-medium transition-all"
      />
      <div className="mt-4 p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl flex-1 flex flex-col justify-center">
        <p className="text-[11px] font-bold text-blue-500 mb-1">Preview:</p>
        <p className="text-sm text-[#286086] font-semibold break-all leading-relaxed">
          {form[name]
            ? form[name]
                .replace('{asset_code}', 'AST-2026-ELK-123')
                .replace('{date}', '2026-06-13')
                .replace('{time}', '143000')
                .replace('{original_filename}', 'photo.jpg')
            : placeholder}
        </p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 w-full max-w-[1400px] mx-auto animate-[fadeIn_0.3s_ease-out]">
      <div className="flex flex-col xl:flex-row gap-5 items-start">
        
        {/* LEFT SIDE: CONFIGURATION FIELDS */}
        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderField('naming_format_asset_photo', 'Asset Photo Upload', 'AssetPhoto_{asset_code}_{original_filename}')}
          {renderField('naming_format_calibration', 'Calibration Certificate', 'Calibration_{asset_code}_{original_filename}')}
          {renderField('naming_format_borrow', 'Borrow Request Proof', 'Borrow_{asset_code}_{original_filename}')}
          {renderField('naming_format_return', 'Return Asset Proof', 'Return_{asset_code}_{original_filename}')}
          {renderField('naming_format_dispatch', 'Dispatch Delivery Proof', 'Dispatch_{asset_code}_{original_filename}')}
          {renderField('naming_format_receive', 'Receive Delivery Proof', 'Receive_{asset_code}_{original_filename}')}
        </div>

        {/* RIGHT SIDE: SAVE BUTTON & VARIABLES */}
        <div className="w-full xl:w-[320px] flex flex-col gap-4 sticky top-6">
          
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full py-3.5 bg-[#286086] text-white rounded-xl shadow-[0_8px_20px_rgba(40,96,134,0.2)] hover:bg-[#1a4666] hover:shadow-[0_8px_25px_rgba(40,96,134,0.3)] transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Save Configurations
              </>
            )}
          </button>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-800">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Available Variables
            </h3>
            <div className="space-y-3">
              {variablesList.map((v, i) => (
                <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <code className="text-[13px] font-bold text-[#286086] bg-blue-50/50 px-2.5 py-1 rounded-md border border-blue-100">{v.code}</code>
                  <p className="text-xs font-medium text-slate-500 mt-2">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
}
