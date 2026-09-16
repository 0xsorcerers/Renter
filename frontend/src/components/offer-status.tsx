import React from "react";
import { Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import type { OfferStatus } from "@/src/api";

export function OfferStatusBadge({ status, testID }: { status: OfferStatus; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const map = {
    pending: { bg: colors.accentLemon, fg: colors.onAccentLemon, icon: "time-outline" as const, label: "Pending" },
    accepted: { bg: colors.success, fg: colors.onSuccess, icon: "checkmark-circle" as const, label: "Accepted" },
    declined: { bg: colors.surfaceTertiary, fg: colors.muted, icon: "close-circle" as const, label: "Declined" },
    closed: { bg: colors.surfaceTertiary, fg: colors.muted, icon: "lock-closed" as const, label: "Closed" },
  }[status ?? "pending"];
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: map.bg }]}>
      <Ionicons name={map.icon} size={12} color={map.fg} />
      <Text style={[styles.text, { color: map.fg }]}>{map.label}</Text>
    </View>
  );
}

const useStyles = makeStyles((_c, r) => ({
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm + 2, height: 24, borderRadius: radius.pill },
  text: { fontFamily: fonts.family, fontSize: r.ms(11), fontWeight: "800" },
}));
