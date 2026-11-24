import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { api, type Agreement, type FeeAmountType, type FeeCharge } from "@/src/api";
import { Button, EmptyState, IconButton } from "@/src/components/ui";
import { Glass } from "@/src/components/glass";
import { LineArt } from "@/src/components/line-art";
import { useToast } from "@/src/components/toast";
import { formatPrice, PERIOD_LABEL } from "@/src/currency";

interface FeeEdit {
  key: string;
  label: string;
  amount_type: FeeAmountType;
  value: string;
  negotiable: boolean;
  amenities: string;
  note: string;
}

const AMOUNT_TYPES: { key: FeeAmountType; label: string }[] = [
  { key: "flat", label: "Flat" },
  { key: "percent_annual", label: "% annual" },
  { key: "percent_period", label: "% period" },
];

function feeToEdit(f: FeeCharge): FeeEdit {
  return {
    key: f.key,
    label: f.label,
    amount_type: f.amount_type,
    value: String(f.value ?? ""),
    negotiable: !!f.negotiable,
    amenities: (f.amenities ?? []).join(", "),
    note: f.note ?? "",
  };
}

function editToPayload(f: FeeEdit) {
  return {
    key: f.key,
    label: f.label,
    amount_type: f.key === "app_fee" ? "percent_annual" : f.amount_type,
    value: f.key === "app_fee" ? 2 : Number(String(f.value).replace(/[^\d.]/g, "")) || 0,
    negotiable: f.key === "app_fee" ? false : f.negotiable,
    amenities: f.amenities.split(",").map((s) => s.trim()).filter(Boolean),
    note: f.note,
  };
}

export default function AgreementPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const agreement = useQuery({ queryKey: ["agreement", id], queryFn: () => api<Agreement>(`/agreements/${id}`), refetchInterval: 10000 });
  const ag = agreement.data;
  const isOwner = ag?.my_role === "owner";
  const isPending = ag?.status === "pending";

  const [rent, setRent] = useState("");
  const [tenure, setTenure] = useState(12);
  const [fees, setFees] = useState<FeeEdit[] | null>(null);
  const editing = fees !== null;

  const beginEdit = () => {
    if (!ag) return;
    setRent(String(ag.rent_amount));
    setTenure(ag.tenure_months);
    setFees((ag.fees ?? []).map(feeToEdit));
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["agreement", id] });
    qc.invalidateQueries({ queryKey: ["agreements"] });
    qc.invalidateQueries({ queryKey: ["listing", ag?.listing_id] });
    qc.invalidateQueries({ queryKey: ["listings"] });
  };

  const sign = useMutation({
    mutationFn: () => api<Agreement>(`/agreements/${id}/sign`, { method: "POST" }),
    onSuccess: (d) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      invalidate();
      toast.show(d.status === "active" ? "Agreement activated — tenancy begins!" : "Signature recorded", "success");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const payment = useMutation({
    mutationFn: (confirmed: boolean) => api<Agreement>(`/agreements/${id}/payment`, { method: "POST", body: { confirmed } }),
    onSuccess: (d, confirmed) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      invalidate();
      toast.show(confirmed ? "Payment receipt confirmed" : "Payment confirmation removed", confirmed ? "success" : "info");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const saveTerms = useMutation({
    mutationFn: () =>
      api<Agreement>(`/agreements/${id}`, {
        method: "PATCH",
        body: {
          rent_amount: Number(rent.replace(/[^\d.]/g, "")) || undefined,
          tenure_months: tenure,
          fees: (fees ?? []).map(editToPayload),
        },
      }),
    onSuccess: () => {
      setFees(null);
      invalidate();
      toast.show("Agreement terms updated", "success");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const steps = useMemo(() => {
    if (!ag) return [];
    return [
      { label: "Homeowner signs", done: !!ag.owner_signed, mine: ag.my_role === "owner" },
      { label: "Tenant signs", done: !!ag.tenant_signed, mine: ag.my_role === "tenant" },
      { label: "Homeowner confirms payment received", done: !!ag.owner_confirmed_payment, mine: ag.my_role === "owner" },
      { label: "Tenant confirms payment received", done: !!ag.tenant_confirmed_payment, mine: ag.my_role === "tenant" },
    ];
  }, [ag]);

  if (agreement.isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }
  if (agreement.isError || !ag) {
    return (
      <View style={[styles.root, styles.center, { padding: spacing.xl, gap: spacing.lg }]}>
        <EmptyState icon="document-text-outline" title="Agreement not found" subtitle="You need to be the homeowner or tenant on this agreement." />
        <Button title="Go back" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const mySigned = isOwner ? ag.owner_signed : ag.tenant_signed;
  const myPaid = isOwner ? ag.owner_confirmed_payment : ag.tenant_confirmed_payment;
  const fmt = (n: number) => formatPrice(n, ag.currency_symbol, ag.currency);

  return (
    <View style={styles.root} testID="agreement-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <LineArt name="create" opacity={0.2} fade={false} align="center" />
        <IconButton testID="agreement-back" icon="chevron-back" onPress={() => router.back()} />
        <Text style={styles.headerTitle}>License agreement</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing["2xl"] }]}>
        {/* Status banner */}
        <View
          style={[
            styles.statusBanner,
            ag.status === "active" && { backgroundColor: colors.brandPrimary },
            ag.status === "ended" && { backgroundColor: colors.surfaceSecondary },
          ]}
          testID="agreement-status-banner"
        >
          <Ionicons
            name={ag.status === "active" ? "key" : ag.status === "ended" ? "archive" : "create"}
            size={22}
            color={ag.status === "active" ? colors.onBrandPrimary : colors.onSurface}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, ag.status === "active" && { color: colors.onBrandPrimary }]}>
              {ag.status === "active" ? "Tenancy active" : ag.status === "ended" ? "Agreement ended" : "Awaiting signatures & payment"}
            </Text>
            <Text style={[styles.statusSub, ag.status === "active" && { color: colors.onBrandPrimary }]}>
              {ag.status === "active"
                ? `Occupied until ${ag.ends_at ? new Date(ag.ends_at).toLocaleDateString() : "—"}. The residence is hidden from other tenants.`
                : ag.status === "ended"
                  ? "The tenure has concluded and the residence is available again."
                  : "Once both parties sign and confirm payment, the tenancy activates and the residence is locked until the tenure ends."}
            </Text>
          </View>
        </View>

        {/* Property summary */}
        <View style={styles.card} testID="agreement-property">
          <Text style={styles.cardTitle}>{ag.listing?.title ?? "Residence"}</Text>
          <Text style={styles.cardSub}>
            {ag.residence_label}
            {ag.listing ? ` · ${ag.listing.address}, ${ag.listing.city}, ${ag.listing.country}` : ""}
          </Text>
          <View style={styles.partyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.partyLabel}>Homeowner</Text>
              <Text style={styles.partyName}>{ag.owner?.name ?? "—"}</Text>
            </View>
            <Ionicons name="swap-horizontal" size={18} color={colors.muted} />
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={styles.partyLabel}>Tenant</Text>
              <Text style={styles.partyName}>{ag.tenant?.name ?? "—"}</Text>
            </View>
          </View>
          <View style={styles.termsRow}>
            <Term label="Rent" value={`${fmt(ag.rent_amount)} ${PERIOD_LABEL[ag.period]}`} />
            <Term label="Tenure" value={`${ag.tenure_months} months`} />
            <Term label="Move-in total" value={fmt((ag.rent_amount ?? 0) + (ag.fees ?? []).reduce((s, f) => s + (f.amount ?? 0), 0))} />
          </View>
        </View>

        {/* Progress checklist */}
        {isPending && (
          <View style={styles.card} testID="agreement-progress">
            <Text style={styles.cardTitle}>Activation checklist</Text>
            {steps.map((s) => (
              <View key={s.label} style={styles.stepRow}>
                <Ionicons name={s.done ? "checkmark-circle" : "ellipse-outline"} size={18} color={s.done ? colors.success : s.mine ? colors.brandPrimary : colors.muted} />
                <Text style={[styles.stepText, s.mine && !s.done && { color: colors.brandPrimary, fontWeight: "800" }]}>
                  {s.label}
                  {s.mine && !s.done ? " — your turn" : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Terms editing (owner, pending, unsigned) */}
        {isPending && isOwner && !ag.owner_signed && !editing && (
          <Button testID="agreement-edit-terms" title="Adjust terms (rent, tenure, fees)" icon="create-outline" variant="secondary" small onPress={beginEdit} />
        )}
        {editing && (
          <View style={styles.card} testID="agreement-edit-form">
            <Text style={styles.cardTitle}>Agreement terms</Text>
            <Text style={styles.fieldLabel}>Monthly/periodic rent ({ag.currency})</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputPrefix}>{ag.currency_symbol}</Text>
              <TextInput testID="agreement-rent-input" value={rent} onChangeText={setRent} keyboardType="numeric" style={styles.input} placeholderTextColor={colors.muted} />
              <Text style={styles.inputSuffix}>{PERIOD_LABEL[ag.period]}</Text>
            </View>
            <Text style={styles.fieldLabel}>Tenure (months)</Text>
            <View style={styles.tenureRow}>
              <Pressable testID="agreement-tenure-minus" onPress={() => setTenure((t) => Math.max(1, t - 1))} style={styles.tenureBtn}>
                <Ionicons name="remove" size={18} color={colors.onSurface} />
              </Pressable>
              <Text style={styles.tenureValue} testID="agreement-tenure-value">{tenure} mo</Text>
              <Pressable testID="agreement-tenure-plus" onPress={() => setTenure((t) => Math.min(120, t + 1))} style={styles.tenureBtn}>
                <Ionicons name="add" size={18} color={colors.onSurface} />
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>Fees & charges</Text>
            {(fees ?? []).map((f, i) => {
              const locked = f.key === "app_fee";
              return (
                <View key={`${f.key}-${i}`} style={styles.feeEditCard} testID={`agreement-fee-edit-${i}`}>
                  <TextInput
                    testID={`agreement-fee-label-${i}`}
                    value={f.label}
                    onChangeText={(v) => setFees((fs) => (fs ?? []).map((x, xi) => (xi === i ? { ...x, label: v } : x)))}
                    editable={!locked}
                    style={[styles.feeLabelInput, locked && { color: colors.muted }]}
                    placeholderTextColor={colors.muted}
                  />
                  <View style={styles.feeEditRow}>
                    {AMOUNT_TYPES.map((t) => (
                      <Pressable
                        key={t.key}
                        testID={`agreement-fee-${i}-type-${t.key}`}
                        disabled={locked}
                        onPress={() => setFees((fs) => (fs ?? []).map((x, xi) => (xi === i ? { ...x, amount_type: t.key } : x)))}
                        style={[styles.typeChip, f.amount_type === t.key && styles.typeChipOn]}
                      >
                        <Text style={[styles.typeChipText, f.amount_type === t.key && styles.typeChipTextOn]}>{t.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.inputRow}>
                    {f.amount_type === "flat" ? <Text style={styles.inputPrefix}>{ag.currency_symbol}</Text> : null}
                    <TextInput
                      testID={`agreement-fee-value-${i}`}
                      value={f.value}
                      onChangeText={(v) => setFees((fs) => (fs ?? []).map((x, xi) => (xi === i ? { ...x, value: v } : x)))}
                      editable={!locked}
                      keyboardType="numeric"
                      style={[styles.input, { flex: 1 }]}
                      placeholderTextColor={colors.muted}
                    />
                    {f.amount_type !== "flat" ? <Text style={styles.inputSuffix}>%</Text> : null}
                  </View>
                  {f.key === "service_charge" && (
                    <TextInput
                      testID={`agreement-fee-amenities-${i}`}
                      value={f.amenities}
                      onChangeText={(v) => setFees((fs) => (fs ?? []).map((x, xi) => (xi === i ? { ...x, amenities: v } : x)))}
                      placeholder="Covered amenities (comma separated)"
                      placeholderTextColor={colors.muted}
                      style={styles.feeInput}
                    />
                  )}
                  {!locked && (
                    <Pressable testID={`agreement-fee-negotiable-${i}`} onPress={() => setFees((fs) => (fs ?? []).map((x, xi) => (xi === i ? { ...x, negotiable: !x.negotiable } : x)))} style={styles.negotiableRow}>
                      <Ionicons name={f.negotiable ? "checkmark-circle" : "ellipse-outline"} size={16} color={f.negotiable ? colors.success : colors.muted} />
                      <Text style={styles.feeHint}>Negotiable by tenant</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button testID="agreement-save-terms" title="Save terms" loading={saveTerms.isPending} onPress={() => saveTerms.mutate()} style={{ flex: 1 }} />
              <Button title="Cancel" variant="ghost" onPress={() => setFees(null)} />
            </View>
          </View>
        )}

        {/* Fees summary (read-only) */}
        {!editing && (ag.fees ?? []).length > 0 && (
          <View style={styles.card} testID="agreement-fees">
            <Text style={styles.cardTitle}>Fees & charges</Text>
            {(ag.fees ?? []).map((f) => (
              <View key={f.fee_id} style={styles.feeRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.feeName}>{f.label}</Text>
                  {f.key === "app_fee" && <Text style={styles.feeHint}>Compulsory · non-negotiable</Text>}
                  {f.amenities?.length > 0 && <Text style={styles.feeAmenity}>Covers: {f.amenities.join(", ")}</Text>}
                </View>
                <Text style={styles.feeAmount}>{fmt(f.amount ?? 0)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Contract text */}
        <View style={styles.card} testID="agreement-contract">
          <Text style={styles.cardTitle}>Agreement text</Text>
          <Text style={styles.contractText} selectable>
            {ag.contract_text ?? "Contract text unavailable."}
          </Text>
        </View>

        {/* Actions */}
        {isPending && (
          <Glass strong style={styles.actionBar}>
            <View style={{ gap: spacing.sm }}>
              {!mySigned ? (
                <Button
                  testID="agreement-sign-button"
                  title={isOwner ? "Sign as homeowner" : "Sign as tenant"}
                  icon="create"
                  loading={sign.isPending}
                  onPress={() => sign.mutate()}
                />
              ) : (
                <View style={styles.signedRow} testID="agreement-signed-note">
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.signedText}>You have signed this agreement.</Text>
                </View>
              )}
              <Button
                testID="agreement-payment-button"
                title={myPaid ? "Payment confirmed — tap to undo" : "I confirm payment was received"}
                icon={myPaid ? "checkmark-done" : "cash-outline"}
                variant={myPaid ? "secondary" : "primary"}
                loading={payment.isPending}
                onPress={() => payment.mutate(!myPaid)}
              />
              <Text style={styles.actionHint}>
                Both signatures and both payment confirmations are required before the tenancy activates and the residence is locked for the tenure period.
              </Text>
            </View>
          </Glass>
        )}
      </ScrollView>
    </View>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.term}>
      <Text style={styles.termLabel}>{label}</Text>
      <Text style={styles.termValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors, r) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider, position: "relative", overflow: "hidden" },
  headerTitle: { fontFamily: fonts.family, fontSize: r.ms(18), fontWeight: "800", color: colors.onSurface },
  scroll: { padding: spacing.lg, gap: spacing.lg, width: "100%", maxWidth: r.contentMaxWidth, alignSelf: "center" },
  statusBanner: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.accentLemon, borderRadius: radius.lg, padding: spacing.lg, alignItems: "flex-start" },
  statusTitle: { fontFamily: fonts.family, fontSize: r.ms(16), fontWeight: "800", color: colors.onAccentLemon },
  statusSub: { fontFamily: fonts.family, fontSize: r.ms(13), color: colors.onAccentLemon, marginTop: 2, lineHeight: r.ms(18) },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  cardTitle: { fontFamily: fonts.family, fontSize: r.ms(16), fontWeight: "800", color: colors.onSurface, marginBottom: 2 },
  cardSub: { fontFamily: fonts.family, fontSize: r.ms(13), color: colors.muted },
  partyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  partyLabel: { fontFamily: fonts.family, fontSize: r.ms(10), fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  partyName: { fontFamily: fonts.family, fontSize: r.ms(15), fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  termsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  term: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, gap: 2 },
  termLabel: { fontFamily: fonts.family, fontSize: r.ms(10), fontWeight: "800", color: colors.muted, textTransform: "uppercase" },
  termValue: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "800", color: colors.onSurface },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepText: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "600", color: colors.onSurfaceSecondary, flex: 1 },
  fieldLabel: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "800", color: colors.onSurfaceSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 50, gap: spacing.sm },
  inputPrefix: { fontFamily: fonts.family, fontSize: r.ms(16), fontWeight: "800", color: colors.onSurface },
  inputSuffix: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "700", color: colors.muted },
  input: { flex: 1, fontFamily: fonts.family, fontSize: r.ms(16), fontWeight: "700", color: colors.onSurface, height: 50 },
  tenureRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignSelf: "flex-start" },
  tenureBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  tenureValue: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "800", color: colors.onSurface, minWidth: 60, textAlign: "center" },
  feeEditCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  feeLabelInput: { fontFamily: fonts.family, fontSize: r.ms(15), fontWeight: "800", color: colors.onSurface },
  feeEditRow: { flexDirection: "row", gap: spacing.sm },
  typeChip: { flex: 1, height: 34, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  typeChipOn: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  typeChipText: { fontFamily: fonts.family, fontSize: r.ms(11), fontWeight: "700", color: colors.onSurface },
  typeChipTextOn: { color: colors.onSurfaceInverse },
  feeInput: { fontFamily: fonts.family, fontSize: r.ms(13), color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 44 },
  negotiableRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  feeHint: { fontFamily: fonts.family, fontSize: r.ms(11), color: colors.muted },
  feeRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingVertical: spacing.xs },
  feeName: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "700", color: colors.onSurface },
  feeAmenity: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.brandPrimary, fontWeight: "600", marginTop: 2 },
  feeAmount: { fontFamily: fonts.family, fontSize: r.ms(14), fontWeight: "800", color: colors.onSurface },
  contractText: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.onSurfaceSecondary, lineHeight: r.ms(19), backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  actionBar: { borderRadius: radius.lg, padding: spacing.lg },
  signedRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, justifyContent: "center", paddingVertical: spacing.sm },
  signedText: { fontFamily: fonts.family, fontSize: r.ms(13), fontWeight: "700", color: colors.success },
  actionHint: { fontFamily: fonts.family, fontSize: r.ms(11), color: colors.muted, textAlign: "center", lineHeight: r.ms(16) },
}));
