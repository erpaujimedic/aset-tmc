import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import api from '../services/api';

export default function MasterComponentSettings() {
  const [masterComponents, setMasterComponents] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  const [activeTab, setActiveTab] = useState('master'); // 'master' or 'template'

  const fetchMasterData = async () => {
    try {
      const res = await api.get('/master-components');
      setMasterComponents(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/master-components/templates');
      setTemplates(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMasterData();
    fetchTemplates();
  }, []);

  const handleAddMaster = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Tambah Master Komponen',
      html: `
        <input id="swal-mc-name" class="swal2-input" placeholder="Nama Komponen (misal: Aki Yuasa)">
        <input id="swal-mc-desc" class="swal2-input" placeholder="Deskripsi (Opsional)">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: '#286086',
      preConfirm: () => {
        const name = document.getElementById('swal-mc-name').value;
        if (!name) Swal.showValidationMessage('Nama wajib diisi');
        return { name, description: document.getElementById('swal-mc-desc').value };
      }
    });

    if (formValues) {
      try {
        await api.post('/master-components', formValues);
        Swal.fire('Berhasil', 'Master Komponen ditambahkan', 'success');
        fetchMasterData();
      } catch (err) {
        Swal.fire('Error', 'Gagal menyimpan. Pastikan nama unik.', 'error');
      }
    }
  };

  const handleEditMaster = async (mc) => {
    const { value: formValues } = await Swal.fire({
      title: 'Edit Master Komponen',
      html: `
        <input id="swal-mc-name" class="swal2-input" placeholder="Nama Komponen" value="${mc.name}">
        <input id="swal-mc-desc" class="swal2-input" placeholder="Deskripsi (Opsional)" value="${mc.description || ''}">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: '#286086',
      preConfirm: () => {
        const name = document.getElementById('swal-mc-name').value;
        if (!name) Swal.showValidationMessage('Nama wajib diisi');
        return { name, description: document.getElementById('swal-mc-desc').value };
      }
    });

    if (formValues) {
      try {
        await api.put(`/master-components/${mc.id}`, formValues);
        Swal.fire('Berhasil', 'Master Komponen diperbarui', 'success');
        fetchMasterData();
      } catch (err) {
        Swal.fire('Error', 'Gagal memperbarui.', 'error');
      }
    }
  };

  const handleBulkAddMaster = async () => {
    const { value: textList } = await Swal.fire({
      title: 'Bulk Import Master Komponen',
      html: `
        <div class="text-left text-sm text-slate-500 mb-2">Pisahkan nama komponen dengan koma atau baris baru. (Contoh: Monitor, Keyboard, Mouse)</div>
        <textarea id="swal-bulk-mc" class="swal2-textarea" placeholder="Paste data di sini..." style="font-size: 14px; min-height: 150px;"></textarea>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: '#286086',
      confirmButtonText: 'Import Sekarang',
      preConfirm: () => {
        const val = document.getElementById('swal-bulk-mc').value;
        if (!val.trim()) Swal.showValidationMessage('Data tidak boleh kosong');
        return val;
      }
    });

    if (textList) {
      Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      try {
        const names = textList.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);
        let successCount = 0;
        for (let name of names) {
          try {
            await api.post('/master-components', { name, description: '' });
            successCount++;
          } catch(e) { /* ignore duplicate */ }
        }
        Swal.fire('Berhasil', `${successCount} komponen berhasil diimpor`, 'success');
        fetchMasterData();
      } catch (err) {
        Swal.fire('Error', 'Terjadi kesalahan saat import', 'error');
      }
    }
  };

  const handleDeleteMaster = async (id) => {
    if (await Swal.fire({title: 'Hapus Master?', text: 'Ini bisa memengaruhi template.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33'}).then(r => r.isConfirmed)) {
      try {
        await api.delete(`/master-components/${id}`);
        fetchMasterData();
        fetchTemplates();
      } catch (err) {
        Swal.fire('Error', 'Gagal menghapus', 'error');
      }
    }
  };

  const handleAddTemplate = async () => {
    let options = masterComponents.map(mc => `<option value="${mc.id}">${mc.name}</option>`).join('');
    
    const { value: formValues } = await Swal.fire({
      title: 'Buat Mapping Template',
      html: `
        <input id="swal-cat-name" class="swal2-input" placeholder="Kategori Aset (misal: Mobil)">
        <select id="swal-mc-id" class="swal2-select" style="display:flex; width: 75%; margin: 1em auto;">
          ${options}
        </select>
        <input id="swal-qty" type="number" class="swal2-input" placeholder="Jumlah Default (misal: 4)" value="1">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: '#286086',
      preConfirm: () => {
        const cat = document.getElementById('swal-cat-name').value;
        const mc = document.getElementById('swal-mc-id').value;
        const qty = document.getElementById('swal-qty').value;
        if (!cat || !mc) Swal.showValidationMessage('Kategori dan Komponen wajib diisi');
        return { category_name: cat, master_component_id: mc, default_quantity: parseInt(qty) || 1 };
      }
    });

    if (formValues) {
      try {
        await api.post('/master-components/templates', formValues);
        Swal.fire('Berhasil', 'Template berhasil di-mapping', 'success');
        fetchTemplates();
      } catch (err) {
        Swal.fire('Error', 'Gagal menyimpan template', 'error');
      }
    }
  };

  const handleEditTemplate = async (t) => {
    let options = masterComponents.map(mc => `<option value="${mc.id}" ${mc.id === t.master_components?.id ? 'selected' : ''}>${mc.name}</option>`).join('');
    
    const { value: formValues } = await Swal.fire({
      title: 'Edit Mapping Template',
      html: `
        <input id="swal-cat-name" class="swal2-input" placeholder="Kategori Aset (misal: Mobil)" value="${t.category_name}">
        <select id="swal-mc-id" class="swal2-select" style="display:flex; width: 75%; margin: 1em auto;">
          ${options}
        </select>
        <input id="swal-qty" type="number" class="swal2-input" placeholder="Jumlah Default" value="${t.default_quantity}">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: '#286086',
      preConfirm: () => {
        const cat = document.getElementById('swal-cat-name').value;
        const mc = document.getElementById('swal-mc-id').value;
        const qty = document.getElementById('swal-qty').value;
        if (!cat || !mc) Swal.showValidationMessage('Kategori dan Komponen wajib diisi');
        return { category_name: cat, master_component_id: mc, default_quantity: parseInt(qty) || 1 };
      }
    });

    if (formValues) {
      try {
        await api.put(`/master-components/templates/${t.id}`, formValues);
        Swal.fire('Berhasil', 'Template diperbarui', 'success');
        fetchTemplates();
      } catch (err) {
        Swal.fire('Error', 'Gagal memperbarui template', 'error');
      }
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (await Swal.fire({title: 'Hapus Mapping Template?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33'}).then(r => r.isConfirmed)) {
      try {
        await api.delete(`/master-components/templates/${id}`);
        fetchTemplates();
      } catch (err) {
        Swal.fire('Error', 'Gagal menghapus', 'error');
      }
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* UNDER DEVELOPMENT OVERLAY */}
      <div className="absolute inset-0 z-50 bg-slate-100/60 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-md text-center animate-[slideDown_0.3s_ease-out]">
          <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-amber-100">
            <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Under Development</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Mohon maaf, fitur <b>Master Komponen & Auto-Generate</b> saat ini sedang dalam tahap pengembangan (Di-Hold sementara).
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg text-xs font-bold text-slate-400 border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Coming Soon
          </div>
        </div>
      </div>

      <div className="flex space-x-2 mb-4 bg-slate-100 p-1 rounded-xl w-max opacity-30 pointer-events-none">
        <button 
          onClick={() => setActiveTab('master')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'master' ? 'bg-white text-[#286086] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Daftar Master Komponen
        </button>
        <button 
          onClick={() => setActiveTab('template')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'template' ? 'bg-white text-[#286086] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Mapping Template Kategori
        </button>
      </div>

      {activeTab === 'master' && (
        <div className="flex-1 bg-white rounded-[20px] shadow-sm border border-slate-200 overflow-hidden flex flex-col opacity-30 pointer-events-none">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="font-bold text-slate-800">Kamus Universal</h2>
              <p className="text-xs text-slate-500 mt-0.5">Daftarkan seluruh nama standar komponen di sini agar seragam saat diinput.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleBulkAddMaster} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm">
                Bulk Import
              </button>
              <button onClick={handleAddMaster} className="bg-[#30528A] hover:bg-[#286086] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm">
                <span className="text-lg leading-none">+</span> Tambah Data
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="border-b border-slate-200 text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">
                  <th className="p-4 pl-6">Nama Komponen</th>
                  <th className="p-4">Deskripsi</th>
                  <th className="p-4 pr-6 w-24 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {masterComponents.length === 0 ? (
                  <tr><td colSpan="3" className="p-12 text-center text-slate-400 font-medium">Belum ada data master komponen. Silakan tambahkan baru.</td></tr>
                ) : masterComponents.map(mc => (
                  <tr key={mc.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4 pl-6 font-bold text-slate-700">{mc.name}</td>
                    <td className="p-4 text-slate-500">{mc.description || '-'}</td>
                    <td className="p-4 pr-6 text-center">
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditMaster(mc)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors font-bold text-xs">Edit</button>
                        <button onClick={() => handleDeleteMaster(mc.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors font-bold text-xs">Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'template' && (
        <div className="flex-1 bg-white rounded-[20px] shadow-sm border border-slate-200 overflow-hidden flex flex-col opacity-30 pointer-events-none">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="font-bold text-slate-800">Aturan Template Kategori</h2>
              <p className="text-xs text-slate-500 mt-0.5">Tentukan setiap kategori aset wajib memiliki komponen bawaan apa saja secara otomatis.</p>
            </div>
            <button onClick={handleAddTemplate} className="bg-[#30528A] hover:bg-[#286086] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm">
              <span className="text-lg leading-none">+</span> Buat Aturan
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="border-b border-slate-200 text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">
                  <th className="p-4 pl-6">Kategori Aset</th>
                  <th className="p-4">Komponen Bawaan</th>
                  <th className="p-4 text-center">Qty</th>
                  <th className="p-4 pr-6 w-24 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {templates.length === 0 ? (
                  <tr><td colSpan="4" className="p-12 text-center text-slate-400 font-medium">Belum ada aturan mapping template.</td></tr>
                ) : templates.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4 pl-6 font-bold text-slate-800">
                      <span className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">{t.category_name}</span>
                    </td>
                    <td className="p-4 font-semibold text-[#286086]">{t.master_components?.name}</td>
                    <td className="p-4 text-center font-bold text-slate-600">{t.default_quantity}x</td>
                    <td className="p-4 pr-6 text-center">
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditTemplate(t)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors font-bold text-xs">Edit</button>
                        <button onClick={() => handleDeleteTemplate(t.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors font-bold text-xs">Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
