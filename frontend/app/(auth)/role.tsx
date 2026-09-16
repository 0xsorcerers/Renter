import React, { useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { makeStyles, useTheme, fonts, spacing } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { api, type Role, type User } from "@/src/api";
import { Button, Field } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { RolePicker } from "@/src/components/role-picker";

export default function RoleScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, setUser, logout } = useAuth();
  const [role, setRole] = useState<Role>("tenant");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const u = await api<User>("/users/me", { method: "PUT", body: { role, phone, whatsapp } });
      setUser(u);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="role-screen">
      <LinearGradient colors={[colors.accentMint, colors.surface]} style={styles.bg} />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing.xl }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hi}>Hey {user?.name?.split(" ")[0] ?? "there"} 👋</Text>
        <Text style={styles.title}>How will you use Renter?</Text>
        <RolePicker value={role} onChange={setRole} />
        <Field testID="role-phone-input" label="Phone number" icon="call" placeholder="+1 555 123 4567" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <Field testID="role-whatsapp-input" label="WhatsApp number" icon="logo-whatsapp" placeholder="+1 555 123 4567" keyboardType="phone-pad" value={whatsapp} onChangeText={setWhatsapp} />
        <Button testID="role-submit-button" title="Continue" onPress={submit} loading={busy} />
        <Button testID="role-logout-button" title="Use a different account" variant="ghost" onPress={logout} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  bg: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
  scroll: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  hi: { fontFamily: fonts.family, fontSize: 16, color: colors.onSurfaceSecondary, fontWeight: "600" },
  title: { fontFamily: fonts.family, fontSize: 30, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5, marginBottom: spacing.sm },
}));
