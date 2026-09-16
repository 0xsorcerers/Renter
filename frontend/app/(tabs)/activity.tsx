import React from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { api, type Listing, type Offer } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { useTabBottomChrome } from "@/src/use-tab-bottom";
import { ListingCard } from "@/src/components/listing-card";
import { Button, EmptyState } from "@/src/components/ui";
import { PriceTag } from "@/src/components/price-tag";

export default function Activity() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = useTabBottomChrome();
  const router = useRouter();
  const { user } = useAuth();
  const isOwner = user?.role === "homeowner";

  const myListings = useQuery({
    queryKey: ["listings", "mine"],
    queryFn: () => api<Listing[]>("/listings?mine=true"),
    enabled: isOwner,
  });
  const myOffers = useQuery({
    queryKey: ["offers", "mine"],
    queryFn: () => api<Offer[]>("/offers/mine"),
    enabled: !isOwner,
  });

  const loading = isOwner ? myListings.isLoading : myOffers.isLoading;
  const refetch = isOwner ? myListings.refetch : myOffers.refetch;

  const Header = (
    <View style={styles.headerInner}>
      <Text style={styles.eyebrow}>{isOwner ? "Homeowner hub" : "Tenant hub"}</Text>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{isOwner ? "My listings" : "My offers"}</Text>
        {isOwner && <Button testID="activity-create-listing-button" title="New" icon="add" small onPress={() => router.push("/listing/create")} />}
      </View>
    </View>
  );

  return (
    <View style={styles.root} testID="activity-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>{Header}</View>
      {isOwner ? (
        <FlatList
          data={myListings.data ?? []}
          keyExtractor={(l) => l.listing_id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + spacing.xl }]}
          refreshing={loading}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <View style={{ gap: spacing.sm }}>
              <ListingCard listing={item} testID={`my-listing-${item.listing_id}`} />
              <Pressable onPress={() => router.push(`/listing/${item.listing_id}`)} style={styles.offersLink} testID={`my-listing-offers-${item.listing_id}`}>
                <Ionicons name="chatbubbles" size={16} color={colors.onBrandTertiary} />
                <Text style={styles.offersLinkText}>
                  {item.offers_count} tenant offer{item.offers_count === 1 ? "" : "s"} · {item.reviews_count} review{item.reviews_count === 1 ? "" : "s"}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.onBrandTertiary} />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
            ) : (
              <EmptyState icon="home-outline" title="No listings yet" subtitle="Post your first home — no agents, no hidden fees." testID="activity-empty" />
            )
          }
        />
      ) : (
        <FlatList
          data={myOffers.data ?? []}
          keyExtractor={(o) => o.offer_id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + spacing.xl }]}
          refreshing={loading}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/listing/${item.listing_id}`)} style={styles.offerCard} testID={`my-offer-${item.offer_id}`}>
              <Text style={styles.offerTitle} numberOfLines={1}>
                {item.listing?.title ?? "Listing"}
              </Text>
              <Text style={styles.offerAddr} numberOfLines={1}>
                {item.listing?.city}, {item.listing?.country}
              </Text>
              <View style={styles.offerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerLabel}>Your offer</Text>
                  <PriceTag amount={item.amount} symbol={item.currency_symbol} currency={item.currency} period={item.period} size="sm" />
                </View>
                {item.listing && (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.offerLabel}>Asking</Text>
                    <PriceTag amount={item.listing.price} symbol={item.listing.currency_symbol} currency={item.listing.currency} period={item.listing.period} size="sm" />
                  </View>
                )}
              </View>
              {item.message ? <Text style={styles.offerMsg}>“{item.message}”</Text> : null}
            </Pressable>
          )}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
            ) : (
              <EmptyState icon="pricetag-outline" title="No offers yet" subtitle="Find a home you love and drop your offer beneath the listing." testID="activity-empty" />
            )
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerInner: { gap: 2 },
  eyebrow: { fontFamily: fonts.family, fontSize: 12, fontWeight: "800", color: colors.brandPrimary, letterSpacing: 1, textTransform: "uppercase" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.family, fontSize: 28, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
  list: { padding: spacing.lg, gap: spacing.lg },
  offersLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 40,
  },
  offersLinkText: { flex: 1, fontFamily: fonts.family, fontSize: 13, fontWeight: "700", color: colors.onBrandTertiary },
  offerCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: 6, borderWidth: 1, borderColor: colors.border },
  offerTitle: { fontFamily: fonts.family, fontSize: 16, fontWeight: "800", color: colors.onSurface },
  offerAddr: { fontFamily: fonts.family, fontSize: 13, color: colors.muted },
  offerRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  offerLabel: { fontFamily: fonts.family, fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 2, textTransform: "uppercase" },
  offerMsg: { fontFamily: fonts.family, fontSize: 13, color: colors.onSurfaceSecondary, fontStyle: "italic", marginTop: spacing.xs },
}));
