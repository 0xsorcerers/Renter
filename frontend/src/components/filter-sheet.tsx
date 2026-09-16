import React, { useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import type { ListingFilters } from "@/src/api";
import { Button, Chip } from "./ui";
import { useToast } from "./toast";

const TYPES = ["apartment", "house", "studio", "room", "loft", "duplex"];
const BEDS = [1, 2, 3, 4];
export const NEAR_ME_RADIUS_KM = 25;

type Props = {
  visible: boolean;
  onClose: () => void;
  value: ListingFilters;
  onApply: (f: ListingFilters) => void;
};

export function countActiveFilters(f: ListingFilters) {
  return [f.min_price, f.max_price, f.bedrooms, f.property_type, f.near].filter(Boolean).length;
}

export function FilterSheet({ visible, onClose, value, onApply }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [draft, setDraft] = useState<ListingFilters>(value);
  const [locating, setLocating] = useState(false);
  const [blocked, setBlocked] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setDraft(value);
      setBlocked(false);
    }
  }, [visible, value]);

  const enableNearMe = async () => {
    setLocating(true);
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        if (!perm.canAskAgain) {
          setBlocked(true);
          return;
        }
        perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") {
          if (!perm.canAskAgain) setBlocked(true);
          else toast.show("Location is needed to find homes near you", "error");
          return;
        }
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDraft((d) => ({ ...d, near: { lat: pos.coords.latitude, lng: pos.coords.longitude, radius_km: NEAR_ME_RADIUS_KM } }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      toast.show("Couldn't get your location. Try again.", "error");
    } finally {
      setLocating(false);
    }
  };

  const reset = () => setDraft({ q: draft.q, period: draft.period });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="filter-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="filter-sheet">
        <View style={styles.handle} />
        <View style={styles.head}>
          <Text style={styles.title}>Filters</Text>
          <Pressable onPress={reset} hitSlop={8} testID="filter-reset-button">
            <Text style={styles.reset}>Reset</Text>
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          {/* Near me */}
          <View style={[styles.nearCard, draft.near && styles.nearCardOn]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.nearTitle}>Near me</Text>
              <Text style={styles.nearSub}>
                {draft.near ? `Showing homes within ${draft.near.radius_km} km of you` : `Homes within ${NEAR_ME_RADIUS_KM} km of your location`}
              </Text>
              {blocked && (
                <Pressable onPress={() => Linking.openSettings()} style={styles.settingsLink} testID="filter-open-settings">
                  <Ionicons name="settings-outline" size={14} color={colors.error} />
                  <Text style={styles.settingsText}>Location is off — open Settings</Text>
                </Pressable>
              )}
            </View>
            {locating ? (
              <ActivityIndicator color={colors.brandPrimary} />
            ) : (
              <Pressable
                testID="filter-near-me-toggle"
                onPress={() => (draft.near ? setDraft((d) => ({ ...d, near: null })) : enableNearMe())}
                style={[styles.toggle, draft.near && styles.toggleOn]}
              >
                <View style={[styles.knob, draft.near && styles.knobOn]} />
              </Pressable>
            )}
          </View>

          {/* Price */}
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.label}>Price range (in listing currency)</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput
                testID="filter-min-price"
                value={draft.min_price ?? ""}
                onChangeText={(v) => setDraft((d) => ({ ...d, min_price: v.replace(/[^\d]/g, "") }))}
                keyboardType="numeric"
                placeholder="Min"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <TextInput
                testID="filter-max-price"
                value={draft.max_price ?? ""}
                onChangeText={(v) => setDraft((d) => ({ ...d, max_price: v.replace(/[^\d]/g, "") }))}
                keyboardType="numeric"
                placeholder="Max"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
          </View>

          {/* Bedrooms */}
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.label}>Bedrooms</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
              <Chip label="Any" selected={!draft.bedrooms} onPress={() => setDraft((d) => ({ ...d, bedrooms: undefined }))} testID="filter-beds-any" />
              {BEDS.map((b) => (
                <Chip key={b} label={`${b}+`} selected={draft.bedrooms === b} onPress={() => setDraft((d) => ({ ...d, bedrooms: b }))} testID={`filter-beds-${b}`} />
              ))}
            </ScrollView>
          </View>

          {/* Type */}
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.label}>Property type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
              <Chip label="Any" selected={!draft.property_type} onPress={() => setDraft((d) => ({ ...d, property_type: "" }))} testID="filter-type-any" />
              {TYPES.map((t) => (
                <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} selected={draft.property_type === t} onPress={() => setDraft((d) => ({ ...d, property_type: t }))} testID={`filter-type-${t}`} />
              ))}
            </ScrollView>
          </View>
        </ScrollView>
        <Button
          testID="filter-apply-button"
          title="Show homes"
          icon="search"
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        />
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors, r) => ({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 8,
    borderTopRightRadius: radius.lg + 8,
    padding: spacing.xl,
    gap: spacing.lg,
    width: "100%",
    maxWidth: r.contentMaxWidth,
    alignSelf: "center",
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, alignSelf: "center", marginTop: -spacing.sm },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.family, fontSize: r.ms(22), fontWeight: "800", color: colors.onSurface },
  reset: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "700", color: colors.brandPrimary },
  label: { fontFamily: fonts.family, fontSize: r.ms(13), fontWeight: "700", color: colors.onSurfaceSecondary },
  nearCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  nearCardOn: { backgroundColor: colors.brandTertiary, borderColor: colors.brand },
  nearTitle: { fontFamily: fonts.family, fontSize: r.ms(16), fontWeight: "800", color: colors.onSurface },
  nearSub: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.muted },
  settingsLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  settingsText: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "700", color: colors.error },
  toggle: { width: 52, height: 32, borderRadius: 16, backgroundColor: colors.surfaceTertiary, padding: 3, justifyContent: "center" },
  toggleOn: { backgroundColor: colors.brandPrimary },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface },
  knobOn: { alignSelf: "flex-end" },
  input: { flex: 1, height: 50, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, fontFamily: fonts.family, fontSize: r.ms(15), color: colors.onSurface },
  chipRow: { height: 44, flexGrow: 0 },
  chipRowContent: { gap: spacing.sm, alignItems: "center", paddingRight: spacing.xl },
}));
