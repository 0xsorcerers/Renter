import React from "react";
import { Linking, Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";

export type MapPin = { id: string; lat: number; lng: number; label: string; selected?: boolean };

type Props = {
  pins: MapPin[];
  center?: { lat: number; lng: number };
  zoomDelta?: number;
  onPinPress?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
  testID?: string;
};

/** Web preview fallback: native Google map renders on devices; here we show pins as pills. */
export function AppMap({ pins, center, onPinPress, style, testID }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const focus = center ?? (pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : null);
  return (
    <View testID={testID} style={[styles.wrap, style]}>
      <LinearGradient colors={[colors.accentMint, colors.brandTertiary, colors.accentLemon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill} />
      <View style={styles.grid} pointerEvents="none">
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={`h${i}`} style={[styles.lineH, { top: `${(i + 1) * 14}%` }]} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={`v${i}`} style={[styles.lineV, { left: `${(i + 1) * 14}%` }]} />
        ))}
      </View>
      <View style={styles.pinsWrap}>
        {pins.slice(0, 8).map((p, i) => (
          <Pressable
            key={p.id}
            testID={`map-pin-${p.id}`}
            onPress={() => onPinPress?.(p.id)}
            style={[styles.pin, p.selected && styles.pinSelected, { marginLeft: (i % 3) * 18 }]}
          >
            <Ionicons name="location" size={14} color={p.selected ? colors.brandSecondary : colors.brandPrimary} />
            <Text style={[styles.pinText, p.selected && styles.pinTextSelected]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.note}>
        <Ionicons name="map" size={14} color={colors.onSurface} />
        <Text style={styles.noteText}>Interactive Google Map renders on iOS & Android</Text>
        {focus && (
          <Pressable
            testID="open-google-maps-button"
            onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${focus.lat},${focus.lng}`)}
          >
            <Text style={styles.link}>Open in Maps</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { overflow: "hidden", backgroundColor: colors.surfaceTertiary, position: "relative" },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  grid: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 },
  lineH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: colors.surface },
  lineV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: colors.surface },
  pinsWrap: { position: "absolute", top: "22%", left: spacing.xl, right: spacing.xl, gap: spacing.md },
  pin: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
  },
  pinSelected: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  pinText: { fontFamily: fonts.family, fontSize: 12, fontWeight: "800", color: colors.onSurface },
  pinTextSelected: { color: colors.brandSecondary },
  note: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.glassStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 30,
  },
  noteText: { fontFamily: fonts.family, fontSize: 11, color: colors.onSurface, fontWeight: "600" },
  link: { fontFamily: fonts.family, fontSize: 11, color: colors.brandPrimary, fontWeight: "800" },
}));
