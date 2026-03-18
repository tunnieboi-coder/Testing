import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SystemStore {
  currentSystemId: string | null;
  setCurrentSystem: (id: string | null) => void;
}

export const useSystemStore = create<SystemStore>()(
  persist(
    (set) => ({
      currentSystemId: null,
      setCurrentSystem: (id) => set({ currentSystemId: id }),
    }),
    { name: 'grc-current-system' }
  )
);
