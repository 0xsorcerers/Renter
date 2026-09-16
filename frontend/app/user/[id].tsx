import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { api, type Listing, type Review, type User } from "@/src/api";
import { Avatar, EmptyState, IconButton, RoleBadge, SectionTitle } from "@/src/components/ui";
import { ContactButtons } from "@/src/components/contact-buttons";
import { ReviewCard } from "@/src/components/reviews";
import { ListingCard } from "@/src/components/listing-card";

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const user = useQuery({ queryKey: ["user", id], queryFn: () => api<User>(`/users/${id}`) });
  const listings = useQuery({ queryKey: ["listings", "owner", id], queryFn: () => api<Listing[]>(`/listings?owner_id=${id}`), enabled: user.data?.role === "homeowner" });
  const reviews = useQuery({ queryKey: ["reviews", "user", id], queryFn: () => api<Review[]>(`/reviews?user_id=${id}`), enabled: user.data?.role === "homeowner" });

  if (user.isLoading) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }
  if (!user.data) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center", padding: spacing.xl }]}>
        <EmptyState icon="person-outline" title="User not found" />
      </View>
    );
  }
  const u = user.data;
  const isOwner = u.role === "homeowner";

  return (
    <View style={styles.root} testID="public-profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <LinearGradient colors={isOwner ? [colors.accentLemon, colors.accentMint, colors.surface] : [colors.accentMint, colors.accentPink, colors.surface]} style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.heroTop}>
            <IconButton testID="public-profile-back" icon="chevron-back" onPress={() => router.back()} bg={colors.glassStrong} />
          </View>
          <View style={styles.avatarWrap}>
            <Avatar uri={u.picture} name={u.name} size={100} />
          </View>
          <Text style={styles.name} testID="public-profile-name">
            {u.name}
          </Text>
          <RoleBadge role={u.role} />
          {(u.city || u.country) && (
            <Text style={styles.loc}>
              <Ionicons name="location" size={13} color={colors.muted} /> {[u.city, u.country].filter(Boolean).join(", ")}
            </Text>
          )}
          <View style={styles.statsRow}>
            {isOwner && <Stat value={String(u.stats?.listings ?? 0)} label="Listings" />}
            <Stat value={String(u.stats?.reviews ?? 0)} label="Reviews" />
            <Stat value={u.stats?.rating != null ? `${u.stats.rating} ★` : "—"} label="Rating" />
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>About</Text>
            <Text style={styles.bio} testID="public-profile-bio">
              {u.bio || "No bio yet."}
            </Text>
          </View>
          <ContactButtons phone={u.phone} whatsapp={u.whatsapp} message={`Hi ${u.name}, I found you on Renter.`} />

          {isOwner && (
            <View style={{ gap: spacing.md }}>
              <SectionTitle title="Homes listed" />
              {(listings.data ?? []).length === 0 ? (
                <Text style={styles.emptyLine}>No active listings.</Text>
              ) : (
                listings.data!.map((l) => <ListingCard key={l.listing_id} listing={l} testID={`owner-listing-${l.listing_id}`} />)
              )}
            </View>
          )}

          {isOwner && (
            <View style={{ gap: spacing.md }}>
              <SectionTitle title="Tenant reviews" />
              {(reviews.data ?? []).length === 0 ? (
                <EmptyState icon="chatbubble-ellipses-outline" title="No reviews yet" subtitle="Reviews from tenants will appear here." />
              ) : (
                reviews.data!.map((r) => <ReviewCard key={r.review_id} review={r} showListing />)
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors, r) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, alignItems: "center", gap: spacing.sm },
  heroTop: { alignSelf: "stretch", flexDirection: "row", marginBottom: spacing.sm },
  avatarWrap: { padding: 4, borderRadius: 60, backgroundColor: colors.surface },
  name: { fontFamily: fonts.family, fontSize: r.ms(26), fontWeight: "800", color: colors.onSurface },
  loc: { fontFamily: fonts.family, fontSize: r.ms(13), color: colors.muted },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md, alignSelf: "stretch" },
  stat: { flex: 1, backgroundColor: colors.glassStrong, borderRadius: radius.lg, padding: spacing.md, alignItems: "center" },
  statValue: { fontFamily: fonts.family, fontSize: r.ms(18), fontWeight: "800", color: colors.onSurface },
  statLabel: { fontFamily: fonts.family, fontSize: r.ms(11), color: colors.muted, fontWeight: "700", textTransform: "uppercase" },
  body: { padding: spacing.lg, gap: spacing.lg, width: "100%", maxWidth: r.contentMaxWidth, alignSelf: "center" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardLabel: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "800", color: colors.brandPrimary, textTransform: "uppercase", letterSpacing: 1 },
  bio: { fontFamily: fonts.family, fontSize: r.ms(15), color: colors.onSurfaceSecondary, lineHeight: r.ms(22) },
  emptyLine: { fontFamily: fonts.family, fontSize: r.ms(14), color: colors.muted },
}));
