import React from "react";
import { ActivityIndicator, Pressable, StyleProp, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { fileUrl } from "@/src/api";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

// ---------- Button ----------
type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "dark" | "whatsapp";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  small?: boolean;
};

export function Button({ title, onPress, variant = "primary", icon, loading, disabled, style, testID, small }: ButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const bg =
    variant === "primary"
      ? colors.brandPrimary
      : variant === "secondary"
        ? colors.brandSecondary
        : variant === "dark"
          ? colors.surfaceInverse
          : variant === "whatsapp"
            ? colors.whatsapp
            : "transparent";
  const fg =
    variant === "primary"
      ? colors.onBrandPrimary
      : variant === "secondary"
        ? colors.onBrandSecondary
        : variant === "dark"
          ? colors.onSurfaceInverse
          : variant === "whatsapp"
            ? colors.onBrand
            : colors.onSurface;
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        variant === "ghost" && { borderWidth: 1.5, borderColor: colors.borderStrong },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 20} color={fg} />}
          <Text style={[styles.btnText, small && styles.btnTextSmall, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// ---------- Icon button ----------
export function IconButton({
  icon,
  onPress,
  testID,
  style,
  color,
  bg,
  size = 22,
}: {
  icon: IconName;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  color?: string;
  bg?: string;
  size?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: bg ?? colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }, style]}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.onSurface} />
    </Pressable>
  );
}

// ---------- Field ----------
type FieldProps = TextInputProps & { label?: string; error?: string; icon?: IconName; testID?: string; right?: React.ReactNode };
export function Field({ label, error, icon, style, right, ...rest }: FieldProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.fieldWrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, error ? { borderColor: colors.error } : null]}>
        {icon && <Ionicons name={icon} size={18} color={colors.muted} />}
        <TextInput
          placeholderTextColor={colors.muted}
          style={[styles.input, style]}
          {...rest}
        />
        {right}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

// ---------- Chip ----------
export function Chip({
  label,
  selected,
  onPress,
  testID,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  icon?: IconName;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress?.();
      }}
      style={[
        styles.chip,
        { backgroundColor: selected ? colors.surfaceInverse : colors.glassStrong, borderColor: selected ? colors.surfaceInverse : colors.border },
      ]}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? colors.onSurfaceInverse : colors.onSurface} />}
      <Text style={[styles.chipText, { color: selected ? colors.onSurfaceInverse : colors.onSurface }]}>{label}</Text>
    </Pressable>
  );
}

// ---------- Avatar ----------
export function Avatar({ uri, name, size = 44, testID }: { uri?: string; name?: string; size?: number; testID?: string }) {
  const styles = useStyles();
  const initials = (name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (uri) {
    return <Image testID={testID} source={{ uri: fileUrl(uri) }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  }
  return (
    <View testID={testID} style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

// ---------- Section title ----------
export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

// ---------- Empty ----------
export function EmptyState({ icon, title, subtitle, testID }: { icon: IconName; title: string; subtitle?: string; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View testID={testID} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.onBrandTertiary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySub}>{subtitle}</Text>}
    </View>
  );
}

export function RoleBadge({ role }: { role: string | null | undefined }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isOwner = role === "homeowner";
  return (
    <View style={[styles.roleBadge, { backgroundColor: isOwner ? colors.accentLemon : colors.accentMint }]}>
      <Ionicons name={isOwner ? "home" : "key"} size={12} color={isOwner ? colors.onAccentLemon : colors.onAccentMint} />
      <Text style={[styles.roleText, { color: isOwner ? colors.onAccentLemon : colors.onAccentMint }]}>
        {isOwner ? "Homeowner" : "Tenant"}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  btn: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  btnSmall: { minHeight: 40, paddingHorizontal: spacing.lg },
  btnText: { fontFamily: fonts.family, fontSize: 16, fontWeight: "700" },
  btnTextSmall: { fontSize: 14 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  fieldWrap: { gap: 6 },
  label: { fontFamily: fonts.family, fontSize: 13, fontWeight: "700", color: colors.onSurfaceSecondary, marginLeft: spacing.xs },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
  },
  input: { flex: 1, fontFamily: fonts.family, fontSize: 16, color: colors.onSurface, paddingVertical: spacing.md },
  error: { fontFamily: fonts.family, fontSize: 12, color: colors.error, marginLeft: spacing.xs },
  chip: {
    height: 36,
    flexShrink: 0,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  chipText: { fontFamily: fonts.family, fontSize: 13, fontWeight: "600" },
  avatarFallback: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.family, fontWeight: "800", color: colors.onBrandTertiary },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.family, fontSize: 20, fontWeight: "800", color: colors.onSurface },
  empty: { alignItems: "center", paddingVertical: spacing["2xl"], paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: fonts.family, fontSize: 17, fontWeight: "800", color: colors.onSurface, textAlign: "center" },
  emptySub: { fontFamily: fonts.family, fontSize: 14, color: colors.muted, textAlign: "center" },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 26, borderRadius: radius.pill, alignSelf: "flex-start" },
  roleText: { fontFamily: fonts.family, fontSize: 12, fontWeight: "700" },
}));
