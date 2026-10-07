import { create } from 'zustand';

interface NoticeState {
  message: string | null;
  show: (message: string) => void;
  clear: () => void;
}

/** One app-wide snackbar message, e.g. "Updated from another device". */
export const useNotice = create<NoticeState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}));
