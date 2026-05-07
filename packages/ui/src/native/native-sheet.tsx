/**
 * Portal-based bottom sheet using @rn-primitives/portal + @gorhom/bottom-sheet.
 *
 * WHY NOT React Native's `<Modal>`?
 * Modal unmounts its children when `visible={false}`. Our sheet content is a
 * DOM component (Expo "use dom" — renders in a WebView). WebViews take ~500ms+
 * to cold-start, so every open/close cycle would flash a blank sheet while the
 * WebView re-initialises. By rendering at the root via a portal, we keep
 * children mounted across open/close — the WebView stays warm and subsequent
 * opens are instant.
 *
 * WHY NOT BottomSheetModal?
 * gorhom's BottomSheetModal unmounts children on dismiss, which defeats our
 * WebView pre-warming strategy. Instead we use the inline BottomSheet component
 * inside the portal host, keeping content mounted at all times.
 *
 * WHY @rn-primitives/portal?
 * React Native doesn't have `createPortal` like React DOM. We previously used
 * a custom context-based portal. @rn-primitives/portal provides a battle-tested
 * zustand-based portal primitive so we don't maintain our own. Open/close state
 * is communicated via a companion zustand store (sheet-store.ts).
 */

import { useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Portal, PortalHost } from "@rn-primitives/portal";

const PORTAL_NAME = "native-sheet";
const HOST_NAME = "native-sheet-host";
let nextSheetId = 0;

type SheetState = {
  isOpen: boolean;
  onClose: (() => void) | null;
  activeSheetId: number | null;
};

export const useSheetStore = create<SheetState>(() => ({
  isOpen: false,
  onClose: null,
  activeSheetId: null,
}));

type NativeSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Renders nothing locally. Transports children to the root-level
 * NativeSheetProvider via `@rn-primitives/portal`, and signals open/close
 * state to the companion zustand store. This is all done to pre-warm Expo DOM
 * components in order to avoid the ~500ms cold-boot issue for WebViews, so
 * that the contents inside can feel native.
 */
export function NativeSheet({
  isOpen,
  onClose,
  children,
}: NativeSheetProps) {
  const sheetIdRef = useRef<number | null>(null);
  if (sheetIdRef.current === null) {
    sheetIdRef.current = nextSheetId++;
  }
  const sheetId = sheetIdRef.current;

  useEffect(() => {
    if (Platform.OS === "web") return;
    useSheetStore.setState((state) => {
      if (isOpen) {
        return { isOpen: true, onClose, activeSheetId: sheetId };
      }
      if (state.activeSheetId === sheetId) {
        return { isOpen: false, onClose: null, activeSheetId: null };
      }
      return state;
    });
  }, [isOpen, onClose, sheetId]);

  useEffect(() => {
    return () => {
      if (Platform.OS !== "web") {
        useSheetStore.setState((state) => {
          if (state.activeSheetId !== sheetId) return state;
          return { isOpen: false, onClose: null, activeSheetId: null };
        });
      }
    };
  }, [sheetId]);

  if (Platform.OS === "web") return null;

  return (
    <Portal name={`${PORTAL_NAME}-${sheetId}`} hostName={HOST_NAME}>
      <SheetContent sheetId={sheetId}>{children}</SheetContent>
    </Portal>
  );
}

function SheetContent({
  sheetId,
  children,
}: {
  sheetId: number;
  children: React.ReactNode;
}) {
  const activeSheetId = useSheetStore((s) => s.activeSheetId);
  const isActive = activeSheetId === sheetId;
  return (
    <View
      pointerEvents={isActive ? "auto" : "none"}
      style={isActive ? undefined : styles.hidden}
    >
      {children}
    </View>
  );
}

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop
    {...props}
    pressBehavior="close"
    appearsOnIndex={0}
    disappearsOnIndex={-1}
  />
);

export function NativeSheetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { bottom } = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);

  const isOpen = useSheetStore((s) => s.isOpen);
  const onClose = useSheetStore((s) => s.onClose);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const closingRef = useRef(false);

  const handleSheetChange = useCallback((index: number) => {
    if (index !== -1) {
      closingRef.current = false;
      return;
    }
    if (!closingRef.current) {
      onCloseRef.current?.();
    }
    closingRef.current = false;
  }, []);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      closingRef.current = false;
      sheetRef.current?.snapToIndex(0);
    } else if (!isOpen && wasOpenRef.current) {
      closingRef.current = true;
      sheetRef.current?.close();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  if (Platform.OS === "web") {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      <BottomSheet
        ref={sheetRef}
        index={-1}
        enablePanDownToClose
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        onChange={handleSheetChange}
        style={styles.sheet}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView
          style={{ paddingBottom: bottom, paddingHorizontal: 8 }}
        >
          <PortalHost name={HOST_NAME} />
        </BottomSheetView>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    zIndex: 1000,
  },
  handle: {
    backgroundColor: "#ccc",
  },
  hidden: {
    height: 1,
    opacity: 0,
    position: "absolute",
    width: 1,
  },
});
