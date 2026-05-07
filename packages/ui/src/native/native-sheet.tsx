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
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Portal, PortalHost } from "@rn-primitives/portal";
import { useSheetStore } from "../lib/sheet-store";

const PORTAL_NAME = "native-sheet";
const HOST_NAME = "native-sheet-host";

// ---------------------------------------------------------------------------
// NativeSheet — portal client (transports children + signals open/close state)
// ---------------------------------------------------------------------------

type NativeSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  openKey?: number;
  children: React.ReactNode;
};

/**
 * Renders nothing locally. Transports children to the root-level
 * NativeSheetProvider via @rn-primitives/portal, and signals open/close
 * state to the companion zustand store.
 */
export function NativeSheet({
  isOpen,
  onClose,
  openKey,
  children,
}: NativeSheetProps) {
  useEffect(() => {
    if (Platform.OS === "web") return;
    useSheetStore.setState({ isOpen, onClose, openKey });
  }, [isOpen, onClose, openKey]);

  useEffect(() => {
    return () => {
      if (Platform.OS !== "web") {
        useSheetStore.setState({ isOpen: false, onClose: null });
      }
    };
  }, []);

  if (Platform.OS === "web") return null;

  return (
    <Portal name={PORTAL_NAME} hostName={HOST_NAME}>
      {children}
    </Portal>
  );
}

// ---------------------------------------------------------------------------
// NativeSheetProvider — portal host (renders BottomSheet at app root)
// ---------------------------------------------------------------------------

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
  const openKey = useSheetStore((s) => s.openKey);

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
  const openKeyRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const openKeyChanged = openKey !== openKeyRef.current;
    if (isOpen && (!wasOpenRef.current || openKeyChanged)) {
      closingRef.current = false;
      sheetRef.current?.snapToIndex(0);
    } else if (!isOpen && wasOpenRef.current) {
      closingRef.current = true;
      sheetRef.current?.close();
    }
    wasOpenRef.current = isOpen;
    openKeyRef.current = openKey;
  }, [isOpen, openKey]);

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
});
