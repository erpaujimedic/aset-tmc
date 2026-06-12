// src/store/chatStore.js
import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';

const useChatStore = create((set, get) => ({
  messages: [],
  isReady: false,
  unreadCount: 0,
  
  // Reset unread count when chat is opened
  resetUnreadCount: () => set({ unreadCount: 0 }),

  // 1. Tarik History Pesan (50 terakhir)
  fetchHistory: async () => {
    const { data, error } = await supabase
      .from('global_chat')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (!error && data) {
      // Dibalik posisinya biar yang paling lama di atas (sesuai urutan chat)
      set({ messages: data.reverse(), isReady: true });
    }
  },

  // 2. Fungsi Kirim Pesan (Update tambah 'role')
  sendMessage: async (senderName, branch, role, message) => {
    await supabase.from('global_chat').insert([
      { sender_name: senderName, branch: branch, role: role, message: message }
    ]);
  },

  // 3. Fungsi Hapus Pesan
  deleteMessage: async (msgId) => {
    await supabase.from('global_chat').delete().eq('id', msgId);
  },

  // 4. RADAR REALTIME SUPABASE (Pasang Telinga)
  subscribeToChat: () => {
    const chatSubscription = supabase
      .channel('public:global_chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_chat' }, 
        (payload) => {
          // Kalau ada pesan baru masuk, tambahin ke array paling bawah
          // Dan tambah unread count jika perlu
          set((state) => ({ 
            messages: [...state.messages, payload.new],
            unreadCount: state.unreadCount + 1
          }));
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'global_chat' }, 
        (payload) => {
          // Kalau ada pesan dihapus, cari ID-nya dan buang dari layar
          set((state) => ({ 
            messages: state.messages.filter(msg => msg.id !== payload.old.id) 
          }));
        }
      )
      .subscribe();

    return chatSubscription;
  }
}));

export default useChatStore;