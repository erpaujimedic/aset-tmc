import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import useAuthStore from '../../store/authStore';
import { loginUser } from '../../services/authService';
import BaseModal from './BaseModal';

export default function UserGuideModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('pendahuluan');
  const navigate = useNavigate();
  const loginSave = useAuthStore((state) => state.login);

  const tabs = [
    { id: 'pendahuluan', title: 'Pendahuluan' },
    { id: 'roles', title: 'Hak Akses & Role' },
    { id: 'dashboard', title: 'Dashboard' },
    { id: 'aset', title: 'Manajemen Aset' },
    { id: 'pinjam', title: 'Peminjaman Aset' },
    { id: 'logistik', title: 'Logistik & Pengiriman' },
    { id: 'kalibrasi', title: 'Jadwal Kalibrasi' },
    { id: 'tiket', title: 'Ticketing & Keluhan' },
    { id: 'user', title: 'Manajemen Pengguna' }
  ];

  const handleStartTour = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Mulai Tur EAM',
      html:
        '<input id="swal-input1" class="swal2-input" placeholder="Username / Email" style="width: 80%">' +
        '<input id="swal-input2" class="swal2-input" type="password" placeholder="Password" style="width: 80%">',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Masuk & Mulai Tur',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#286086',
      preConfirm: () => {
        return [
          document.getElementById('swal-input1').value,
          document.getElementById('swal-input2').value
        ]
      }
    });

    if (formValues) {
      const [tourEmail, tourPassword] = formValues;
      if (!tourEmail || !tourPassword) {
        Swal.fire('Error', 'Username dan Password harus diisi!', 'error');
        return;
      }
      
      Swal.fire({
        title: 'Authenticating...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      try {
        const userData = await loginUser(tourEmail, tourPassword);
        loginSave(userData); 
        localStorage.setItem('startTour', 'true');
        Swal.close();
        onClose();
        navigate('/dashboard');
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Memulai Tur',
          text: err,
          confirmButtonColor: '#EC363A'
        });
      }
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'pendahuluan':
        return (
          <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-black text-[#286086] border-b pb-2">Pendahuluan</h2>
            <p className="text-slate-600 leading-relaxed text-sm">
              Selamat datang di sistem <strong>Enterprise Asset Management (EAM)</strong>. 
              Sistem ini dirancang untuk mempermudah pelacakan, pemeliharaan, peminjaman, serta pengaturan distribusi aset di berbagai cabang secara real-time.
            </p>
            <h3 className="font-bold text-slate-800">Tujuan Sistem:</h3>
            <ul className="list-disc list-inside text-slate-600 text-sm space-y-1">
              <li>Mendata seluruh aset perusahaan secara terpusat.</li>
              <li>Melacak status operasional aset (Valid, Expired, Maintenance, Borrowed).</li>
              <li>Mendukung proses persetujuan (approval) berjenjang.</li>
              <li>Meminimalisir kehilangan aset melalui tracking pengiriman barang.</li>
            </ul>
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mt-4">
              <h4 className="text-sm font-bold text-blue-800 mb-1">⚡ Global Keyboard Shortcuts</h4>
              <p className="text-xs text-blue-700">
                Gunakan kombinasi tombol <strong>Alt + Shift + [Huruf]</strong> dari layar mana saja untuk pindah halaman super cepat. Contoh: <code>Alt+Shift+D</code> (Dashboard), <code>Alt+Shift+A</code> (Aset), <code>Alt+Shift+C</code> (Kalibrasi), dll.
              </p>
            </div>
          </div>
        );
      case 'roles':
        return (
          <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-black text-[#286086] border-b pb-2">Hak Akses & Role</h2>
            <p className="text-slate-600 text-sm mb-4">Sistem EAM memiliki pembagian akses berdasarkan tingkatan manajemen.</p>
            
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <h4 className="font-bold text-slate-800">1. Master Admin & Admin System</h4>
                <p className="text-sm text-slate-600">Akses penuh ke seluruh cabang dan modul. Memiliki wewenang untuk mengatur role dan pengguna.</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <h4 className="font-bold text-slate-800">2. Branch Manager</h4>
                <p className="text-sm text-slate-600">Mengelola aset di cabang masing-masing. Memiliki hak akses untuk melakukan *Approval* peminjaman/mutasi aset di cabangnya.</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <h4 className="font-bold text-slate-800">3. Admin</h4>
                <p className="text-sm text-slate-600">Membantu pengelolaan administrasi dan keluhan. Bisa mengatur status tiket keluhan namun perlu persetujuan untuk mutasi besar.</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <h4 className="font-bold text-slate-800">4. Branch Staff</h4>
                <p className="text-sm text-slate-600">Hanya dapat melihat aset di cabangnya dan mengajukan peminjaman (*Request*). Tidak memiliki hak akses *Approval*.</p>
              </div>
            </div>
          </div>
        );
      case 'dashboard':
        return (
          <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-black text-[#286086] border-b pb-2">Dashboard & Pemantauan</h2>
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-3">
              <p className="text-sm text-blue-800 font-medium">Dashboard berfungsi sebagai *Command Center* untuk memantau performa dan lokasi seluruh aset.</p>
            </div>
            <ul className="list-disc list-inside text-slate-600 text-sm space-y-2">
              <li><strong>Overview Tab:</strong> Menampilkan ringkasan jumlah aset, aset yang sedang dikirim (In Transit), dan aset yang sedang diservis (Maintenance). Terdapat grafik distribusi wilayah dan cabang.</li>
              <li><strong>Map Tab:</strong> Menampilkan peta geografis lokasi cabang dan penyebaran aset secara visual dengan marker warna-warni.</li>
              <li><strong>Live Users:</strong> Melacak pengguna mana saja yang saat ini sedang aktif mengakses sistem EAM.</li>
            </ul>
          </div>
        );
      case 'aset':
        return (
          <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-black text-[#286086] border-b pb-2">Manajemen Aset</h2>
            <p className="text-sm text-slate-600 mb-2">Halaman utama untuk mengelola database fisik aset perusahaan.</p>
            <ul className="list-decimal list-inside text-slate-600 text-sm space-y-2">
              <li><strong>Menambah Aset:</strong> Klik tombol `+ New Asset` untuk menginput data secara manual.</li>
              <li><strong>QR & Barcode Scanner:</strong> Arahkan kamera HP / klik tombol Scanner di dekat kolom pencarian untuk memindai fisik barang secara langsung dan mencari data aset tanpa mengetik.</li>
              <li><strong>Visual Timeline:</strong> Cek detail sebuah aset dan buka tab "Riwayat" untuk melihat perjalanan lengkap mutasi barang dalam bentuk grafik garis waktu (Timeline) yang mudah dibaca.</li>
              <li><strong>Import/Export Bulk:</strong> Anda bisa mengunggah file Excel/CSV jika ingin menambah data sekaligus, atau mengunduh daftar aset saat ini.</li>
              <li><strong>Print Barcode:</strong> Centang beberapa aset, lalu klik "Bulk Print Barcode" untuk mencetak stiker QR/Barcode yang dapat ditempelkan ke fisik barang.</li>
            </ul>
          </div>
        );
      case 'pinjam':
        return (
          <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-black text-[#286086] border-b pb-2">Peminjaman Aset</h2>
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 mb-3 text-sm text-amber-800 font-medium">
              Alur peminjaman antar cabang wajib melalui proses Request ➔ Approval.
            </div>
            <ul className="list-disc list-inside text-slate-600 text-sm space-y-2">
              <li><strong>Browse Assets:</strong> Tab ini digunakan untuk mencari aset yang *Available*. Klik "Pinjam" untuk membuat pengajuan. Gunakan <strong>QR Scanner</strong> untuk mempercepat pencarian aset yang ingin dipinjam.</li>
              <li><strong>My Requests:</strong> Berisi status pengajuan yang Anda buat. Apakah masih *Pending*, sudah *Approved*, atau sedang dipinjam.</li>
              <li><strong>Approvals:</strong> Hanya terlihat oleh Admin/Manager. Digunakan untuk menyetujui (*Approve*) atau menolak (*Reject*) permintaan pinjaman dari cabang lain.</li>
              <li><strong>Return (Pengembalian):</strong> Saat selesai, peminjam klik "Kembalikan", gunakan scanner untuk verifikasi fisik, dan wajib memberikan bukti foto kondisi barang.</li>
            </ul>
          </div>
        );
      case 'logistik':
        return (
          <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-black text-[#286086] border-b pb-2">Logistik & Pengiriman</h2>
            <p className="text-sm text-slate-600 mb-2">Mengontrol proses fisik perpindahan barang agar bisa di-tracking.</p>
            <ul className="list-decimal list-inside text-slate-600 text-sm space-y-2">
              <li><strong>Mutasi vs Peminjaman:</strong> Terdapat dua jenis pengiriman, yaitu Mutasi Permanen (pindah hak milik cabang) dan Peminjaman (sementara).</li>
              <li><strong>In Transit:</strong> Saat barang dikirim, status akan berubah menjadi `In Transit`. Pengirim wajib menyertakan foto resi atau barang ke Google Drive melalui form sistem.</li>
              <li><strong>Penerimaan Barang & Scanner:</strong> Penerima mengecek fisik barang, gunakan fitur <strong>QR Scanner</strong> pada tab <em>In Transit</em> untuk melakukan validasi penerimaan super cepat, lalu klik "Terima".</li>
              <li>Semua perpindahan barang tercatat secara detail dalam "Movement History" tiap aset.</li>
            </ul>
          </div>
        );
      case 'kalibrasi':
        return (
          <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-black text-[#286086] border-b pb-2">Penjadwalan Kalibrasi</h2>
            <p className="text-sm text-slate-600 mb-2">Untuk memastikan aset alat ukur (atau perangkat medis/teknik) tetap akurat dan bersertifikasi.</p>
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg">
                <h4 className="font-bold text-slate-800 mb-1">Toggle Tampilan (List / Calendar)</h4>
                <p className="text-sm text-slate-600">Gunakan tombol toggle di bagian atas untuk beralih dari tampilan tabel biasa menjadi tampilan <strong>Kalender Visual (FullCalendar)</strong>. Ini mempermudah Anda melihat jadwal kalibrasi secara bulanan/mingguan.</p>
              </div>
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg">
                <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded mb-2">Valid</span>
                <p className="text-sm text-slate-600">Aset masih dalam masa kalibrasi aman. Ditandai warna biru/hijau pada kalender.</p>
              </div>
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg">
                <span className="inline-block px-2 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded mb-2">Expired</span>
                <p className="text-sm text-slate-600">Masa kalibrasi sudah lewat. Akan menyala merah terang di Kalender Visual dan memunculkan peringatan agar segera dilakukan kalibrasi ulang.</p>
              </div>
            </div>
          </div>
        );
      case 'tiket':
        return (
          <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-black text-[#286086] border-b pb-2">Ticketing & Keluhan</h2>
            <p className="text-sm text-slate-600 mb-2">Modul untuk melaporkan kerusakan atau masalah operasional mesin.</p>
            <ul className="list-decimal list-inside text-slate-600 text-sm space-y-2">
              <li>Buka tiket dengan memilih tipe: <strong>Repair</strong> (Servis), <strong>Replacement</strong> (Penggantian sparepart), atau <strong>Calibration</strong>.</li>
              <li>Status tiket berawal dari `Open`, kemudian diproses menjadi `In Progress`, dan terakhir `Resolved`.</li>
              <li>Setelah tiket dibuka, status aset terkait otomatis berubah menjadi `Maintenance` sehingga aset tersebut tidak bisa dipinjam.</li>
              <li>Melampirkan rincian sparepart yang rusak dan teknisi yang menangani.</li>
            </ul>
          </div>
        );
      case 'user':
        return (
          <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-black text-[#286086] border-b pb-2">Manajemen Pengguna</h2>
            <p className="text-sm text-slate-600 mb-2">Area privasi untuk menambah dan memodifikasi *Role-Based Access Control* (RBAC).</p>
            <ul className="list-disc list-inside text-slate-600 text-sm space-y-2">
              <li><strong>Menu Users:</strong> Untuk mereset password, mengganti status Active/Inactive akun karyawan, dan merubah wilayah cabang mereka.</li>
              <li><strong>Menu Roles:</strong> Menentukan hak akses spesifik di setiap modul (Create, Edit, Delete, Approve) untuk sebuah jabatan (misalnya: Branch Staff tidak boleh Edit).</li>
              <li>Sistem ini menggunakan sinkronisasi menu secara *real-time* sehingga perubahan Role akan langsung berdampak pada halaman yang dapat diakses pengguna.</li>
            </ul>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="User Guide EAM"
      maxWidth="max-w-5xl"
    >
      <div className="flex h-[65vh] max-h-[600px] bg-slate-50 border-t border-slate-200">
        {/* Sidebar */}
        <div className="w-1/3 max-w-[250px] border-r border-slate-200 bg-white flex flex-col p-2 space-y-1">
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                  activeTab === tab.id 
                  ? 'bg-[#286086] text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.title}
              </button>
            ))}
          </div>
          <div className="pt-2 mt-auto border-t border-slate-100 shrink-0">
            <button 
              onClick={handleStartTour}
              className="w-full text-[#286086] hover:text-white flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-wider transition-colors bg-blue-50 hover:bg-[#286086] px-4 py-3 rounded-xl border border-blue-200 shadow-sm group"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Mulai Interactive Tour
            </button>
          </div>
        </div>
        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-white">
          {renderContent()}
        </div>
      </div>
    </BaseModal>
  );
}
