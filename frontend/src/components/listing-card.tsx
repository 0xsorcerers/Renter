import React from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { fileUrl, type Listing } from "@/src/api";
import { PriceTag } from "./price-tag";
import { Glass } from "./glass";
import { useFavorite } from "@/src/use-favorite";

type Props = { listing: Listing; compact?: boolean; glass?: boolean; width?: number; testID?: string };

export function ListingCard({ listing, compact, glass, width, testID }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const favorite = useFavorite();
  const photo = listing.photos?.[0];

  const body = (
    <>
      <View style={[styles.imageWrap, compact && styles.imageWrapCompact]}>
        {photo ? (
          <Image source={{ uri: fileUrl(photo) }} style={styles.image} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.image, styles.noPhoto]}>
            <Ionicons name="home-outline" size={34} color={colors.muted} />
          </View>
        )}
        <View style={styles.typePill}>
          <Text style={styles.typeText}>{listing.status === "rented" ? "Rented" : listing.property_type}</Text>
        </View>
        {listing.rating != null && (
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={12} color={colors.onAccentLemon} />
            <Text style={styles.ratingText}>{listing.rating}</Text>
          </View>
        )}
        <Pressable
          testID={`favorite-button-${listing.listing_id}`}
          hitSlop={8}
          onPress={() => favorite.mutate({ listingId: listing.listing_id, next: !listing.is_favorited })}
          style={styles.heart}
        >
          <Ionicons name={listing.is_favorited ? "heart" : "heart-outline"} size={20} color={listing.is_favorited ? colors.error : colors.onSurface} />
        </Pressable>
        {listing.distance_km != null && (
          <View style={styles.distancePill}>
            <Ionicons name="navigate" size={11} color={colors.onSurfaceInverse} />
            <Text style={styles.distanceText}>{listing.distance_km} km</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>
        <View style={styles.locRow}>
          <Ionicons name="location" size={13} color={colors.brandPrimary} />
          <Text style={styles.loc} numberOfLines={1}>
            {listing.city ? `${listing.city}, ${listing.country}` : listing.address}
          </Text>
        </View>
        <PriceTag amount={listing.price} symbol={listing.currency_symbol} currency={listing.currency} period={listing.period} size="sm" />
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {listing.bedrooms} bd · {listing.bathrooms} ba
          </Text>
          <Text style={styles.meta}>
            {listing.offers_count} offer{listing.offers_count === 1 ? "" : "s"}
          </Text>
        </View>
      </View>
    </>
  );

  const onPress = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push(`/listing/${listing.listing_id}`);
  };

  if (glass) {
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [{ width, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
        <Glass strong style={styles.glassCard}>
          {body}
        </Glass>
      </Pressable>
    );
  }
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.card, { width, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      {body}
    </Pressable>
  );
}

const useStyles = makeStyles((colors, r) => ({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  glassCard: { borderRadius: radius.lg },
  imageWrap: { height: 170, position: "relative" },
  imageWrapCompact: { height: 120 },
  image: { width: "100%", height: "100%" },
  noPhoto: { backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  typePill: {
    position: "absolute",
    left: spacing.md,
    top: spacing.md,
    backgroundColor: colors.glassStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 26,
    justifyContent: "center",
  },
  typeText: { fontFamily: fonts.family, fontSize: r.ms(11), fontWeight: "800", color: colors.onSurface, textTransform: "capitalize" },
  ratingPill: {
    position: "absolute",
    right: spacing.md,
    top: spacing.md,
    backgroundColor: colors.accentLemon,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    height: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "800", color: colors.onAccentLemon },
  heart: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.glassStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  distancePill: {
    position: "absolute",
    left: spacing.md,
    bottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    height: 24,
  },
  distanceText: { fontFamily: fonts.family, fontSize: r.ms(11), fontWeight: "800", color: colors.onSurfaceInverse },
  body: { padding: spacing.md, gap: 6 },
  title: { fontFamily: fonts.family, fontSize: r.ms(16), fontWeight: "800", color: colors.onSurface },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  loc: { fontFamily: fonts.family, fontSize: r.ms(13), color: colors.muted, flex: 1 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  meta: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.muted, fontWeight: "600" },
}));
