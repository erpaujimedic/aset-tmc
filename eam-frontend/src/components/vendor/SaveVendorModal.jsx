import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { saveVendor } from '../../services/vendorService';
import useAuthStore from '../../store/authStore';
import useMasterStore from '../../store/masterStore';

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

export default function SaveVendorModal({ isOpen, onClose, vendor = null }) {
  const { user } = useAuthStore();
  const { branches } = useMasterStore();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    id: '', name: '', category: '', branch: '', location: '',
    pic: '', phone: '', priceMin: '', priceMax: '', notes: '',
    existingFile: '', fileData: null, fileName: '', mimeType: ''
  });

  useEffect(() => {
    if (vendor) {
      setFormData({
        id: vendor.id || '',
        name: vendor.name || '',
        category: vendor.category || '',
        branch: vendor.branch || '',
        location: vendor.location || '',
        pic: vendor.pic || '',
        phone: vendor.phone || '',
        priceMin: vendor.priceMin || '',
        priceMax: vendor.priceMax || '',
        notes: vendor.notes || '',
        existingFile: vendor.attachment || '',
        fileData: null, fileName: '', mimeType: ''
      });
    } else {
      setFormData({
        id: '', name: '', category: '', branch: '', location: '',
        pic: '', phone: '', priceMin: '', priceMax: '', notes: '',
        existingFile: '', fileData: null, fileName: '', mimeType: ''
      });
    }
  }, [vendor]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      Swal.fire('Error', 'File size must be less than 10MB', 'error');
      return;
    }

    const b64 = await fileToBase64(file);
    setFormData(prev => ({ 
      ...prev, 
      fileData: b64,
      fileName: file.name,
      mimeType: file.type
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.branch) {
      Swal.fire('Warning', 'Please fill required fields (Name, Category, Branch)', 'warning');
      return;
    }

    setLoading(true);
    try {
      await saveVendor({
        ...formData,
        actorName: user?.name
      });
      Swal.fire('Success', 'Vendor saved successfully', 'success');
      onClose();
    } catch (error) {
      Swal.fire('Error', error.response?.data?.detail || 'Failed to save vendor', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-[slideUpFade_0.3s_ease-out]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2-2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">{vendor ? 'Edit Vendor' : 'Add New Vendor'}</h2>
              <p className="text-xs text-slate-500 font-medium">{vendor ? 'Update partner vendor details' : 'Register a new external partner'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white">
          <form id="vendorForm" onSubmit={handleSubmit} className="space-y-6">
            
            {/* General Info */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> General Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Vendor Name *</label>
                  <input type="text" name="name" required value={formData.name} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors" placeholder="e.g. PT Maju Bersama" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Category *</label>
                  <input type="text" name="category" required value={formData.category} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors" placeholder="e.g. Catering, Hotel, Transport" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Location / Address</label>
                  <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors" placeholder="Full address" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Branch Accessibility *</label>
                  <select name="branch" required value={formData.branch} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors">
                    <option value="">-- Select Branch --</option>
                    <option value="ALL">ALL (Global)</option>
                    {branches.map(b => (
                      <option key={b.name || b} value={b.name || b}>{b.name || b}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-slate-100"></div>

            {/* Contact Info */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Contact & Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">PIC Name</label>
                  <input type="text" name="pic" value={formData.pic} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors" placeholder="e.g. Budi" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">WhatsApp Number</label>
                  <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors" placeholder="e.g. 08123456789" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Min Price Estimate (IDR)</label>
                  <input type="number" name="priceMin" value={formData.priceMin} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors" placeholder="0" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Max Price Estimate (IDR)</label>
                  <input type="number" name="priceMax" value={formData.priceMax} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors" placeholder="0" />
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-slate-100"></div>

            {/* Attachment & Notes */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Documents & Notes</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Attachment (MOU, Price List, PDF)</label>
                  <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#286086] hover:file:bg-blue-100 transition-colors" />
                  {formData.fileName && <p className="text-[10px] text-emerald-600 font-bold mt-1.5">File selected: {formData.fileName}</p>}
                  {!formData.fileName && formData.existingFile && (
                    <a href={formData.existingFile} target="_blank" rel="noreferrer" className="inline-block mt-1.5 text-[10px] text-blue-500 font-bold hover:underline">View Current Document</a>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Internal Notes</label>
                  <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#286086] focus:ring-1 focus:ring-[#286086] transition-colors" placeholder="Additional details..." />
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors">
            Cancel
          </button>
          <button type="submit" form="vendorForm" disabled={loading} className="px-6 py-2.5 bg-[#286086] text-white rounded-xl text-sm font-bold shadow-md shadow-blue-900/20 hover:-translate-y-0.5 hover:bg-[#1a415b] transition-all disabled:opacity-50 flex items-center gap-2">
            {loading ? (
              <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div> Saving...</>
            ) : 'Save Vendor'}
          </button>
        </div>

      </div>
    </div>
  );
}
