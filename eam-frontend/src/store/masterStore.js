import { create } from 'zustand';
import api from '../services/api';

const useMasterStore = create((set) => ({
  branches: [], // Tempat nyimpen data cabang
  
  // Fungsi yang dipanggil sama Login.jsx
  fetchBranches: async () => {
  try {
    // Tambahin pengecekan: Jangan fetch kalau server belum siap
    const response = await api.get('/master/setup-data');
    const branchData = response.data?.branches || response.data?.data || [];
    set({ branches: branchData });
  } catch (error) {
    // Cuma log kalau errornya beneran fatal (selain connection refused)
    if (!error.message.includes("Network Error")) {
      console.warn("⚠️ Data cabang belum bisa dimuat.");
    }
  }
},
}));

export default useMasterStore;