import React, { useState, useRef, useCallback } from 'react';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import Swal from 'sweetalert2';
import Cropper from 'react-easy-crop';
import imageCompression from 'browser-image-compression';
import getCroppedImg from '../../utils/cropImage';

const ForceProfileModal = ({ isManual = false, onClose }) => {
  const { user, updateUser } = useAuthStore();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Crop states
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);

  const fileInputRef = useRef(null);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // If not manual, apply force logic
  if (!isManual) {
    if (!user || user.profile_picture) return null;

    // Hanya mewajibkan upload foto untuk role STAFF (Branch Staff) dan BRANCH MANAGER
    const roleName = (user.role || '').toUpperCase();
    if (roleName !== 'STAFF' && roleName !== 'BRANCH STAFF' && roleName !== 'BRANCH MANAGER') return null;
  }

  if (isMinimized && !isManual) {
    return (
      <div 
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 left-6 z-[999999] bg-[#30528A] text-white px-4 py-3 rounded-2xl shadow-xl cursor-pointer hover:bg-[#286086] hover:-translate-y-1 transition-all flex items-center gap-3 animate-[slideUpFade_0.3s_ease-out] group border border-white/10"
      >
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
          <i className="fa-solid fa-camera text-sm"></i>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold leading-none mb-1">Pengkinian Data</span>
          <span className="text-[10px] text-blue-100 leading-none">Upload Foto Profil</span>
        </div>
      </div>
    );
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      Swal.fire('Error', 'Harap pilih file gambar (JPG/PNG).', 'error');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
      setIsCropping(true); // Switch to crop mode
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !previewUrl || !croppedAreaPixels) {
      Swal.fire('Warning', 'Harap pilih dan sesuaikan foto terlebih dahulu.', 'warning');
      return;
    }

    setIsUploading(true);
    try {
      // 1. Get cropped image blob
      const croppedImageBlob = await getCroppedImg(previewUrl, croppedAreaPixels);
      
      // 2. Compress the cropped image
      const options = {
        maxSizeMB: 0.3, // 300KB
        maxWidthOrHeight: 800,
        useWebWorker: false // Dimatikan agar tidak nyangkut (freeze) di beberapa device
      };
      const compressedFile = await imageCompression(croppedImageBlob, options);
      
      // 3. Convert to base64 and upload
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(compressedFile);
        reader.onloadend = () => {
          resolve(reader.result.split(',')[1]);
        };
        reader.onerror = reject;
      });
      
      const payload = {
        base64_data: base64Data,
        mime_type: compressedFile.type
      };

      const res = await api.post(`/users/${user.id}/avatar`, payload);
      if (res.data?.success || res.data?.status === 'SUCCESS') {
        const newUrl = res.data.url;
        updateUser({ profile_picture: newUrl });
        
        Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Foto profil berhasil diunggah.',
          timer: 1500,
          showConfirmButton: false
        });
        
        if (isManual && onClose) onClose();
      } else {
        throw new Error(res.data?.message || 'Gagal mengunggah foto.');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.response?.data?.detail || err.message || 'Terjadi kesalahan sistem', 'error');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-[0_20px_50px_-12px_rgba(48,82,138,0.3)] overflow-hidden animate-[slideUpFade_0.4s_ease-out] relative">
        
        {/* Header */}
        <div className="bg-[#30528A] p-6 text-center relative">
          {!isManual ? (
            <button 
              onClick={() => setIsMinimized(true)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="Minimize"
            >
              <i className="fa-solid fa-minus"></i>
            </button>
          ) : (
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="Close"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
          
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
            <i className="fa-solid fa-camera text-3xl text-white"></i>
          </div>
          <h2 className="text-xl font-black text-white">{isManual ? 'Ubah Foto Profil' : 'Wajib Pengkinian Data'}</h2>
          <p className="text-blue-100 text-sm mt-1">{isManual ? 'Sesuaikan foto profil Anda.' : 'Harap unggah foto profil untuk melanjutkan.'}</p>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex flex-col items-center">
            
            {/* Avatar Preview or Cropper */}
            {!isCropping ? (
              <div className="relative mb-6 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className={`w-32 h-32 rounded-full border-4 border-slate-100 shadow-lg overflow-hidden flex items-center justify-center bg-slate-50 transition-all ${!previewUrl ? 'group-hover:border-[#30528A] group-hover:bg-blue-50/50' : ''}`}>
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <i className="fa-solid fa-user text-5xl text-slate-300"></i>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-10 h-10 bg-[#30528A] text-white rounded-full flex items-center justify-center shadow-md hover:bg-[#286086] transition-colors border-2 border-white">
                  <i className="fa-solid fa-camera text-sm"></i>
                </div>
              </div>
            ) : (
              <div className="w-full mb-6">
                <div className="relative w-full h-64 bg-black rounded-xl overflow-hidden mb-4 shadow-inner">
                  <Cropper
                    image={previewUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                  />
                </div>
                
                <div className="flex flex-col gap-2 px-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Perbesar Foto (Zoom)</label>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(e.target.value)}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#30528A]"
                  />
                </div>
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 text-xs font-bold text-[#30528A] hover:text-[#286086] underline w-full text-center"
                >
                  Ganti Foto Lain
                </button>
              </div>
            )}

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileSelect}
            />

            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">{user.fullName}</h3>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
            
            {/* Action */}
            <button 
              onClick={handleUpload}
              disabled={isUploading || !isCropping}
              className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                isUploading || !isCropping 
                  ? 'bg-slate-300 cursor-not-allowed' 
                  : 'bg-[#30528A] hover:bg-[#286086] hover:shadow-lg hover:-translate-y-0.5'
              }`}
            >
              {isUploading ? (
                <><i className="fa-solid fa-circle-notch fa-spin"></i> Mengunggah...</>
              ) : (
                <><i className="fa-solid fa-cloud-arrow-up"></i> Simpan & Lanjutkan</>
              )}
            </button>
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForceProfileModal;
