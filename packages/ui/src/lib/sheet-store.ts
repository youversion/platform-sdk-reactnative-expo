import { create } from "zustand";

type SheetState = {
  isOpen: boolean;
  onClose: (() => void) | null;
  openKey: number | undefined;
};

export const useSheetStore = create<SheetState>(() => ({
  isOpen: false,
  onClose: null,
  openKey: undefined,
}));
