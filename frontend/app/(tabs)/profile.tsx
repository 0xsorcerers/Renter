import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { api, type Review, type User } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { useTabBottomChrome } from "@/src/use-tab-bottom";
import { Avatar, Button, EmptyState, RoleBadge, SectionTitle } from "@/src/components/ui";
import { ReviewCard } from "@/src/components/reviews";

export default function Profile() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = useTabBottomChrome();
  const router = useRouter();
  const { user, logout } = useAuth();

  const profile = useQuery({
    queryKey: ["user", user?.user_id],
    queryFn: () => api<User>(`/users/${user!.user_id}`),
    enabled: !!user,
  });
  const reviews = useQuery({
    queryKey: ["reviews", "user", user?.user_id],
    queryFn: () => api<Review[]>(`/reviews?user_id=${user!.user_id}`),
    enabled: !!user && user.role === "homeowner",
  });

  if (!user) return null;
  const stats = profile.data?.stats;

  return (
    <View style={styles.root} testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }}>
        <LinearGradient colors={[colors.accentLemon, colors.accentMint, colors.surface]} style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.heroTop}>
            <Text style={styles.heroTitle}>My profile</Text>
            <Button testID="profile-edit-button" title="Edit" icon="create-outline" variant="dark" small onPress={() => router.push("/profile/edit")} />
          </View>
          <View style={styles.avatarWrap}>
            <Avatar uri={user.picture} name={user.name} size={96} testID="profile-avatar" />
          </View>
          <Text style={styles.name} testID="profile-name">
            {user.name}
          </Text>
          <RoleBadge role={user.role} />
          {(user.city || user.country) && (
            <Text style={styles.loc}>
              <Ionicons name="location" size={13} color={colors.muted} /> {[user.city, user.country].filter(Boolean).join(", ")}
            </Text>
          )}
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.statsRow}>
            <Stat label={user.role === "homeowner" ? "Listings" : "Role"} value={user.role === "homeowner" ? String(stats?.listings ?? 0) : "Tenant"} />
            <Stat label="Reviews" value={String(stats?.reviews ?? 0)} />
            <Stat label="Rating" value={stats?.rating != null ? `${stats.rating} ★` : "—"} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>About me</Text>
            <Text style={styles.bio} testID="profile-bio">
              {user.bio || "No bio yet. Tap Edit to tell people about yourself."}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Contact</Text>
            <Row icon="call" label="Phone" value={user.phone || "Not set"} testID="profile-phone" />
            <Row icon="logo-whatsapp" label="WhatsApp" value={user.whatsapp || "Not set"} testID="profile-whatsapp" />
            <Row icon="mail" label="Email" value={user.email ?? ""} testID="profile-email" />
          </View>

          {user.role === "homeowner" && (
            <View style={{ gap: spacing.md }}>
              <SectionTitle title="Reviews from tenants" />
              {(reviews.data ?? []).length === 0 ? (
                <EmptyState icon="chatbubble-ellipses-outline" title="No reviews yet" subtitle="Tenants can review your homes after viewing them." />
              ) : (
                reviews.data!.map((r) => <ReviewCard key={r.review_id} review={r} showListing />)
              )}
            </View>
          )}

          <Button testID="profile-logout-button" title="Log out" icon="log-out-outline" variant="ghost" onPress={logout} />
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ icon, label, value, testID }: { icon: any; label: string; value: string; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={colors.onBrandTertiary} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} testID={testID} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, alignItems: "center", gap: spacing.sm },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", alignSelf: "stretch", marginBottom: spacing.md },
  heroTitle: { fontFamily: fonts.family, fontSize: 24, fontWeight: "800", color: colors.onSurface },
  avatarWrap: { padding: 4, borderRadius: 60, backgroundColor: colors.surface },
  name: { fontFamily: fonts.family, fontSize: 24, fontWeight: "800", color: colors.onSurface },
  loc: { fontFamily: fonts.family, fontSize: 13, color: colors.muted },
  body: { padding: spacing.lg, gap: spacing.lg },
  statsRow: { flexDirection: "row", gap: spacing.md },
  stat: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  statValue: { fontFamily: fonts.family, fontSize: 18, fontWeight: "800", color: colors.onSurface },
  statLabel: { fontFamily: fonts.family, fontSize: 11, color: colors.muted, fontWeight: "700", textTransform: "uppercase" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardLabel: { fontFamily: fonts.family, fontSize: 12, fontWeight: "800", color: colors.brandPrimary, textTransform: "uppercase", letterSpacing: 1 },
  bio: { fontFamily: fonts.family, fontSize: 15, color: colors.onSurfaceSecondary, lineHeight: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 36 },
  rowIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontFamily: fonts.family, fontSize: 14, color: colors.muted, width: 78 },
  rowValue: { flex: 1, fontFamily: fonts.family, fontSize: 14, fontWeight: "700", color: colors.onSurface },
}));
