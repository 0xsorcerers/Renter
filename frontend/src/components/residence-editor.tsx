import React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import type { FeeAmountType, FeeKey, Period } from "@/src/api";
import { PERIODS_PER_YEAR } from "@/src/currency";

export interface FeeDraft {
  key: FeeKey | "custom";
  label: string;
  included: boolean;
  amount_type: FeeAmountType;
  value: string;
  negotiable: boolean;
  amenities: string;
  note: string;
  expanded: boolean;
}

export interface ResidenceDraft {
  label: string;
  unit_type: string;
  bedrooms: number;
  bathrooms: number;
  price: string;
  period: Period;
  tenure_months: number;
  fees: FeeDraft[];
}

export const UNIT_TYPES = ["apartment", "studio", "room", "duplex", "bungalow", "penthouse", "shop", "office"];
export const PERIODS: Period[] = ["week", "month", "year"];

export function computeFeeAmount(f: { amount_type: FeeAmountType; value: string | number }, rent: number, period: Period): number {
  const v = typeof f.value === "string" ? Number(f.value.replace(/[^\d.]/g, "")) || 0 : f.value;
  if (f.amount_type === "percent_annual") return Math.round(rent * (PERIODS_PER_YEAR[period] ?? 12) * (v / 100));
  if (f.amount_type === "percent_period") return Math.round(rent * (v / 100));
  return Math.round(v);
}

function appFeeDraft(): FeeDraft {
  return {
    key: "app_fee",
    label: "App Fee",
    included: true,
    amount_type: "percent_annual",
    value: "2",
    negotiable: false,
    amenities: "",
    note: "One-time agency fee (2% of annual rent). Non-negotiable.",
    expanded: false,
  };
}

export function defaultResidence(index: number): ResidenceDraft {
  return {
    label: index === 0 ? "Main residence" : `Residence ${index + 1}`,
    unit_type: "apartment",
    bedrooms: 2,
    bathrooms: 1,
    price: "",
    period: "year",
    tenure_months: 12,
    fees: [
      appFeeDraft(),
      { key: "legal_fee", label: "Legal / Agreement Fee", included: false, amount_type: "percent_annual", value: "", negotiable: true, amenities: "", note: "Covers drafting the tenancy agreement.", expanded: false },
      { key: "caution", label: "Caution / Security Deposit", included: false, amount_type: "percent_annual", value: "", negotiable: true, amenities: "", note: "Refundable deposit held against damage or unpaid bills.", expanded: false },
      { key: "service_charge", label: "Service Charge", included: false, amount_type: "flat", value: "", negotiable: true, amenities: "", note: "Shared estate/building costs. List what it covers.", expanded: false },
    ],
  };
}

export function residenceToPayload(d: ResidenceDraft) {
  const price = Number(d.price.replace(/[^\d.]/g, "")) || 0;
  return {
    label: d.label.trim() || "Residence",
    unit_type: d.unit_type,
    bedrooms: d.bedrooms,
    bathrooms: d.bathrooms,
    price,
    period: d.period,
    tenure_months: d.tenure_months,
    photos: [] as string[],
    fees: d.fees
      .filter((f) => f.included)
      .map((f) => ({
        key: f.key,
        label: f.label.trim() || "Fee",
        amount_type: f.key === "app_fee" ? "percent_annual" : f.amount_type,
        value: f.key === "app_fee" ? 2 : Number(f.value.replace(/[^\d.]/g, "")) || 0,
        negotiable: f.key === "app_fee" ? false : f.negotiable,
        amenities: f.amenities.split(",").map((s) => s.trim()).filter(Boolean),
        note: f.note,
      })),
  };
}

function Stepper({ label, value, onChange, testID, min = 0 }: { label: string; value: number; onChange: (n: number) => void; testID: string; min?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepControls}>
        <Pressable testID={`${testID}-minus`} onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepBtn}>
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

const AMOUNT_TYPE_LABEL: Record<FeeAmountType, string> = {
  flat: "Flat",
  percent_annual: "% of annual rent",
  percent_period: "% of period rent",
};

function FeeRow({
  fee,
  rent,
  period,
  currencySymbol,
  onChange,
  testID,
}: {
  fee: FeeDraft;
  rent: number;
  period: Period;
  currencySymbol: string;
  onChange: (f: FeeDraft) => void;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const locked = fee.key === "app_fee";
  const amount = fee.included ? computeFeeAmount(fee, rent, period) : 0;
  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString()}`;

  return (
    <View style={[styles.feeCard, !fee.included && styles.feeCardOff]} testID={testID}>
      <Pressable
        testID={`${testID}-toggle`}
        onPress={() => {
          if (locked) return;
          Haptics.selectionAsync().catch(() => {});
          onChange({ ...fee, included: !fee.included, expanded: !fee.included ? true : fee.expanded });
        }}
        style={styles.feeHead}
      >
        <View style={[styles.feeCheck, fee.included && styles.feeCheckOn, locked && { backgroundColor: colors.brandPrimary }]}>
          <Ionicons name={fee.included ? "checkmark" : "add"} size={14} color={fee.included ? colors.onBrandPrimary : colors.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.feeLabel} numberOfLines={1}>
            {fee.label}
          </Text>
          <Text style={styles.feeSub} numberOfLines={1}>
            {locked
              ? "Compulsory · non-negotiable"
              : fee.included
                ? fee.negotiable
                  ? "Negotiable with homeowner"
                  : "Fixed"
                : "Not included — tap to add"}
          </Text>
        </View>
        {fee.included && (
          <Text style={styles.feeAmount} testID={`${testID}-amount`}>
            {fee.amount_type === "flat" ? fmt(amount) : `${fee.value || "0"}% → ${fmt(amount)}`}
          </Text>
        )}
        {fee.included && !locked && (
          <Ionicons name={fee.expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
        )}
      </Pressable>

      {fee.included && fee.expanded && (
        <View style={styles.feeBody}>
          <Text style={styles.feeFieldLabel}>Fee name</Text>
          <TextInput
            testID={`${testID}-label`}
            value={fee.label}
            onChangeText={(v) => onChange({ ...fee, label: v })}
            placeholder={fee.key === "custom" ? "e.g. Waste disposal levy" : fee.label}
            placeholderTextColor={colors.muted}
            style={styles.feeInput}
          />
          <Text style={styles.feeFieldLabel}>Amount type</Text>
          <View style={styles.chipRow}>
            {(Object.keys(AMOUNT_TYPE_LABEL) as FeeAmountType[]).map((t) => (
              <Pressable
                key={t}
                testID={`${testID}-amount-type-${t}`}
                onPress={() => onChange({ ...fee, amount_type: t })}
                style={[styles.miniChip, fee.amount_type === t && styles.miniChipOn]}
              >
                <Text style={[styles.miniChipText, fee.amount_type === t && styles.miniChipTextOn]}>{AMOUNT_TYPE_LABEL[t]}</Text>
              </Pressable>
            ))}
          </View>
          {fee.amount_type !== "flat" ? (
            <View style={styles.feeValueRow}>
              <TextInput
                testID={`${testID}-value`}
                value={fee.value}
                onChangeText={(v) => onChange({ ...fee, value: v })}
                keyboardType="numeric"
                placeholder="e.g. 5"
                placeholderTextColor={colors.muted}
                style={styles.feeValueInput}
              />
              <Text style={styles.feeValueSuffix}>%</Text>
            </View>
          ) : (
            <View style={styles.feeValueRow}>
              <Text style={styles.feeValuePrefix}>{currencySymbol}</Text>
              <TextInput
                testID={`${testID}-value`}
                value={fee.value}
                onChangeText={(v) => onChange({ ...fee, value: v })}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={styles.feeValueInput}
              />
            </View>
          )}
          {fee.amount_type === "percent_annual" && <Text style={styles.feeHint}>Calculated on the annualized rent.</Text>}
          {fee.key === "service_charge" && (
            <>
              <Text style={styles.feeFieldLabel}>Covered amenities (comma separated)</Text>
              <TextInput
                testID={`${testID}-amenities`}
                value={fee.amenities}
                onChangeText={(v) => onChange({ ...fee, amenities: v })}
                placeholder="Security, waste disposal, water treatment, generator…"
                placeholderTextColor={colors.muted}
                style={styles.feeInput}
              />
              <Text style={styles.feeHint}>Tenants will see exactly what the service charge covers.</Text>
            </>
          )}
          {!locked && (
            <>
              <Text style={styles.feeFieldLabel}>Note (optional)</Text>
              <TextInput
                testID={`${testID}-note`}
                value={fee.note}
                onChangeText={(v) => onChange({ ...fee, note: v })}
                placeholder="e.g. Covers drafting the tenancy agreement"
                placeholderTextColor={colors.muted}
                style={styles.feeInput}
              />
              <Pressable testID={`${testID}-negotiable`} onPress={() => onChange({ ...fee, negotiable: !fee.negotiable })} style={styles.negotiableRow}>
                <View style={[styles.feeCheck, fee.negotiable && styles.feeCheckOn]}>
                  <Ionicons name={fee.negotiable ? "checkmark" : "remove"} size={14} color={fee.negotiable ? colors.onBrandPrimary : colors.muted} />
                </View>
                <Text style={styles.feeSub}>Tenants may appeal to remove or renegotiate this fee</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

export function ResidenceEditor({
  residences,
  onChange,
  currencySymbol,
}: {
  residences: ResidenceDraft[];
  onChange: (r: ResidenceDraft[]) => void;
  currencySymbol: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const update = (i: number, patch: Partial<ResidenceDraft>) => {
    const next = residences.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  };
  const updateFee = (i: number, fi: number, fee: FeeDraft) => {
    const r = residences[i];
    update(i, { fees: r.fees.map((f, idx) => (idx === fi ? fee : f)) });
  };
  const duplicate = (i: number) => {
    const copy: ResidenceDraft = {
      ...residences[i],
      label: `${residences[i].label} (copy)`,
      fees: residences[i].fees.map((f) => ({ ...f, expanded: false })),
    };
    const next = [...residences];
    next.splice(i + 1, 0, copy);
    onChange(next);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  return (
    <View style={{ gap: spacing.lg }} testID="residences-editor">
      {residences.map((res, i) => {
        const rent = Number(res.price.replace(/[^\d.]/g, "")) || 0;
        const feesTotal = res.fees.filter((f) => f.included).reduce((s, f) => s + computeFeeAmount(f, rent, res.period), 0);
        return (
          <View key={i} style={styles.resCard} testID={`residence-card-${i}`}>
            <View style={styles.resHead}>
              <TextInput
                testID={`residence-label-${i}`}
                value={res.label}
                onChangeText={(v) => update(i, { label: v })}
                placeholder={`Residence ${i + 1} (e.g. Flat A, Boy's Quarter)`}
                placeholderTextColor={colors.muted}
                style={styles.resLabelInput}
              />
              <Pressable testID={`residence-duplicate-${i}`} onPress={() => duplicate(i)} hitSlop={8} style={styles.resIconBtn}>
                <Ionicons name="copy-outline" size={18} color={colors.onSurface} />
              </Pressable>
              {residences.length > 1 && (
                <Pressable
                  testID={`residence-remove-${i}`}
                  onPress={() => {
                    onChange(residences.filter((_, idx) => idx !== i));
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }}
                  hitSlop={8}
                  style={styles.resIconBtn}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              )}
            </View>

            <Text style={styles.fieldLabel}>Unit type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent}>
              {UNIT_TYPES.map((t) => (
                <Pressable
                  key={t}
                  testID={`res-${i}-type-${t}`}
                  onPress={() => update(i, { unit_type: t })}
                  style={[styles.miniChip, res.unit_type === t && styles.miniChipOn]}
                >
                  <Text style={[styles.miniChipText, res.unit_type === t && styles.miniChipTextOn]}>{t[0].toUpperCase() + t.slice(1)}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.stepRow}>
              <Stepper label="Bedrooms" value={res.bedrooms} onChange={(n) => update(i, { bedrooms: n })} testID={`res-${i}-bedrooms`} />
              <Stepper label="Bathrooms" value={res.bathrooms} onChange={(n) => update(i, { bathrooms: n })} testID={`res-${i}-bathrooms`} />
            </View>

            <Text style={styles.fieldLabel}>Rent {PERIODS_LABEL[res.period]}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceSymbol}>{currencySymbol}</Text>
              <TextInput
                testID={`res-${i}-price`}
                value={res.price}
                onChangeText={(v) => update(i, { price: v })}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={styles.priceInput}
              />
            </View>
            <View style={styles.segment}>
              {PERIODS.map((p) => (
                <Pressable
                  key={p}
                  testID={`res-${i}-period-${p}`}
                  onPress={() => update(i, { period: p })}
                  style={[styles.segmentItem, res.period === p && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentText, res.period === p && styles.segmentTextActive]}>{p[0].toUpperCase() + p.slice(1)}ly</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.tenureRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Tenure</Text>
                <Text style={styles.tenureHint}>How many months the tenant occupies this residence.</Text>
              </View>
              <View style={styles.tenureControl}>
                <Pressable testID={`res-${i}-tenure-minus`} onPress={() => update(i, { tenure_months: Math.max(1, res.tenure_months - 1) })} style={styles.stepBtn}>
                  <Ionicons name="remove" size={16} color={colors.onSurface} />
                </Pressable>
                <Text style={styles.tenureValue} testID={`res-${i}-tenure-value`}>
                  {res.tenure_months} mo
                </Text>
                <Pressable testID={`res-${i}-tenure-plus`} onPress={() => update(i, { tenure_months: Math.min(120, res.tenure_months + 1) })} style={styles.stepBtn}>
                  <Ionicons name="add" size={16} color={colors.onSurface} />
                </Pressable>
              </View>
            </View>

            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <View style={styles.feesHead}>
                <Text style={styles.fieldLabel}>Fees & charges</Text>
                {rent > 0 && feesTotal > 0 && (
                  <Text style={styles.feesTotal} testID={`res-${i}-fees-total`}>
                    +{currencySymbol}
                    {feesTotal.toLocaleString()}
                  </Text>
                )}
              </View>
              {res.fees.map((f, fi) => (
                <FeeRow key={`${f.key}-${fi}`} fee={f} rent={rent} period={res.period} currencySymbol={currencySymbol} onChange={(nf) => updateFee(i, fi, nf)} testID={`res-${i}-fee-${f.key}-${fi}`} />
              ))}
              <Pressable
                testID={`res-${i}-add-fee`}
                onPress={() =>
                  update(i, {
                    fees: [
                      ...res.fees,
                      { key: "custom", label: "", included: true, amount_type: "flat", value: "", negotiable: true, amenities: "", note: "", expanded: true },
                    ],
                  })
                }
                style={styles.addFeeBtn}
              >
                <Ionicons name="add" size={16} color={colors.brandPrimary} />
                <Text style={styles.addFeeText}>Add custom fee</Text>
              </Pressable>
              <Text style={styles.feeHint}>All fees except the App Fee can be appealed by tenants — they can ask to remove or renegotiate them with you.</Text>
            </View>
          </View>
        );
      })}
      <Pressable
        testID="add-residence-button"
        onPress={() => {
          onChange([...residences, defaultResidence(residences.length)]);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }}
        style={styles.addResBtn}
      >
        <Ionicons name="business-outline" size={18} color={colors.onSurface} />
        <Text style={styles.addResText}>Add another residence</Text>
        <Text style={styles.addResHint}>Structures can hold flats, rooms, shops — each rented independently.</Text>
      </Pressable>
    </View>
  );
}

const PERIODS_LABEL: Record<Period, string> = { week: "per week", month: "per month", year: "per year" };

const useStyles = makeStyles((colors, r) => ({
  resCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  resHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  resLabelInput: { flex: 1, fontFamily: fonts.family, fontSize: r.ms(16), fontWeight: "800", color: colors.onSurface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 6 },
  resIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  fieldLabel: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "800", color: colors.onSurfaceSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chipRowContent: { gap: spacing.sm, paddingRight: spacing.md },
  miniChip: { height: 32, borderRadius: radius.pill, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  miniChipOn: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  miniChipText: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "700", color: colors.onSurface },
  miniChipTextOn: { color: colors.onSurfaceInverse },
  stepRow: { flexDirection: "row", gap: spacing.md },
  stepper: { flex: 1, gap: 6 },
  stepLabel: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "700", color: colors.muted },
  stepControls: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignSelf: "flex-start" },
  stepBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  stepValue: { fontFamily: fonts.family, fontSize: r.ms(15), fontWeight: "800", color: colors.onSurface, minWidth: 28, textAlign: "center" },
  priceRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, height: 52 },
  priceSymbol: { fontFamily: fonts.family, fontSize: r.ms(18), fontWeight: "800", color: colors.onSurface },
  priceInput: { flex: 1, fontFamily: fonts.family, fontSize: r.ms(18), fontWeight: "800", color: colors.onSurface, height: 52 },
  segment: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, padding: 3, gap: 3 },
  segmentItem: { flex: 1, height: 34, borderRadius: radius.pill - 4, alignItems: "center", justifyContent: "center" },
  segmentItemActive: { backgroundColor: colors.surfaceInverse },
  segmentText: { fontFamily: fonts.family, fontSize: r.ms(13), fontWeight: "700", color: colors.onSurfaceSecondary },
  segmentTextActive: { color: colors.onSurfaceInverse },
  tenureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.lg, padding: spacing.md },
  tenureHint: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.onBrandTertiary, marginTop: 2 },
  tenureControl: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  tenureValue: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "800", color: colors.onSurface, minWidth: 52, textAlign: "center" },
  feesHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  feesTotal: { fontFamily: fonts.family, fontSize: r.ms(13), fontWeight: "800", color: colors.brandPrimary },
  feeCard: { backgroundColor: colors.surface, borderRadius: radius.md ?? radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  feeCardOff: { opacity: 0.6 },
  feeHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  feeCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  feeCheckOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  feeLabel: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "700", color: colors.onSurface },
  feeSub: { fontFamily: fonts.family, fontSize: r.ms(11), color: colors.muted, marginTop: 1 },
  feeAmount: { fontFamily: fonts.family, fontSize: r.ms(13), fontWeight: "800", color: colors.onSurface },
  feeBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  feeFieldLabel: { fontFamily: fonts.family, fontSize: r.ms(11), fontWeight: "800", color: colors.onSurfaceSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  feeValueRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md ?? radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 46, gap: spacing.sm },
  feeValuePrefix: { fontFamily: fonts.family, fontSize: r.ms(16), fontWeight: "800", color: colors.onSurface },
  feeValueSuffix: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "800", color: colors.muted },
  feeValueInput: { flex: 1, fontFamily: fonts.family, fontSize: r.ms(16), fontWeight: "700", color: colors.onSurface, height: 46 },
  feeInput: { fontFamily: fonts.family, fontSize: r.ms(13), color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md ?? radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 44 },
  feeHint: { fontFamily: fonts.family, fontSize: r.ms(11), color: colors.muted },
  negotiableRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  addFeeBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", paddingVertical: spacing.xs },
  addFeeText: { fontFamily: fonts.family, fontSize: r.ms(13), fontWeight: "800", color: colors.brandPrimary },
  addResBtn: { borderWidth: 1.5, borderColor: colors.borderStrong, borderStyle: "dashed", borderRadius: radius.lg, padding: spacing.lg, gap: 4, alignItems: "center" },
  addResText: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "800", color: colors.onSurface },
  addResHint: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.muted, textAlign: "center" },
}));
