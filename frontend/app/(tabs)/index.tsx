import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { api, type Listing, type Period } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { useTabBottomChrome } from "@/src/use-tab-bottom";
import { AppMap } from "@/src/components/app-map";
import { Glass } from "@/src/components/glass";
import { Chip, EmptyState, IconButton } from "@/src/components/ui";
import { ListingCard } from "@/src/components/listing-card";
import { formatPrice, PERIOD_SHORT } from "@/src/currency";

const PERIODS: { key: "" | Period; label: string }[] = [
  { key: "", label: "All" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "year", label: "Yearly" },
];

export default function Explore() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = useTabBottomChrome();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<"" | Period>("");
  const [mode, setMode] = useState<"map" | "list">("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const carouselRef = useRef<FlatList<Listing>>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["listings", search, period],
    queryFn: () => api<Listing[]>(`/listings?q=${encodeURIComponent(search)}&period=${period}`),
  });
  const listings = useMemo(() => data ?? [], [data]);
  const selected = listings.find((l) => l.listing_id === selectedId) ?? listings[0];

  const pins = useMemo(
    () =>
      listings.map((l) => ({
        id: l.listing_id,
        lat: l.lat,
        lng: l.lng,
        label: `${formatPrice(l.price, l.currency_symbol, l.currency)}${PERIOD_SHORT[l.period]}`,
        selected: selected?.listing_id === l.listing_id,
      })),
    [listings, selected],
  );

  const cardWidth = Math.min(width - spacing.xl * 2, 360);
  const onPinPress = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedId(id);
    const idx = listings.findIndex((l) => l.listing_id === id);
    if (idx >= 0) carouselRef.current?.scrollToIndex({ index: idx, animated: true });
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
      <Glass strong style={styles.searchPill} testID="explore-search-pill">
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            testID="explore-search-input"
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => setSearch(q.trim())}
            returnKeyType="search"
            placeholder="Search city, country or title"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
          {q.length > 0 && (
            <Pressable
              testID="explore-search-clear"
              onPress={() => {
                setQ("");
                setSearch("");
              }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
          <Pressable
            testID="explore-mode-toggle"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setMode((m) => (m === "map" ? "list" : "map"));
            }}
            style={styles.modeBtn}
          >
            <Ionicons name={mode === "map" ? "list" : "map"} size={18} color={colors.onSurfaceInverse} />
          </Pressable>
        </View>
      </Glass>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        {PERIODS.map((p) => (
          <Chip key={p.key} testID={`period-chip-${p.key || "all"}`} label={p.label} selected={period === p.key} onPress={() => setPeriod(p.key)} />
        ))}
      </ScrollView>
    </View>
  );

  const fab =
    user?.role === "homeowner" ? (
      <Pressable
        testID="create-listing-fab"
        onPress={() => router.push("/listing/create")}
        style={({ pressed }) => [styles.fab, { bottom: bottomChrome + 16 + (mode === "map" && listings.length > 0 ? 262 : 0), transform: [{ scale: pressed ? 0.94 : 1 }] }]}
      >
        <Ionicons name="add" size={26} color={colors.onSurfaceInverse} />
        <Text style={styles.fabText}>List a home</Text>
      </Pressable>
    ) : null;

  if (mode === "list") {
    return (
      <View style={styles.root} testID="explore-list-screen">
        <FlatList
          data={listings}
          keyExtractor={(l) => l.listing_id}
          contentContainerStyle={{ paddingTop: insets.top + 130, paddingBottom: bottomChrome + spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.lg }}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 60).springify().damping(18)}>
              <ListingCard listing={item} testID={`listing-card-${item.listing_id}`} />
            </Animated.View>
          )}
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
            ) : (
              <EmptyState icon="home-outline" title="No homes found" subtitle="Try another city or clear the filters." testID="explore-empty" />
            )
          }
          refreshing={isLoading}
          onRefresh={refetch}
        />
        {header}
        {fab}
      </View>
    );
  }

  return (
    <View style={styles.root} testID="explore-map-screen">
      <AppMap pins={pins} center={selected ? { lat: selected.lat, lng: selected.lng } : undefined} onPinPress={onPinPress} style={styles.map} testID="explore-map" />
      {header}
      {isLoading && (
        <View style={styles.center} pointerEvents="none">
          <Glass style={styles.loadingPill}>
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.brandPrimary} />
              <Text style={styles.loadingText}>Finding homes…</Text>
            </View>
          </Glass>
        </View>
      )}
      {isError && (
        <View style={styles.center}>
          <Glass strong style={styles.loadingPill}>
            <Pressable onPress={() => refetch()} style={styles.loadingRow} testID="explore-retry">
              <Ionicons name="refresh" size={18} color={colors.onSurface} />
              <Text style={styles.loadingText}>Retry map</Text>
            </Pressable>
          </Glass>
        </View>
      )}
      {!isLoading && listings.length === 0 && (
        <View style={styles.center} pointerEvents="none">
          <Glass strong style={styles.emptyGlass}>
            <EmptyState icon="home-outline" title="No homes found in this area" subtitle="Try another search or clear filters." testID="explore-empty" />
          </Glass>
        </View>
      )}
      {listings.length > 0 && (
        <FlatList
          ref={carouselRef}
          horizontal
          data={listings}
          keyExtractor={(l) => l.listing_id}
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + spacing.md}
          decelerationRate="fast"
          getItemLayout={(_, i) => ({ length: cardWidth + spacing.md, offset: (cardWidth + spacing.md) * i, index: i })}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md }}
          style={[styles.carousel, { bottom: bottomChrome + 16 }]}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + spacing.md));
            const l = listings[idx];
            if (l) setSelectedId(l.listing_id);
          }}
          renderItem={({ item }) => <ListingCard listing={item} glass compact width={cardWidth} testID={`listing-card-${item.listing_id}`} />}
        />
      )}
      {fab}
      <View style={[styles.countPill, { bottom: bottomChrome + 16 + (listings.length > 0 ? 262 : 0) }]} pointerEvents="none">
        <Glass style={{ borderRadius: radius.pill }}>
          <Text style={styles.countText} testID="explore-count">
            {listings.length} home{listings.length === 1 ? "" : "s"}
          </Text>
        </Glass>
      </View>
      {user?.role === "homeowner" ? null : (
        <IconButton
          testID="explore-locate-button"
          icon="locate"
          style={[styles.locate, { bottom: bottomChrome + 16 + (listings.length > 0 ? 262 : 0) }]}
          bg={colors.surfaceInverse}
          color={colors.onSurfaceInverse}
          onPress={() => listings[0] && onPinPress(listings[0].listing_id)}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  map: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  header: { position: "absolute", top: 0, left: 0, right: 0, gap: spacing.sm },
  searchPill: { marginHorizontal: spacing.lg, borderRadius: radius.pill },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: spacing.lg, paddingRight: 6, height: 56 },
  searchInput: { flex: 1, fontFamily: fonts.family, fontSize: 15, color: colors.onSurface, height: 56 },
  modeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center" },
  chipRow: { height: 56, flexGrow: 0 },
  chipRowContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  carousel: { position: "absolute", left: 0, right: 0, flexGrow: 0 },
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  loadingPill: { borderRadius: radius.pill },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, height: 48 },
  loadingText: { fontFamily: fonts.family, fontSize: 14, fontWeight: "700", color: colors.onSurface },
  emptyGlass: { borderRadius: radius.lg, marginHorizontal: spacing.xl },
  fab: {
    position: "absolute",
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.pill,
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
    height: 52,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: { fontFamily: fonts.family, fontSize: 15, fontWeight: "800", color: colors.onSurfaceInverse },
  countPill: { position: "absolute", left: spacing.lg },
  countText: { fontFamily: fonts.family, fontSize: 13, fontWeight: "800", color: colors.onSurface, paddingHorizontal: spacing.lg, height: 40, lineHeight: 40 },
  locate: { position: "absolute", right: spacing.lg },
}));
