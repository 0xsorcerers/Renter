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
import { api, fileUrl, type Agreement, type Conversation, type FeeCharge, type Listing, type Offer, type OfferStatus, type Residence, type Review } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { useFavorite } from "@/src/use-favorite";
import { OfferStatusBadge } from "@/src/components/offer-status";
import { shareListing } from "@/src/share";
import { VideoTour } from "@/src/components/video-tour";
import { LineArt } from "@/src/components/line-art";
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
  const [selResId, setSelResId] = useState<string | null>(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMsg, setOfferMsg] = useState("");
  const [showOffer, setShowOffer] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  const listing = useQuery({ queryKey: ["listing", id], queryFn: () => api<Listing>(`/listings/${id}`) });
  const offers = useQuery({ queryKey: ["offers", id], queryFn: () => api<Offer[]>(`/listings/${id}/offers`), refetchInterval: 15000 });
  const reviews = useQuery({ queryKey: ["reviews", "listing", id], queryFn: () => api<Review[]>(`/reviews?listing_id=${id}`) });
  const agreements = useQuery({
    queryKey: ["agreements", "listing", id],
    queryFn: () => api<Agreement[]>(`/listings/${id}/agreements`),
    enabled: !!user,
  });
  const favorite = useFavorite();

  const respond = useMutation({
    mutationFn: (vars: { offerId: string; status: OfferStatus }) => api(`/offers/${vars.offerId}`, { method: "PATCH", body: { status: vars.status } }),
    onSuccess: (_d, vars) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["offers"] });
      toast.show(vars.status === "accepted" ? "Offer accepted — reach out to the tenant!" : "Offer declined", vars.status === "accepted" ? "success" : "info");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const makeOffer = useMutation({
    mutationFn: (residenceId: string) =>
      api(`/listings/${id}/offers`, { method: "POST", body: { amount: Number(offerAmount.replace(/[^\d.]/g, "")), message: offerMsg, residence_id: residenceId } }),
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

  const setStatus = useMutation({
    mutationFn: (vars: { residenceId: string; status: "rented" | "available" }) =>
      api<Listing>(`/listings/${id}/residences/${vars.residenceId}/status`, { method: "POST", body: { status: vars.status } }),
    onSuccess: (_d, vars) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["listing", id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["offers"] });
      toast.show(vars.status === "rented" ? "Marked as rented" : "Residence is available again", "success");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const openChat = useMutation({
    mutationFn: (tenantId?: string) => api<Conversation>("/conversations", { method: "POST", body: { listing_id: id, tenant_id: tenantId } }),
    onSuccess: (c) => router.push(`/chat/${c.conversation_id}`),
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const onShare = async () => {
    try {
      await shareListing(listing.data!);
    } catch (e: any) {
      toast.show(e?.message ?? "Could not share", "error");
    }
  };

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
  const residences = l.residences ?? [];
  const res: Residence | null = residences.find((r) => r.residence_id === selResId) ?? residences[0] ?? null;
  const resStatus = res?.status ?? "available";
  const isRented = resStatus === "rented" || l.status === "rented";
  const isActive = resStatus === "active";
  const resOffers = (offers.data ?? []).filter((o) => !o.residence_id || !res || o.residence_id === res.residence_id);
  const resAgreement = (agreements.data ?? []).find((a) => a.residence_id === res?.residence_id) ?? null;
  const myAccepted = resOffers.find((o) => o.tenant_id === user?.user_id && o.status === "accepted");
  const heroH = Math.min(width * 0.85, 420);
  const barHeight = 84 + insets.bottom;

  if (!res) {
    return (
      <View style={[styles.root, styles.center, { padding: spacing.xl, gap: spacing.lg }]} testID="listing-no-units">
        <EmptyState icon="business-outline" title="No residences available" subtitle="Every unit in this structure is currently occupied. Check back later." />
        <Button title="Go back" variant="ghost" onPress={() => router.back()} testID="listing-no-units-back" />
      </View>
    );
  }

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
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <IconButton testID="listing-share-button" icon="share-social-outline" onPress={onShare} bg={colors.glassStrong} />
              {!isOwner && (
                <IconButton
                  testID="listing-favorite-button"
                  icon={l.is_favorited ? "heart" : "heart-outline"}
                  color={l.is_favorited ? colors.error : colors.onSurface}
                  onPress={() => favorite.mutate({ listingId: l.listing_id, next: !l.is_favorited })}
                  bg={colors.glassStrong}
                />
              )}
              {isOwner && <IconButton testID="listing-delete-button" icon="trash-outline" onPress={() => removeListing.mutate()} bg={colors.glassStrong} color={colors.error} />}
            </View>
          </View>
          {photos.length > 1 && (
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === photoIdx && styles.dotActive]} />
              ))}
            </View>
          )}
          <View style={styles.heroBottom}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={styles.typePill}>
                <Text style={styles.typeText}>{l.property_type}</Text>
              </View>
              {isRented && (
                <View style={styles.rentedPill} testID="listing-rented-pill">
                  <Ionicons name="checkmark-done" size={12} color={colors.onSurfaceInverse} />
                  <Text style={styles.rentedPillText}>RENTED</Text>
                </View>
              )}
            </View>
            <Text style={styles.heroTitle} testID="listing-title">
              {l.title}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {residences.length > 1 && (
            <View style={{ gap: spacing.sm }} testID="residence-selector">
              <SectionTitle title={`Residences (${residences.length})`} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {residences.map((r) => {
                  const selected = r.residence_id === res.residence_id;
                  const statusColor = r.status === "available" ? colors.success : r.status === "active" ? colors.brandPrimary : colors.muted;
                  return (
                    <Pressable
                      key={r.residence_id}
                      testID={`residence-chip-${r.residence_id}`}
                      onPress={() => {
                        setSelResId(r.residence_id);
                        setShowOffer(false);
                        Haptics.selectionAsync().catch(() => {});
                      }}
                      style={[styles.resChip, selected && styles.resChipActive]}
                    >
                      <Text style={[styles.resChipLabel, selected && styles.resChipLabelActive]} numberOfLines={1}>
                        {r.label}
                      </Text>
                      <Text style={[styles.resChipMeta, selected && { color: colors.onBrandPrimary }]} numberOfLines={1}>
                        {r.bedrooms}bd · {r.bathrooms}ba · {formatPrice(r.price, l.currency_symbol, l.currency)} {PERIOD_LABEL[r.period]}
                      </Text>
                      <View style={[styles.resStatusDot, { backgroundColor: statusColor }]} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {isActive && (
            <View style={styles.activeCard} testID="listing-active-banner">
              <Ionicons name="key" size={22} color={colors.onBrandPrimary} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.activeTitle}>Active tenancy</Text>
                <Text style={styles.activeSub}>
                  {resAgreement?.ends_at ? `Occupied until ${new Date(resAgreement.ends_at).toLocaleDateString()}. ` : ""}
                  This residence is under a signed license agreement and is hidden from other tenants.
                </Text>
                {resAgreement && (
                  <Button testID="listing-view-agreement-button" title="View agreement" icon="document-text" small variant="secondary" onPress={() => router.push({ pathname: "/agreement/[id]", params: { id: resAgreement.agreement_id } })} style={{ alignSelf: "flex-start", marginTop: spacing.xs }} />
                )}
              </View>
            </View>
          )}

          {isRented && !isActive && (
            <View style={styles.rentedCard} testID="listing-rented-banner">
              <LineArt name="rented" opacity={0.5} fade={false} align="center" style={{ left: "55%" }} />
              <View style={{ gap: 4, maxWidth: "60%" }}>
                <Text style={styles.rentedTitle}>This residence has been rented</Text>
                <Text style={styles.rentedSub}>{isOwner ? "It's hidden from Explore and pending offers were closed." : "Keep exploring — new homes are posted every day."}</Text>
                {isOwner && (
                  <Button testID="listing-relist-button" title="Make available again" small variant="ghost" loading={setStatus.isPending} onPress={() => setStatus.mutate({ residenceId: res.residence_id, status: "available" })} style={{ alignSelf: "flex-start", marginTop: spacing.sm }} />
                )}
              </View>
            </View>
          )}
          {isOwner && !isRented && resStatus === "available" && (
            <Button testID="listing-mark-rented-button" title={`Mark "${res.label}" as rented`} icon="checkmark-done" variant="dark" loading={setStatus.isPending} onPress={() => setStatus.mutate({ residenceId: res.residence_id, status: "rented" })} />
          )}
          <View style={styles.priceCard} testID="listing-price-card">
            <Text style={styles.priceLabel}>
              {PERIOD_TITLE[res.period]} rent{residences.length > 1 ? ` · ${res.label}` : ""} · {l.currency}
            </Text>
            <PriceTag amount={res.price} symbol={l.currency_symbol} currency={l.currency} period={res.period} size="lg" testID="listing-price" />
            <Text style={styles.priceHint}>
              All offers on this residence are {PERIOD_LABEL[res.period]} in {l.currency} · {res.tenure_months}-month tenure.
            </Text>
          </View>

          {/* Fees & charges */}
          {(res.fees ?? []).length > 0 && (
            <View style={{ gap: spacing.sm }} testID="listing-fees-section">
              <SectionTitle title="Fees & charges" />
              <View style={styles.feeList}>
                {res.fees.map((f: FeeCharge) => (
                  <View key={f.fee_id} style={styles.feeRow} testID={`fee-row-${f.fee_id}`}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <Text style={styles.feeName}>{f.label}</Text>
                        {f.key === "app_fee" ? (
                          <View style={styles.feeTag}><Text style={styles.feeTagText}>Required</Text></View>
                        ) : f.negotiable ? (
                          <View style={[styles.feeTag, styles.feeTagNeg]}><Text style={[styles.feeTagText, { color: colors.brandPrimary }]}>Negotiable</Text></View>
                        ) : null}
                      </View>
                      {f.amenities?.length > 0 && <Text style={styles.feeAmenity}>Covers: {f.amenities.join(", ")}</Text>}
                      {f.note ? <Text style={styles.feeNote}>{f.note}</Text> : null}
                    </View>
                    <Text style={styles.feeAmount}>{formatPrice(f.amount ?? 0, l.currency_symbol, l.currency)}</Text>
                  </View>
                ))}
                <View style={[styles.feeRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.feeTotalLabel}>Total fees (move-in)</Text>
                  <Text style={styles.feeTotalAmount} testID="fees-total">
                    {formatPrice(res.fees_total ?? 0, l.currency_symbol, l.currency)}
                  </Text>
                </View>
              </View>
              <Text style={styles.feeHint}>
                Fees marked <Text style={{ fontWeight: "800" }}>Negotiable</Text> can be appealed — message the homeowner to ask for removal or a lower amount. The App Fee is compulsory.
              </Text>
            </View>
          )}

          <View style={styles.facts}>
            <Fact icon="bed-outline" label={`${res.bedrooms} bed`} />
            <Fact icon="water-outline" label={`${res.bathrooms} bath`} />
            <Fact icon="chatbubbles-outline" label={`${resOffers.length} offers`} />
            <Fact icon="time-outline" label={`${res.tenure_months} mo tenure`} />
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

          {l.video ? (
            <View style={{ gap: spacing.md }}>
              <SectionTitle title="Virtual tour" />
              <VideoTour uri={l.video} testID="listing-video-tour" />
            </View>
          ) : null}

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

          {/* Agreement status */}
          {resAgreement && (
            <View style={[styles.offerBubble, resAgreement.status === "active" ? styles.offerAccepted : {}]} testID="agreement-card">
              <View style={styles.offerHeadRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
                  <Ionicons name="document-text" size={18} color={colors.brandPrimary} />
                  <Text style={styles.offerName}>License agreement{residences.length > 1 ? ` · ${resAgreement.residence_label}` : ""}</Text>
                </View>
                <OfferStatusBadge
                  status={resAgreement.status === "active" ? "accepted" : resAgreement.status === "ended" ? "closed" : "pending"}
                  testID="agreement-status-badge"
                />
              </View>
              <Text style={styles.offerMsg}>
                {resAgreement.status === "pending"
                  ? "Both parties must sign and confirm payment before the tenancy activates."
                  : resAgreement.status === "active"
                    ? `Active until ${resAgreement.ends_at ? new Date(resAgreement.ends_at).toLocaleDateString() : "tenure end"}.`
                    : "This agreement has ended."}
              </Text>
              <AgreementChecklist ag={resAgreement} />
              <Button
                testID="agreement-open-button"
                title={resAgreement.status === "pending" ? "Review & sign agreement" : "View agreement"}
                icon="document-text-outline"
                small
                variant={resAgreement.status === "pending" ? "primary" : "secondary"}
                onPress={() => router.push({ pathname: "/agreement/[id]", params: { id: resAgreement.agreement_id } })}
              />
            </View>
          )}

          <View>
            <SectionTitle
              title={`Tenant offers (${resOffers.length})`}
              right={
                isTenant && !isRented && !isActive ? (
                  <Button testID="open-offer-form-button" title={showOffer ? "Close" : "Make offer"} small variant="secondary" onPress={() => setShowOffer((s) => !s)} />
                ) : undefined
              }
            />
            {showOffer && isTenant && !isRented && !isActive && res && (
              <View style={styles.formCard} testID="offer-form">
                <Text style={styles.formHint}>
                  Your offer is {PERIOD_LABEL[res.period]} in {l.currency} for “{res.label}”{residences.length > 1 ? ` — same terms as this residence` : " — same terms as the listing"}.
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
                <Button testID="offer-submit-button" title="Post offer" loading={makeOffer.isPending} disabled={!offerAmount} onPress={() => res && makeOffer.mutate(res.residence_id)} />
              </View>
            )}
            <View style={{ gap: spacing.sm }}>
              {resOffers.length === 0 && !showOffer && (
                <Text style={styles.emptyLine}>No offers yet{isTenant ? " — be the first." : "."}</Text>
              )}
              {resOffers.map((o) => (
                <View key={o.offer_id} style={[styles.offerBubble, o.status === "accepted" && styles.offerAccepted, o.status === "declined" && styles.offerDeclined]} testID={`offer-${o.offer_id}`}>
                  <View style={styles.offerHeadRow}>
                    <Pressable onPress={() => o.tenant && router.push(`/user/${o.tenant.user_id}`)} style={styles.offerHead}>
                      <Avatar uri={o.tenant?.picture} name={o.tenant?.name} size={34} />
                      <Text style={styles.offerName}>{o.tenant?.name ?? "Tenant"}</Text>
                    </Pressable>
                    <OfferStatusBadge status={o.status} testID={`offer-status-${o.offer_id}`} />
                  </View>
                  <PriceTag amount={o.amount} symbol={o.currency_symbol} currency={o.currency} period={o.period} size="sm" />
                  {o.residence_label && residences.length > 1 && <Text style={styles.offerMsg}>Unit: {o.residence_label}</Text>}
                  {o.message ? <Text style={styles.offerMsg}>{o.message}</Text> : null}
                  {isOwner && o.status === "pending" && (
                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <Button
                        testID={`offer-accept-${o.offer_id}`}
                        title="Accept"
                        icon="checkmark"
                        small
                        style={{ flex: 1 }}
                        loading={respond.isPending && respond.variables?.offerId === o.offer_id && respond.variables?.status === "accepted"}
                        onPress={() => respond.mutate({ offerId: o.offer_id, status: "accepted" })}
                      />
                      <Button
                        testID={`offer-decline-${o.offer_id}`}
                        title="Decline"
                        icon="close"
                        small
                        variant="ghost"
                        style={{ flex: 1 }}
                        loading={respond.isPending && respond.variables?.offerId === o.offer_id && respond.variables?.status === "declined"}
                        onPress={() => respond.mutate({ offerId: o.offer_id, status: "declined" })}
                      />
                    </View>
                  )}
                  {isOwner && o.tenant && (
                    <View style={{ gap: spacing.sm }}>
                      <Button
                        testID={`offer-message-${o.offer_id}`}
                        title={`Message ${o.tenant.name.split(" ")[0]}`}
                        icon="chatbubble-ellipses"
                        small
                        variant="secondary"
                        loading={openChat.isPending && openChat.variables === o.tenant_id}
                        onPress={() => openChat.mutate(o.tenant_id)}
                      />
                      <ContactButtons phone={o.tenant.phone} whatsapp={o.tenant.whatsapp} small message={`Hi ${o.tenant.name}, about your offer on "${l.title}"`} />
                    </View>
                  )}
                  {!isOwner && o.tenant_id === user?.user_id && o.status === "accepted" && (
                    <Button testID={`offer-chat-owner-${o.offer_id}`} title="Message homeowner" icon="chatbubble-ellipses" small loading={openChat.isPending} onPress={() => openChat.mutate(undefined)} />
                  )}
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
              <PriceTag amount={res.price} symbol={l.currency_symbol} currency={l.currency} period={res.period} size="sm" />
            </View>
            {isOwner ? (
              <Button testID="listing-owner-inbox-button" title="Inbox" icon="chatbubbles" small variant="secondary" onPress={() => router.push("/chat")} />
            ) : isRented || isActive ? (
              <Button title="Occupied" small variant="ghost" disabled />
            ) : myAccepted ? (
              <View style={{ flex: 1.4, flexDirection: "row", gap: spacing.sm }}>
                <Button testID="sticky-chat-button" title="Chat" icon="chatbubble-ellipses" small style={{ flex: 1 }} loading={openChat.isPending} onPress={() => openChat.mutate(undefined)} />
                <ContactButtons phone={l.owner?.phone} whatsapp={l.owner?.whatsapp} small style={{ flex: 1.6 }} message={`Hi ${l.owner?.name ?? ""}, I'm interested in "${l.title}" on Renter.`} />
              </View>
            ) : (
              <ContactButtons phone={l.owner?.phone} whatsapp={l.owner?.whatsapp} small style={{ flex: 1.4 }} message={`Hi ${l.owner?.name ?? ""}, I'm interested in "${l.title}" on Renter.`} />
            )}
          </View>
        </Glass>
      </KeyboardAvoidingView>
    </View>
  );
}

function AgreementChecklist({ ag }: { ag: Agreement }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const steps: { label: string; done: boolean; mine: boolean }[] = [
    { label: "Homeowner signed", done: !!ag.owner_signed, mine: ag.my_role === "owner" },
    { label: "Tenant signed", done: !!ag.tenant_signed, mine: ag.my_role === "tenant" },
    { label: "Homeowner confirmed payment", done: !!ag.owner_confirmed_payment, mine: ag.my_role === "owner" },
    { label: "Tenant confirmed payment", done: !!ag.tenant_confirmed_payment, mine: ag.my_role === "tenant" },
  ];
  return (
    <View style={{ gap: 4, marginVertical: spacing.xs }} testID="agreement-checklist">
      {steps.map((s) => (
        <View key={s.label} style={styles.checkRow}>
          <Ionicons name={s.done ? "checkmark-circle" : "ellipse-outline"} size={16} color={s.done ? colors.success : colors.muted} />
          <Text style={[styles.checkText, s.mine && !s.done && { color: colors.brandPrimary, fontWeight: "800" }]}>
            {s.label}
            {s.mine && !s.done ? " — your turn" : ""}
          </Text>
        </View>
      ))}
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

const useStyles = makeStyles((colors, r) => ({
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
  typeText: { fontFamily: fonts.family, fontSize: r.ms(11), fontWeight: "800", color: colors.onBrandSecondary, textTransform: "capitalize" },
  rentedPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surfaceInverse, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 26 },
  rentedPillText: { fontFamily: fonts.family, fontSize: r.ms(11), fontWeight: "800", color: colors.onSurfaceInverse, letterSpacing: 0.6 },
  rentedCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, position: "relative", overflow: "hidden", minHeight: 120, justifyContent: "center" },
  rentedTitle: { fontFamily: fonts.family, fontSize: r.ms(17), fontWeight: "800", color: colors.onSurface },
  rentedSub: { fontFamily: fonts.family, fontSize: r.ms(13), color: colors.muted, lineHeight: r.ms(18) },
  heroTitle: { fontFamily: fonts.family, fontSize: r.ms(26), fontWeight: "800", color: colors.onSurfaceInverse, letterSpacing: -0.5 },
  body: { padding: spacing.lg, gap: spacing.xl, width: "100%", maxWidth: r.contentMaxWidth, alignSelf: "center" },
  priceCard: { backgroundColor: colors.brandTertiary, borderRadius: radius.lg, padding: spacing.lg, gap: 6 },
  priceLabel: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "800", color: colors.onBrandTertiary, textTransform: "uppercase", letterSpacing: 1 },
  priceHint: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.onBrandTertiary, fontWeight: "600" },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  fact: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 34, borderWidth: 1, borderColor: colors.border },
  factText: { fontFamily: fonts.family, fontSize: r.ms(13), fontWeight: "700", color: colors.onSurface },
  addrRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  addr: { flex: 1, fontFamily: fonts.family, fontSize: r.ms(15), color: colors.onSurfaceSecondary, fontWeight: "600" },
  miniMap: { height: 180, borderRadius: radius.lg, marginTop: -spacing.md },
  mapsLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: -spacing.md },
  mapsLinkText: { fontFamily: fonts.family, fontSize: r.ms(13), fontWeight: "800", color: colors.brandPrimary },
  desc: { fontFamily: fonts.family, fontSize: r.ms(15), color: colors.onSurfaceSecondary, lineHeight: r.ms(23) },
  ownerCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  ownerName: { fontFamily: fonts.family, fontSize: r.ms(16), fontWeight: "800", color: colors.onSurface },
  formCard: { backgroundColor: colors.accentLemon, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, marginBottom: spacing.md },
  formHint: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "700", color: colors.onAccentLemon },
  amountRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 56 },
  amountSymbol: { fontFamily: fonts.family, fontSize: r.ms(20), fontWeight: "800", color: colors.onSurface },
  amountInput: { flex: 1, fontFamily: fonts.family, fontSize: r.ms(20), fontWeight: "800", color: colors.onSurface, height: 56 },
  periodBadge: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, height: 22, justifyContent: "center" },
  periodBadgeText: { fontFamily: fonts.family, fontSize: r.ms(10), fontWeight: "800", color: colors.onBrandPrimary, letterSpacing: 0.6 },
  msgInput: { fontFamily: fonts.family, fontSize: r.ms(14), color: colors.onSurface, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, minHeight: 70 },
  emptyLine: { fontFamily: fonts.family, fontSize: r.ms(14), color: colors.muted },
  offerBubble: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderTopLeftRadius: radius.sm, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  offerAccepted: { backgroundColor: colors.brandTertiary, borderColor: colors.brand },
  offerDeclined: { opacity: 0.7 },
  offerHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  offerHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  offerName: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "800", color: colors.onSurface },
  offerMsg: { fontFamily: fonts.family, fontSize: r.ms(14), color: colors.onSurfaceSecondary, lineHeight: r.ms(20) },
  resChip: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 2, minWidth: 150, position: "relative" },
  resChipActive: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  resChipLabel: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "800", color: colors.onSurface, maxWidth: 160 },
  resChipLabelActive: { color: colors.onSurfaceInverse },
  resChipMeta: { fontFamily: fonts.family, fontSize: r.ms(11), color: colors.muted, fontWeight: "600" },
  resStatusDot: { position: "absolute", top: spacing.sm, right: spacing.sm, width: 8, height: 8, borderRadius: 4 },
  activeCard: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.lg, padding: spacing.lg, alignItems: "flex-start" },
  activeTitle: { fontFamily: fonts.family, fontSize: r.ms(16), fontWeight: "800", color: colors.onBrandPrimary },
  activeSub: { fontFamily: fonts.family, fontSize: r.ms(13), color: colors.onBrandPrimary, lineHeight: r.ms(18) },
  feeList: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  feeRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  feeName: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "700", color: colors.onSurface },
  feeTag: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  feeTagNeg: { backgroundColor: colors.brandTertiary },
  feeTagText: { fontFamily: fonts.family, fontSize: r.ms(10), fontWeight: "800", color: colors.onSurfaceSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
  feeAmenity: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.brandPrimary, fontWeight: "600", marginTop: 2 },
  feeNote: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.muted, marginTop: 2 },
  feeAmount: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "800", color: colors.onSurface },
  feeTotalLabel: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "800", color: colors.onSurface },
  feeTotalAmount: { fontFamily: fonts.family, fontSize: r.ms(15), fontWeight: "800", color: colors.brandPrimary },
  feeHint: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.muted, lineHeight: r.ms(17) },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  checkText: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "600", color: colors.onSurfaceSecondary },
  stickyWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sticky: { borderTopLeftRadius: radius.lg + 4, borderTopRightRadius: radius.lg + 4, borderBottomWidth: 0 },
  stickyInner: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
}));
