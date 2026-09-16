import React from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";

import { makeStyles, useTheme, fonts, spacing } from "@/src/theme";
import { api, type Listing } from "@/src/api";
import { useTabBottomChrome } from "@/src/use-tab-bottom";
import { ListingCard } from "@/src/components/listing-card";
import { EmptyState } from "@/src/components/ui";

export default function Saved() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = useTabBottomChrome();
  const favorites = useQuery({ queryKey: ["favorites"], queryFn: () => api<Listing[]>("/favorites") });
  const list = favorites.data ?? [];

  return (
    <View style={styles.root} testID="saved-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.eyebrow}>Favourites</Text>
        <Text style={styles.title}>Saved homes</Text>
      </View>
      <FlatList
        data={list}
        keyExtractor={(l) => l.listing_id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + spacing.xl }]}
        refreshing={favorites.isLoading}
        onRefresh={favorites.refetch}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 60).springify().damping(18)}>
            <ListingCard listing={item} testID={`saved-listing-${item.listing_id}`} />
          </Animated.View>
        )}
        ListEmptyComponent={
          favorites.isLoading ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
          ) : (
            <EmptyState icon="heart-outline" title="Nothing saved yet" subtitle="Tap the heart on any home to keep it here." testID="saved-empty" />
          )
        }
      />
    </View>
  );
}

const useStyles = makeStyles((colors, r) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 2 },
  eyebrow: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "800", color: colors.brandPrimary, letterSpacing: 1, textTransform: "uppercase" },
  title: { fontFamily: fonts.family, fontSize: r.ms(28), fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
  list: { padding: spacing.lg, gap: spacing.lg, width: "100%", maxWidth: r.contentMaxWidth, alignSelf: "center" },
}));
