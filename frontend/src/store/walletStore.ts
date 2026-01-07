import { create } from 'zustand';

interface WalletStore {
  address: string | null;
  isConnected: boolean;
  setAddress: (address: string | null) => void;
  setIsConnected: (connected: boolean) => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  address: null,
  isConnected: false,
  setAddress: (address) => set({ address }),
  setIsConnected: (isConnected) => set({ isConnected }),
}));
