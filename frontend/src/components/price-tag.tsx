import React from "react";
import { Text, View } from "react-native";

import { makeStyles, useResponsive, fonts, radius, spacing } from "@/src/theme";
import { formatPrice, PERIOD_LABEL } from "@/src/currency";
import type { Period } from "@/src/api";

type Props = {
  amount: number;
  symbol: string;
  currency: string;
  period: Period;
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
  testID?: string;
};

/** Price with the rent period emphasized right beside it so owners and tenants never misread. */
export function PriceTag({ amount, symbol, currency, period, size = "md", onDark, testID }: Props) {
  const styles = useStyles();
  const { ms } = useResponsive();
  const priceSize = ms(size === "lg" ? 28 : size === "sm" ? 16 : 20);
  return (
    <View testID={testID} style={styles.row}>
      <Text style={[styles.price, { fontSize: priceSize }, onDark && styles.onDark]} numberOfLines={1}>
        {formatPrice(amount, symbol, currency)}
      </Text>
      <View style={[styles.badge, size === "lg" && styles.badgeLg]}>
        <Text style={[styles.badgeText, size === "lg" && styles.badgeTextLg]}>{PERIOD_LABEL[period].toUpperCase()}</Text>
      </View>
      <Text style={[styles.code, onDark && styles.onDarkMuted]}>{currency}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors, r) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  price: { fontFamily: fonts.family, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
  onDark: { color: colors.onSurfaceInverse },
  onDarkMuted: { color: colors.surfaceTertiary },
  badge: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, height: 22, justifyContent: "center" },
  badgeLg: { height: 28, paddingHorizontal: spacing.md },
  badgeText: { fontFamily: fonts.family, fontSize: r.ms(10), fontWeight: "800", color: colors.onBrandPrimary, letterSpacing: 0.6 },
  badgeTextLg: { fontSize: r.ms(12) },
  code: { fontFamily: fonts.family, fontSize: r.ms(11), fontWeight: "700", color: colors.muted },
}));
