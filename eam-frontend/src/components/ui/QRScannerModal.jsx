import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import BaseModal from './BaseModal';

export default function QRScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    let scanner = null;
    if (isOpen) {
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true
        },
        false
      );

      const handleSuccess = (decodedText, decodedResult) => {
        scanner.clear();
        onScanSuccess(decodedText);
        onClose();
      };

      const handleError = (errorMessage) => {
        // Log quietly or set error if we want to show it. HTML5QrcodeScanner constantly fires error when no QR is found.
        // setError(errorMessage);
      };

      scanner.render(handleSuccess, handleError);
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [isOpen, onScanSuccess, onClose]);

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Scan QR Code / Barcode" maxWidth="max-w-md">
      <div className="p-2 flex flex-col items-center">
        <p className="text-sm text-slate-500 mb-4 text-center">
          Arahkan kamera ke stiker QR Code atau Barcode yang menempel pada aset.
        </p>
        <div id="qr-reader" className="w-full max-w-[350px] mx-auto overflow-hidden rounded-xl shadow-inner border-2 border-slate-200 bg-slate-50"></div>
        {error && <p className="text-xs text-rose-500 mt-3 text-center">{error}</p>}
        
        <div className="w-full mt-6 flex justify-center">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors shadow-sm"
          >
            Batal Scan
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
