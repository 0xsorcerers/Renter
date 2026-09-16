import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { Button, Field, IconButton } from "@/src/components/ui";
import { Glass } from "@/src/components/glass";
import { useToast } from "@/src/components/toast";
import { RolePicker } from "@/src/components/role-picker";
import type { Role } from "@/src/api";

export default function Register() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", whatsapp: "" });
  const [role, setRole] = useState<Role>("tenant");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      return toast.show("Fill name, email and a 6+ character password", "error");
    }
    setBusy(true);
    try {
      await register({ ...form, email: form.email.trim(), name: form.name.trim(), role });
    } catch (e: any) {
      toast.show(e.message ?? "Could not create account", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="register-screen">
      <LinearGradient colors={[colors.accentLemon, colors.surface, colors.accentMint]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bg} />
      <View style={[styles.blob, styles.blobA]} />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <IconButton testID="register-back-button" icon="chevron-back" onPress={() => router.back()} bg={colors.glassStrong} />
          <Text style={styles.title}>Join Renter</Text>
        </View>
        <Text style={styles.subtitle}>Pick how you&apos;ll use the app. You can switch later in your profile.</Text>
        <RolePicker value={role} onChange={setRole} />

        <Glass strong style={styles.card}>
          <View style={styles.cardInner}>
            <Field testID="register-name-input" label="Full name" icon="person" placeholder="Ada Lovelace" value={form.name} onChangeText={set("name")} />
            <Field
              testID="register-email-input"
              label="Email"
              icon="mail"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={form.email}
              onChangeText={set("email")}
            />
            <Field testID="register-password-input" label="Password" icon="lock-closed" placeholder="6+ characters" secureTextEntry value={form.password} onChangeText={set("password")} />
            <Field testID="register-phone-input" label="Phone number" icon="call" placeholder="+234 801 234 5678" keyboardType="phone-pad" value={form.phone} onChangeText={set("phone")} />
            <Field
              testID="register-whatsapp-input"
              label="WhatsApp number"
              icon="logo-whatsapp"
              placeholder="+234 801 234 5678"
              keyboardType="phone-pad"
              value={form.whatsapp}
              onChangeText={set("whatsapp")}
              right={
                <Pressable onPress={() => setForm((f) => ({ ...f, whatsapp: f.phone }))} hitSlop={8} testID="register-copy-phone">
                  <Text style={styles.sameLink}>Same as phone</Text>
                </Pressable>
              }
            />
            <Button testID="register-submit-button" title={role === "homeowner" ? "Start listing homes" : "Start finding homes"} onPress={submit} loading={busy} />
          </View>
        </Glass>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors, r) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  bg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  blob: { position: "absolute", width: 240, height: 240, borderRadius: 120, opacity: 0.5 },
  blobA: { backgroundColor: colors.accentPink, top: 80, right: -100 },
  scroll: { paddingHorizontal: spacing.xl, gap: spacing.lg, width: "100%", maxWidth: r.contentMaxWidth, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { fontFamily: fonts.family, fontSize: r.ms(28), fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.family, fontSize: r.ms(15), color: colors.onSurfaceSecondary },
  card: { borderRadius: radius.lg + 8 },
  cardInner: { padding: spacing.xl, gap: spacing.lg },
  sameLink: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "700", color: colors.brandPrimary },
}));
