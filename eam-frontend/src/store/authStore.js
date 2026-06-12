import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null, // Tempat nyimpen data user (email, role, dll)
      permissions: [], // Akses module dan actions
      isAuthenticated: false, // Status apakah user lagi login atau nggak
      
      // Fungsi untuk nyimpen data pas login sukses
      login: (userData) => set({ user: userData, isAuthenticated: true }),
      
      // Simpan permission
      setPermissions: (perms) => set({ permissions: perms }),

      // Helper function untuk cek permission
      hasPermission: (moduleName, actionName) => {
        const state = get();
        if (state.user?.role?.toLowerCase() === 'master admin') return true;
        if (!state.permissions || state.permissions.length === 0) return false;
        const mod = state.permissions.find(p => p.module === moduleName);
        if (!mod) return false;
        const action = mod.actions.find(a => a.name === actionName);
        return action ? action.enabled : false;
      },

      // Fungsi untuk hapus data pas logout
      logout: () => set({ user: null, permissions: [], isAuthenticated: false }),
    }),
    {
      name: 'tmc-auth-storage', // Nama token/brankas di LocalStorage browser
    }
  )
);

export default useAuthStore;