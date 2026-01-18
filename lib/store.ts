import { create } from 'zustand';

interface Tag {
    id: string;
    label: string;
    color: string;
}

interface StoreState {
    activeTagId: string | null;
    setActiveTagId: (id: string | null) => void;
}

export const useStore = create<StoreState>((set) => ({
    activeTagId: null,
    setActiveTagId: (id) => set({ activeTagId: id }),
}));
