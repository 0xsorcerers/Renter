import React, { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { api, fileUrl, type Listing, type Offer, type Review } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { PriceTag } from "@/src/components/price-tag";
import { Glass } from "@/src/components/glass";
import { AppMap } from "@/src/components/app-map";
import { Avatar, Button, EmptyState, IconButton, RoleBadge, SectionTitle } from "@/src/components/ui";
import { ContactButtons } from "@/src/components/contact-buttons";
import { ReviewCard, Stars } from "@/src/components/reviews";
import { useToast } from "@/src/components/toast";
import { formatPrice, PERIOD_LABEL, PERIOD_TITLE } from "@/src/currency";

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [photoIdx, setPhotoIdx] = useState(0);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMsg, setOfferMsg] = useState("");
  const [showOffer, setShowOffer] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  const listing = useQuery({ queryKey: ["listing", id], queryFn: () => api<Listing>(`/listings/${id}`) });
  const offers = useQuery({ queryKey: ["offers", id], queryFn: () => api<Offer[]>(`/listings/${id}/offers`) });
  const reviews = useQuery({ queryKey: ["reviews", "listing", id], queryFn: () => api<Review[]>(`/reviews?listing_id=${id}`) });

  const makeOffer = useMutation({
    mutationFn: () => api(`/listings/${id}/offers`, { method: "POST", body: { amount: Number(offerAmount.replace(/[^\d.]/g, "")), message: offerMsg } }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setOfferAmount("");
      setOfferMsg("");
      setShowOffer(false);
      qc.invalidateQueries({ queryKey: ["offers"] });
      qc.invalidateQueries({ queryKey: ["listing", id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.show("Offer posted beneath the listing", "success");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const postReview = useMutation({
    mutationFn: () => api(`/listings/${id}/reviews`, { method: "POST", body: { rating, text: reviewText } }),
    onSuccess: () => {
      setReviewText("");
      setShowReview(false);
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["listing", id] });
      toast.show("Review posted", "success");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const removeListing = useMutation({
    mutationFn: () => api(`/listings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.show("Listing removed", "success");
      router.back();
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  if (listing.isLoading) {
    return (
      <View style={[styles.root, styles.center]} testID="listing-loading">
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }
  if (listing.isError || !listing.data) {
    return (
      <View style={[styles.root, styles.center, { padding: spacing.xl, gap: spacing.lg }]}>
        <EmptyState icon="alert-circle-outline" title="Error loading property" />
        <Button title="Go back" variant="ghost" onPress={() => router.back()} testID="listing-error-back" />
      </View>
    );
  }
  const l = listing.data;
  const isTenant = user?.role === "tenant";
  const isOwner = l.is_mine;
  const photos = l.photos?.length ? l.photos : [];
  const heroH = Math.min(width * 0.85, 420);
  const barHeight = 84 + insets.bottom;

  return (
    <View style={styles.root} testID="listing-detail-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: barHeight + spacing.xl }} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { height: heroH }]}>
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
            >
              {photos.map((p, i) => (
                <Image key={i} source={{ uri: fileUrl(p) }} style={{ width, height: heroH }} contentFit="cover" transition={200} testID={`listing-photo-${i}`} />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.noPhoto, { height: heroH }]}>
              <Ionicons name="home-outline" size={48} color={colors.muted} />
            </View>
          )}
          <LinearGradient colors={["transparent", colors.scrim]} style={styles.scrim} pointerEvents="none" />
          <LinearGradient colors={[colors.scrim, "transparent"]} style={styles.scrimTop} pointerEvents="none" />
          <View style={[styles.heroTopRow, { top: insets.top + spacing.sm }]}>
            <IconButton testID="listing-back-button" icon="chevron-back" onPress={() => router.back()} bg={colors.glassStrong} />
            {isOwner && <IconButton testID="listing-delete-button" icon="trash-outline" onPress={() => removeListing.mutate()} bg={colors.glassStrong} color={colors.error} />}
          </View>
          {photos.length > 1 && (
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === photoIdx && styles.dotActive]} />
              ))}
            </View>
          )}
          <View style={styles.heroBottom}>
            <View style={styles.typePill}>
              <Text style={styles.typeText}>{l.property_type}</Text>
            </View>
            <Text style={styles.heroTitle} testID="listing-title">
              {l.title}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.priceCard} testID="listing-price-card">
            <Text style={styles.priceLabel}>{PERIOD_TITLE[l.period]} rent · {l.currency}</Text>
            <PriceTag amount={l.price} symbol={l.currency_symbol} currency={l.currency} period={l.period} size="lg" testID="listing-price" />
            <Text style={styles.priceHint}>
              All offers on this home are {PERIOD_LABEL[l.period]} in {l.currency}.
            </Text>
          </View>

          <View style={styles.facts}>
            <Fact icon="bed-outline" label={`${l.bedrooms} bed`} />
            <Fact icon="water-outline" label={`${l.bathrooms} bath`} />
            <Fact icon="chatbubbles-outline" label={`${l.offers_count} offers`} />
            {l.rating != null && <Fact icon="star" label={`${l.rating} (${l.reviews_count})`} />}
          </View>

          <View style={styles.addrRow}>
            <Ionicons name="location" size={18} color={colors.brandPrimary} />
            <Text style={styles.addr} testID="listing-address">
              {l.address}
            </Text>
          </View>
          <AppMap
            pins={[{ id: l.listing_id, lat: l.lat, lng: l.lng, label: formatPrice(l.price, l.currency_symbol, l.currency), selected: true }]}
            center={{ lat: l.lat, lng: l.lng }}
            zoomDelta={0.02}
            interactive={false}
            style={styles.miniMap}
            testID="listing-mini-map"
          />
          <Pressable
            testID="listing-open-maps-button"
            onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`)}
            style={styles.mapsLink}
          >
            <Ionicons name="navigate" size={14} color={colors.brandPrimary} />
            <Text style={styles.mapsLinkText}>Open in Google Maps</Text>
          </Pressable>

          {l.description ? (
            <View>
              <SectionTitle title="About this home" />
              <Text style={styles.desc} testID="listing-description">
                {l.description}
              </Text>
            </View>
          ) : null}

          {l.owner && (
            <Pressable testID="listing-owner-card" onPress={() => router.push(`/user/${l.owner!.user_id}`)} style={styles.ownerCard}>
              <Avatar uri={l.owner.picture} name={l.owner.name} size={52} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.ownerName}>{l.owner.name}</Text>
                <RoleBadge role={l.owner.role} />
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          )}

          <View>
            <SectionTitle
              title={`Tenant offers (${offers.data?.length ?? 0})`}
              right={
                isTenant ? (
                  <Button testID="open-offer-form-button" title={showOffer ? "Close" : "Make offer"} small variant="secondary" onPress={() => setShowOffer((s) => !s)} />
                ) : undefined
              }
            />
            {showOffer && isTenant && (
              <View style={styles.formCard} testID="offer-form">
                <Text style={styles.formHint}>
                  Your offer is {PERIOD_LABEL[l.period]} in {l.currency} — same terms as the listing.
                </Text>
                <View style={styles.amountRow}>
                  <Text style={styles.amountSymbol}>{l.currency_symbol}</Text>
                  <TextInput
                    testID="offer-amount-input"
                    value={offerAmount}
                    onChangeText={setOfferAmount}
                    keyboardType="numeric"
                    placeholder={String(l.price)}
                    placeholderTextColor={colors.muted}
                    style={styles.amountInput}
                  />
                  <View style={styles.periodBadge}>
                    <Text style={styles.periodBadgeText}>{PERIOD_LABEL[l.period].toUpperCase()}</Text>
                  </View>
                </View>
                <TextInput
                  testID="offer-message-input"
                  value={offerMsg}
                  onChangeText={setOfferMsg}
                  placeholder="Add a short note (move-in date, who you are…)"
                  placeholderTextColor={colors.muted}
                  style={styles.msgInput}
                  multiline
                />
                <Button testID="offer-submit-button" title="Post offer" loading={makeOffer.isPending} disabled={!offerAmount} onPress={() => makeOffer.mutate()} />
              </View>
            )}
            <View style={{ gap: spacing.sm }}>
              {(offers.data ?? []).length === 0 && !showOffer && (
                <Text style={styles.emptyLine}>No offers yet{isTenant ? " — be the first." : "."}</Text>
              )}
              {(offers.data ?? []).map((o) => (
                <View key={o.offer_id} style={styles.offerBubble} testID={`offer-${o.offer_id}`}>
                  <Pressable onPress={() => o.tenant && router.push(`/user/${o.tenant.user_id}`)} style={styles.offerHead}>
                    <Avatar uri={o.tenant?.picture} name={o.tenant?.name} size={34} />
                    <Text style={styles.offerName}>{o.tenant?.name ?? "Tenant"}</Text>
                  </Pressable>
                  <PriceTag amount={o.amount} symbol={o.currency_symbol} currency={o.currency} period={o.period} size="sm" />
                  {o.message ? <Text style={styles.offerMsg}>{o.message}</Text> : null}
                  {isOwner && o.tenant && <ContactButtons phone={o.tenant.phone} whatsapp={o.tenant.whatsapp} small message={`Hi ${o.tenant.name}, about your offer on "${l.title}"`} />}
                </View>
              ))}
            </View>
          </View>

          <View>
            <SectionTitle
              title={`Reviews (${reviews.data?.length ?? 0})`}
              right={isTenant ? <Button testID="open-review-form-button" title={showReview ? "Close" : "Write review"} small variant="secondary" onPress={() => setShowReview((s) => !s)} /> : undefined}
            />
            {showReview && isTenant && (
              <View style={styles.formCard} testID="review-form">
                <Stars rating={rating} size={26} onChange={setRating} testID="review-stars" />
                <TextInput
                  testID="review-text-input"
                  value={reviewText}
                  onChangeText={setReviewText}
                  placeholder="How was your experience with this place or homeowner?"
                  placeholderTextColor={colors.muted}
                  style={styles.msgInput}
                  multiline
                />
                <Button testID="review-submit-button" title="Post review" loading={postReview.isPending} disabled={!reviewText.trim()} onPress={() => postReview.mutate()} />
              </View>
            )}
            <View style={{ gap: spacing.md }}>
              {(reviews.data ?? []).length === 0 && !showReview && <Text style={styles.emptyLine}>No reviews yet.</Text>}
              {(reviews.data ?? []).map((r) => (
                <ReviewCard key={r.review_id} review={r} />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <KeyboardAvoidingView behavior="padding" style={styles.stickyWrap} pointerEvents="box-none">
        <Glass strong style={styles.sticky} testID="listing-sticky-bar">
          <View style={[styles.stickyInner, { paddingBottom: insets.bottom + spacing.sm }]}>
            <View style={{ flex: 1 }}>
              <PriceTag amount={l.price} symbol={l.currency_symbol} currency={l.currency} period={l.period} size="sm" />
            </View>
            {isOwner ? (
              <Button title="Your listing" small variant="ghost" disabled />
            ) : (
              <ContactButtons phone={l.owner?.phone} whatsapp={l.owner?.whatsapp} small style={{ flex: 1.4 }} message={`Hi ${l.owner?.name ?? ""}, I'm interested in "${l.title}" on Renter.`} />
            )}
          </View>
        </Glass>
      </KeyboardAvoidingView>
    </View>
  );
}

function Fact({ icon, label }: { icon: any; label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={16} color={colors.onSurface} />
      <Text style={styles.factText}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  hero: { position: "relative", backgroundColor: colors.surfaceTertiary },
  noPhoto: { alignItems: "center", justifyContent: "center" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  scrimTop: { position: "absolute", left: 0, right: 0, top: 0, height: 110 },
  heroTopRow: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between" },
  dots: { position: "absolute", top: spacing.lg + 54, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.glassBorder },
  dotActive: { backgroundColor: colors.brandSecondary, width: 18 },
  heroBottom: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: spacing.sm },
  typePill: { alignSelf: "flex-start", backgroundColor: colors.brandSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 26, justifyContent: "center" },
  typeText: { fontFamily: fonts.family, fontSize: 11, fontWeight: "800", color: colors.onBrandSecondary, textTransform: "capitalize" },
  heroTitle: { fontFamily: fonts.family, fontSize: 26, fontWeight: "800", color: colors.onSurfaceInverse, letterSpacing: -0.5 },
  body: { padding: spacing.lg, gap: spacing.xl },
  priceCard: { backgroundColor: colors.brandTertiary, borderRadius: radius.lg, padding: spacing.lg, gap: 6 },
  priceLabel: { fontFamily: fonts.family, fontSize: 12, fontWeight: "800", color: colors.onBrandTertiary, textTransform: "uppercase", letterSpacing: 1 },
  priceHint: { fontFamily: fonts.family, fontSize: 12, color: colors.onBrandTertiary, fontWeight: "600" },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  fact: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 34, borderWidth: 1, borderColor: colors.border },
  factText: { fontFamily: fonts.family, fontSize: 13, fontWeight: "700", color: colors.onSurface },
  addrRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  addr: { flex: 1, fontFamily: fonts.family, fontSize: 15, color: colors.onSurfaceSecondary, fontWeight: "600" },
  miniMap: { height: 180, borderRadius: radius.lg, marginTop: -spacing.md },
  mapsLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: -spacing.md },
  mapsLinkText: { fontFamily: fonts.family, fontSize: 13, fontWeight: "800", color: colors.brandPrimary },
  desc: { fontFamily: fonts.family, fontSize: 15, color: colors.onSurfaceSecondary, lineHeight: 23 },
  ownerCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  ownerName: { fontFamily: fonts.family, fontSize: 16, fontWeight: "800", color: colors.onSurface },
  formCard: { backgroundColor: colors.accentLemon, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, marginBottom: spacing.md },
  formHint: { fontFamily: fonts.family, fontSize: 12, fontWeight: "700", color: colors.onAccentLemon },
  amountRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 56 },
  amountSymbol: { fontFamily: fonts.family, fontSize: 20, fontWeight: "800", color: colors.onSurface },
  amountInput: { flex: 1, fontFamily: fonts.family, fontSize: 20, fontWeight: "800", color: colors.onSurface, height: 56 },
  periodBadge: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, height: 22, justifyContent: "center" },
  periodBadgeText: { fontFamily: fonts.family, fontSize: 10, fontWeight: "800", color: colors.onBrandPrimary, letterSpacing: 0.6 },
  msgInput: { fontFamily: fonts.family, fontSize: 14, color: colors.onSurface, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, minHeight: 70 },
  emptyLine: { fontFamily: fonts.family, fontSize: 14, color: colors.muted },
  offerBubble: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderTopLeftRadius: radius.sm, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  offerHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  offerName: { fontFamily: fonts.family, fontSize: 14, fontWeight: "800", color: colors.onSurface },
  offerMsg: { fontFamily: fonts.family, fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 20 },
  stickyWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sticky: { borderTopLeftRadius: radius.lg + 4, borderTopRightRadius: radius.lg + 4, borderBottomWidth: 0 },
  stickyInner: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
}));
