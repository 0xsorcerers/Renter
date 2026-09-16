import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { api, fileUrl, uploadImage, uploadFile, type Currency, type Listing, type Period, type PlaceResult } from "@/src/api";
import { Button, Chip, Field, IconButton } from "@/src/components/ui";
import { Glass } from "@/src/components/glass";
import { VideoTour } from "@/src/components/video-tour";
import { LineArt } from "@/src/components/line-art";
import { useToast } from "@/src/components/toast";
import { AppMap } from "@/src/components/app-map";
import { PERIOD_LABEL, formatPrice } from "@/src/currency";

const TYPES = ["apartment", "house", "studio", "room", "loft", "duplex"];
const PERIODS: Period[] = ["week", "month", "year"];
const STICKY_H = 92;

export default function CreateListing() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [price, setPrice] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [propertyType, setPropertyType] = useState("apartment");
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [photos, setPhotos] = useState<string[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currencyOverride, setCurrencyOverride] = useState<Currency | null>(null);
  const [showCurrency, setShowCurrency] = useState(false);
  const [permissionHelp, setPermissionHelp] = useState(false);

  const currencies = useQuery({ queryKey: ["currencies"], queryFn: () => api<Currency[]>("/currencies") });
  const detected = place?.currency ?? null;
  const currency = currencyOverride ?? detected ?? { code: "USD", symbol: "$", name: "US Dollar" };

  // Debounced address search
  useEffect(() => {
    if (place && addressQuery === place.description) return;
    if (addressQuery.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await api<PlaceResult[]>(`/places/search?q=${encodeURIComponent(addressQuery.trim())}`));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [addressQuery, place]);

  const pickPhotos = async () => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      if (current.canAskAgain) {
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
        status = req.status;
      }
      if (status !== "granted") {
        setPermissionHelp(true);
        return;
      }
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.7, selectionLimit: 6 });
    if (res.canceled) return;
    setUploading(true);
    try {
      for (const a of res.assets) {
        const up = await uploadImage(a.uri, a.fileName ?? "photo.jpg", a.mimeType ?? "image/jpeg");
        setPhotos((p) => [...p, up.url]);
      }
      toast.show(`${res.assets.length} photo${res.assets.length > 1 ? "s" : ""} added`, "success");
    } catch (e: any) {
      toast.show(e.status === 402 ? "Storage credits exhausted" : e.message ?? "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const pickVideo = async () => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      if (current.canAskAgain) status = (await ImagePicker.requestMediaLibraryPermissionsAsync()).status;
      if (status !== "granted") return setPermissionHelp(true);
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], videoMaxDuration: 60, quality: 0.6 });
    if (res.canceled) return;
    const a = res.assets[0];
    if (a.duration && a.duration > 61000) return toast.show("Keep the tour under 60 seconds", "error");
    if (a.fileSize && a.fileSize > 50 * 1024 * 1024) return toast.show("Video must be under 50 MB", "error");
    setUploadingVideo(true);
    try {
      const up = await uploadFile(a.uri, a.fileName ?? "tour.mp4", a.mimeType ?? "video/mp4");
      setVideo(up.url);
      toast.show("Virtual tour added", "success");
    } catch (e: any) {
      toast.show(e.status === 413 ? "Video must be under 50 MB" : e.message ?? "Upload failed", "error");
    } finally {
      setUploadingVideo(false);
    }
  };

  const create = useMutation({
    mutationFn: () =>
      api<Listing>("/listings", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          address: place!.description,
          city: place!.city,
          country: place!.country,
          country_code: place!.country_code,
          lat: place!.lat,
          lng: place!.lng,
          price: Number(price.replace(/[^\d.]/g, "")),
          currency: currency.code,
          period,
          property_type: propertyType,
          bedrooms,
          bathrooms,
          photos,
          video,
        },
      }),
    onSuccess: (l) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.show("Listing is live!", "success");
      router.replace(`/listing/${l.listing_id}`);
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const submit = () => {
    if (title.trim().length < 3) return toast.show("Give the listing a title", "error");
    if (!place) return toast.show("Pick the address from the suggestions", "error");
    if (!Number(price.replace(/[^\d.]/g, ""))) return toast.show("Enter a rent price", "error");
    create.mutate();
  };

  const priceNum = Number(price.replace(/[^\d.]/g, "")) || 0;

  return (
    <View style={styles.root} testID="create-listing-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <LineArt name="create" opacity={0.22} fade={false} align="center" />
        <IconButton testID="create-back-button" icon="close" onPress={() => router.back()} />
        <Text style={styles.headerTitle}>List a home</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAwareScrollView contentContainerStyle={[styles.scroll, { paddingBottom: STICKY_H + insets.bottom + spacing.xl }]} bottomOffset={STICKY_H + 24} keyboardShouldPersistTaps="handled">
        {/* Photos */}
        <Text style={styles.label}>Photos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Pressable testID="add-photo-button" onPress={pickPhotos} style={styles.addPhoto} disabled={uploading}>
            {uploading ? <ActivityIndicator color={colors.brandPrimary} /> : <Ionicons name="camera" size={26} color={colors.onBrandTertiary} />}
            <Text style={styles.addPhotoText}>{uploading ? "Uploading…" : "Add"}</Text>
          </Pressable>
          {photos.map((p, i) => (
            <View key={p} style={styles.photoWrap}>
              <Image source={{ uri: fileUrl(p) }} style={styles.photo} contentFit="cover" />
              <Pressable testID={`remove-photo-${i}`} onPress={() => setPhotos((ph) => ph.filter((x) => x !== p))} style={styles.removePhoto}>
                <Ionicons name="close" size={14} color={colors.onSurfaceInverse} />
              </Pressable>
            </View>
          ))}
        </ScrollView>

        {/* Video tour */}
        <Text style={styles.label}>Virtual tour (optional, up to 60s)</Text>
        {video ? (
          <View style={{ gap: spacing.sm }}>
            <VideoTour uri={video} testID="create-video-preview" />
            <Button testID="remove-video-button" title="Remove video" icon="trash-outline" variant="ghost" small onPress={() => setVideo(null)} style={{ alignSelf: "flex-start" }} />
          </View>
        ) : (
          <Pressable testID="add-video-button" onPress={pickVideo} disabled={uploadingVideo} style={styles.videoBtn}>
            {uploadingVideo ? <ActivityIndicator color={colors.brandPrimary} /> : <Ionicons name="videocam" size={22} color={colors.onBrandTertiary} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.videoTitle}>{uploadingVideo ? "Uploading tour…" : "Add a walkthrough video"}</Text>
              <Text style={styles.videoSub}>Let tenants tour the home before visiting. Max 60s / 50 MB.</Text>
            </View>
          </Pressable>
        )}

        <Field testID="create-title-input" label="Title" placeholder="Sunny 2-bed with rooftop" value={title} onChangeText={setTitle} />

        {/* Address */}
        <View style={{ gap: 6 }}>
          <Field
            testID="create-address-input"
            label="Address"
            icon="location"
            placeholder="Start typing an address or area…"
            value={addressQuery}
            onChangeText={(v) => {
              setAddressQuery(v);
              if (place) setPlace(null);
            }}
            right={searching ? <ActivityIndicator color={colors.brandPrimary} /> : place ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}
          />
          {results.length > 0 && !place && (
            <View style={styles.dropdown} testID="address-suggestions">
              {results.map((r, i) => (
                <Pressable
                  key={`${r.lat}-${r.lng}-${i}`}
                  testID={`address-suggestion-${i}`}
                  onPress={() => {
                    setPlace(r);
                    setAddressQuery(r.description);
                    setResults([]);
                    setCurrencyOverride(null);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  style={styles.suggestion}
                >
                  <Ionicons name="location-outline" size={16} color={colors.brandPrimary} />
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    {r.description}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {place && <AppMap pins={[{ id: "p", lat: place.lat, lng: place.lng, label: place.name, selected: true }]} center={{ lat: place.lat, lng: place.lng }} zoomDelta={0.02} interactive={false} style={styles.miniMap} />}
        </View>

        {/* Type */}
        <Text style={styles.label}>Property type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
          {TYPES.map((t) => (
            <Chip key={t} testID={`type-chip-${t}`} label={t[0].toUpperCase() + t.slice(1)} selected={propertyType === t} onPress={() => setPropertyType(t)} />
          ))}
        </ScrollView>

        <View style={styles.stepRow}>
          <Stepper label="Bedrooms" value={bedrooms} onChange={setBedrooms} testID="bedrooms" />
          <Stepper label="Bathrooms" value={bathrooms} onChange={setBathrooms} testID="bathrooms" />
        </View>

        {/* Price */}
        <Text style={styles.label}>Rent period</Text>
        <View style={styles.segment}>
          {PERIODS.map((p) => (
            <Pressable
              key={p}
              testID={`period-option-${p}`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPeriod(p);
              }}
              style={[styles.segmentItem, period === p && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, period === p && styles.segmentTextActive]}>{p[0].toUpperCase() + p.slice(1)}ly</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceHead}>
            <Text style={styles.priceLabel}>Price {PERIOD_LABEL[period]}</Text>
            <Pressable testID="change-currency-button" onPress={() => setShowCurrency(true)} style={styles.currencyBtn}>
              <Text style={styles.currencyBtnText}>
                {currency.code} {currency.symbol}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.onSurface} />
            </Pressable>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountSymbol}>{currency.symbol}</Text>
            <TextInput testID="create-price-input" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={styles.amountInput} />
            <View style={styles.periodBadge}>
              <Text style={styles.periodBadgeText}>{PERIOD_LABEL[period].toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.priceHint} testID="currency-hint">
            {currencyOverride
              ? `Currency set manually to ${currency.name}.`
              : detected
                ? `Auto-detected ${currency.name} from ${place?.country}. Tap the code to change.`
                : "Pick an address to auto-detect the local currency, or choose one."}
          </Text>
        </View>

        <Field testID="create-description-input" label="Description" placeholder="What makes this place great? Power, water, transport, house rules…" value={description} onChangeText={setDescription} multiline style={{ minHeight: 100 }} />
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }} style={styles.stickyWrap}>
        <Glass strong style={styles.sticky}>
          <View style={[styles.stickyInner, { paddingBottom: insets.bottom + spacing.sm }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stickyLabel}>Listing at</Text>
              <Text style={styles.stickyPrice} numberOfLines={1}>
                {formatPrice(priceNum, currency.symbol, currency.code)} <Text style={styles.stickyPeriod}>{PERIOD_LABEL[period]}</Text>
              </Text>
            </View>
            <Button testID="create-submit-button" title="Publish" icon="rocket" onPress={submit} loading={create.isPending} style={{ flex: 1 }} />
          </View>
        </Glass>
      </KeyboardStickyView>

      {/* Currency picker */}
      <Modal visible={showCurrency} animationType="slide" transparent onRequestClose={() => setShowCurrency(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCurrency(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="currency-sheet">
          <Text style={styles.sheetTitle}>Choose currency</Text>
          {detected && (
            <Pressable
              testID="currency-auto-option"
              onPress={() => {
                setCurrencyOverride(null);
                setShowCurrency(false);
              }}
              style={styles.currencyRow}
            >
              <Ionicons name="sparkles" size={18} color={colors.brandPrimary} />
              <Text style={styles.currencyName}>Auto ({detected.name})</Text>
            </Pressable>
          )}
          <ScrollView style={{ maxHeight: 380 }}>
            {(currencies.data ?? []).map((c) => (
              <Pressable
                key={c.code}
                testID={`currency-option-${c.code}`}
                onPress={() => {
                  setCurrencyOverride(c);
                  setShowCurrency(false);
                }}
                style={[styles.currencyRow, currency.code === c.code && { backgroundColor: colors.brandTertiary }]}
              >
                <Text style={styles.currencySymbol}>{c.symbol}</Text>
                <Text style={styles.currencyName}>{c.name}</Text>
                <Text style={styles.currencyCode}>{c.code}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Permission help */}
      <Modal visible={permissionHelp} animationType="fade" transparent onRequestClose={() => setPermissionHelp(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPermissionHelp(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="permission-sheet">
          <Text style={styles.sheetTitle}>Allow photo access</Text>
          <Text style={styles.sheetBody}>Renter needs access to your photos so you can show tenants what the home looks like. Enable it in Settings.</Text>
          <Button testID="open-settings-button" title="Open Settings" icon="settings-outline" onPress={() => Linking.openSettings()} />
          <Button title="Not now" variant="ghost" onPress={() => setPermissionHelp(false)} />
        </View>
      </Modal>
    </View>
  );
}

function Stepper({ label, value, onChange, testID }: { label: string; value: number; onChange: (n: number) => void; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepControls}>
        <Pressable testID={`${testID}-minus`} onPress={() => onChange(Math.max(0, value - 1))} style={styles.stepBtn}>
          <Ionicons name="remove" size={18} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.stepValue} testID={`${testID}-value`}>
          {value}
        </Text>
        <Pressable testID={`${testID}-plus`} onPress={() => onChange(value + 1)} style={styles.stepBtn}>
          <Ionicons name="add" size={18} color={colors.onSurface} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors, r) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider, position: "relative", overflow: "hidden" },
  headerTitle: { fontFamily: fonts.family, fontSize: r.ms(18), fontWeight: "800", color: colors.onSurface },
  scroll: { padding: spacing.lg, gap: spacing.lg, width: "100%", maxWidth: r.contentMaxWidth, alignSelf: "center" },
  label: { fontFamily: fonts.family, fontSize: r.ms(13), fontWeight: "700", color: colors.onSurfaceSecondary, marginLeft: spacing.xs, marginBottom: -spacing.sm },
  addPhoto: { width: 96, height: 96, borderRadius: radius.lg, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1.5, borderColor: colors.brand, borderStyle: "dashed" },
  addPhotoText: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "700", color: colors.onBrandTertiary },
  photoWrap: { width: 96, height: 96, borderRadius: radius.lg, overflow: "hidden", position: "relative" },
  photo: { width: "100%", height: "100%" },
  removePhoto: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center" },
  videoBtn: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1.5, borderColor: colors.brand, borderStyle: "dashed" },
  videoTitle: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "800", color: colors.onBrandTertiary },
  videoSub: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.onBrandTertiary },
  dropdown: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden", shadowColor: colors.shadow, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  suggestion: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  suggestionText: { flex: 1, fontFamily: fonts.family, fontSize: r.ms(14), color: colors.onSurface },
  miniMap: { height: 140, borderRadius: radius.lg, marginTop: spacing.sm },
  chipRow: { height: 56, flexGrow: 0, marginHorizontal: -spacing.lg },
  chipRowContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  stepRow: { flexDirection: "row", gap: spacing.md },
  stepper: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  stepLabel: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "700", color: colors.muted },
  stepControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  stepValue: { fontFamily: fonts.family, fontSize: r.ms(18), fontWeight: "800", color: colors.onSurface },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border },
  segmentItem: { flex: 1, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segmentItemActive: { backgroundColor: colors.surfaceInverse },
  segmentText: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "700", color: colors.onSurface },
  segmentTextActive: { color: colors.onSurfaceInverse },
  priceCard: { backgroundColor: colors.brandTertiary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  priceHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceLabel: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "800", color: colors.onBrandTertiary, textTransform: "uppercase", letterSpacing: 1 },
  currencyBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 32 },
  currencyBtnText: { fontFamily: fonts.family, fontSize: r.ms(13), fontWeight: "800", color: colors.onSurface },
  amountRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 60 },
  amountSymbol: { fontFamily: fonts.family, fontSize: r.ms(22), fontWeight: "800", color: colors.onSurface },
  amountInput: { flex: 1, fontFamily: fonts.family, fontSize: r.ms(24), fontWeight: "800", color: colors.onSurface, height: 60 },
  periodBadge: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 26, justifyContent: "center" },
  periodBadgeText: { fontFamily: fonts.family, fontSize: r.ms(11), fontWeight: "800", color: colors.onBrandPrimary, letterSpacing: 0.6 },
  priceHint: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.onBrandTertiary, fontWeight: "600" },
  stickyWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sticky: { borderTopLeftRadius: radius.lg + 4, borderTopRightRadius: radius.lg + 4, borderBottomWidth: 0 },
  stickyInner: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  stickyLabel: { fontFamily: fonts.family, fontSize: r.ms(11), fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  stickyPrice: { fontFamily: fonts.family, fontSize: r.ms(18), fontWeight: "800", color: colors.onSurface },
  stickyPeriod: { fontSize: r.ms(12), color: colors.brandPrimary, fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg + 8, borderTopRightRadius: radius.lg + 8, padding: spacing.xl, gap: spacing.md },
  sheetTitle: { fontFamily: fonts.family, fontSize: r.ms(20), fontWeight: "800", color: colors.onSurface },
  sheetBody: { fontFamily: fonts.family, fontSize: r.ms(14), color: colors.onSurfaceSecondary, lineHeight: r.ms(20) },
  currencyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md },
  currencySymbol: { fontFamily: fonts.family, fontSize: r.ms(16), fontWeight: "800", color: colors.onSurface, width: 44 },
  currencyName: { flex: 1, fontFamily: fonts.family, fontSize: r.ms(15), color: colors.onSurface, fontWeight: "600" },
  currencyCode: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.muted, fontWeight: "700" },
}));
