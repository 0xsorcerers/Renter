import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";

type ToastKind = "success" | "error" | "info";
type ToastCtx = { show: (message: string, kind?: ToastKind) => void };
const Ctx = createContext<ToastCtx>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; kind: ToastKind; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, kind, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const value = useMemo(() => ({ show }), [show]);
  const bg = toast?.kind === "success" ? colors.success : toast?.kind === "error" ? colors.error : colors.surfaceInverse;
  const fg = toast?.kind === "success" ? colors.onSuccess : toast?.kind === "error" ? colors.onError : colors.onSurfaceInverse;
  const icon = toast?.kind === "success" ? "checkmark-circle" : toast?.kind === "error" ? "alert-circle" : "information-circle";

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <View pointerEvents="none" style={[styles.wrap, { top: insets.top + spacing.sm }]}>
          <Animated.View
            key={toast.id}
            entering={FadeInUp.springify().damping(16)}
            exiting={FadeOutUp}
            style={[styles.toast, { backgroundColor: bg }]}
            testID="toast-message"
          >
            <Ionicons name={icon as any} size={18} color={fg} />
            <Text style={[styles.text, { color: fg }]}>{toast.message}</Text>
          </Animated.View>
        </View>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const useStyles = makeStyles((colors, r) => ({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center", zIndex: 1000 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    maxWidth: "100%",
  },
  text: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "600", flexShrink: 1 },
}));
