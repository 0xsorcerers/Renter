import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { Button, Field } from "@/src/components/ui";
import { Glass } from "@/src/components/glass";
import { useToast } from "@/src/components/toast";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { loginWithPassword, loginWithGoogle, googleBusy } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return toast.show("Enter your email and password", "error");
    setBusy(true);
    try {
      await loginWithPassword(email.trim(), password);
    } catch (e: any) {
      toast.show(e.message ?? "Login failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="login-screen">
      <LinearGradient colors={[colors.accentMint, colors.surface, colors.accentLemon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bg} />
      <View style={[styles.blob, styles.blobA]} />
      <View style={[styles.blob, styles.blobB]} />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing["3xl"], paddingBottom: insets.bottom + spacing.xl }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.brandRow}>
          <Image source={require("../../assets/images/logo.png")} style={styles.logo} contentFit="cover" testID="login-logo" />
          <Text style={styles.brand}>Renter</Text>
          <Text style={styles.tagline}>Homes without the middlemen.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify().damping(18)}>
          <Glass strong style={styles.card}>
            <View style={styles.cardInner}>
              <Text style={styles.title}>Welcome back</Text>
              <Field
                testID="login-email-input"
                label="Email"
                icon="mail"
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
              <Field
                testID="login-password-input"
                label="Password"
                icon="lock-closed"
                placeholder="••••••••"
                secureTextEntry={!showPw}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={submit}
                right={
                  <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={8} testID="login-toggle-password">
                    <Ionicons name={showPw ? "eye-off" : "eye"} size={18} color={colors.muted} />
                  </Pressable>
                }
              />
              <Button testID="login-submit-button" title="Log in" onPress={submit} loading={busy} />
              <View style={styles.orRow}>
                <View style={styles.line} />
                <Text style={styles.or}>or</Text>
                <View style={styles.line} />
              </View>
              <Button testID="login-google-button" title="Continue with Google" icon="logo-google" variant="ghost" onPress={loginWithGoogle} loading={googleBusy} />
            </View>
          </Glass>
        </Animated.View>

        <Pressable testID="go-to-register-button" onPress={() => router.push("/(auth)/register")} style={styles.footer}>
          <Text style={styles.footerText}>
            New here? <Text style={styles.footerLink}>Create an account</Text>
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors, r) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  bg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  blob: { position: "absolute", width: 260, height: 260, borderRadius: 130, opacity: 0.55 },
  blobA: { backgroundColor: colors.accentPink, top: -80, right: -70 },
  blobB: { backgroundColor: colors.brand, bottom: 40, left: -120 },
  scroll: { paddingHorizontal: spacing.xl, gap: spacing.xl, width: "100%", maxWidth: r.contentMaxWidth, alignSelf: "center" },
  brandRow: { alignItems: "flex-start", gap: spacing.sm },
  logo: { width: 84, height: 84, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder },
  brand: { fontFamily: fonts.family, fontSize: r.ms(40), fontWeight: "800", color: colors.onSurface, letterSpacing: -1 },
  tagline: { fontFamily: fonts.family, fontSize: r.ms(16), color: colors.onSurfaceSecondary, fontWeight: "600" },
  card: { borderRadius: radius.lg + 8 },
  cardInner: { padding: spacing.xl, gap: spacing.lg },
  title: { fontFamily: fonts.family, fontSize: r.ms(24), fontWeight: "800", color: colors.onSurface },
  orRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { fontFamily: fonts.family, color: colors.muted, fontSize: r.ms(12), fontWeight: "700" },
  footer: { alignItems: "center", paddingVertical: spacing.md },
  footerText: { fontFamily: fonts.family, fontSize: r.ms(15), color: colors.onSurfaceSecondary },
  footerLink: { color: colors.brandPrimary, fontWeight: "800" },
}));
