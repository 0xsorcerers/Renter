import React, { useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { api, uploadImage, type Role, type User } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { Avatar, Button, Field, IconButton } from "@/src/components/ui";
import { Glass } from "@/src/components/glass";
import { useToast } from "@/src/components/toast";
import { RolePicker } from "@/src/components/role-picker";

const STICKY_H = 92;

export default function EditProfile() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name ?? "",
    bio: user?.bio ?? "",
    phone: user?.phone ?? "",
    whatsapp: user?.whatsapp ?? "",
    city: user?.city ?? "",
    country: user?.country ?? "",
    picture: user?.picture ?? "",
  });
  const [role, setRole] = useState<Role>(user?.role ?? "tenant");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [permissionHelp, setPermissionHelp] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const pickAvatar = async () => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      if (current.canAskAgain) status = (await ImagePicker.requestMediaLibraryPermissionsAsync()).status;
      if (status !== "granted") return setPermissionHelp(true);
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled) return;
    setUploading(true);
    try {
      const a = res.assets[0];
      const up = await uploadImage(a.uri, a.fileName ?? "avatar.jpg", a.mimeType ?? "image/jpeg");
      setForm((f) => ({ ...f, picture: up.url }));
    } catch (e: any) {
      toast.show(e.message ?? "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) return toast.show("Name can't be empty", "error");
    setBusy(true);
    try {
      const u = await api<User>("/users/me", { method: "PUT", body: { ...form, role } });
      setUser(u);
      toast.show("Profile saved", "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="edit-profile-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton testID="edit-profile-back" icon="close" onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAwareScrollView contentContainerStyle={[styles.scroll, { paddingBottom: STICKY_H + insets.bottom + spacing.xl }]} bottomOffset={STICKY_H + 24} keyboardShouldPersistTaps="handled">
        <Pressable testID="edit-avatar-button" onPress={pickAvatar} style={styles.avatarBtn}>
          <Avatar uri={form.picture} name={form.name} size={96} />
          <View style={styles.avatarBadge}>{uploading ? <ActivityIndicator color={colors.onBrandPrimary} size="small" /> : <Ionicons name="camera" size={16} color={colors.onBrandPrimary} />}</View>
        </Pressable>
        <Text style={styles.label}>I am a…</Text>
        <RolePicker value={role} onChange={setRole} />
        <Field testID="edit-name-input" label="Full name" icon="person" value={form.name} onChangeText={set("name")} />
        <Field testID="edit-bio-input" label="Bio & background" placeholder="Tell people who you are, what you do, and what you're looking for or offering." value={form.bio} onChangeText={set("bio")} multiline style={{ minHeight: 110 }} />
        <Field testID="edit-phone-input" label="Phone number" icon="call" keyboardType="phone-pad" value={form.phone} onChangeText={set("phone")} />
        <Field
          testID="edit-whatsapp-input"
          label="WhatsApp number"
          icon="logo-whatsapp"
          keyboardType="phone-pad"
          value={form.whatsapp}
          onChangeText={set("whatsapp")}
          right={
            <Pressable onPress={() => setForm((f) => ({ ...f, whatsapp: f.phone }))} hitSlop={8} testID="edit-copy-phone">
              <Text style={styles.sameLink}>Same as phone</Text>
            </Pressable>
          }
        />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field testID="edit-city-input" label="City" icon="location" value={form.city} onChangeText={set("city")} />
          </View>
          <View style={{ flex: 1 }}>
            <Field testID="edit-country-input" label="Country" icon="flag" value={form.country} onChangeText={set("country")} />
          </View>
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }} style={styles.stickyWrap}>
        <Glass strong style={styles.sticky}>
          <View style={[styles.stickyInner, { paddingBottom: insets.bottom + spacing.sm }]}>
            <Button testID="edit-profile-save-button" title="Save changes" icon="checkmark" onPress={save} loading={busy} style={{ flex: 1 }} />
          </View>
        </Glass>
      </KeyboardStickyView>

      <Modal visible={permissionHelp} animationType="fade" transparent onRequestClose={() => setPermissionHelp(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPermissionHelp(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.sheetTitle}>Allow photo access</Text>
          <Text style={styles.sheetBody}>Renter uses your photo library to set a profile picture. Enable it in Settings.</Text>
          <Button title="Open Settings" icon="settings-outline" onPress={() => Linking.openSettings()} testID="open-settings-button" />
          <Button title="Not now" variant="ghost" onPress={() => setPermissionHelp(false)} />
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors, r) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { fontFamily: fonts.family, fontSize: r.ms(18), fontWeight: "800", color: colors.onSurface },
  scroll: { padding: spacing.lg, gap: spacing.lg, width: "100%", maxWidth: r.contentMaxWidth, alignSelf: "center" },
  avatarBtn: { alignSelf: "center", position: "relative" },
  avatarBadge: { position: "absolute", right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.surface },
  label: { fontFamily: fonts.family, fontSize: r.ms(13), fontWeight: "700", color: colors.onSurfaceSecondary, marginLeft: spacing.xs, marginBottom: -spacing.sm },
  sameLink: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "700", color: colors.brandPrimary },
  stickyWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sticky: { borderTopLeftRadius: radius.lg + 4, borderTopRightRadius: radius.lg + 4, borderBottomWidth: 0 },
  stickyInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg + 8, borderTopRightRadius: radius.lg + 8, padding: spacing.xl, gap: spacing.md },
  sheetTitle: { fontFamily: fonts.family, fontSize: r.ms(20), fontWeight: "800", color: colors.onSurface },
  sheetBody: { fontFamily: fonts.family, fontSize: r.ms(14), color: colors.onSurfaceSecondary, lineHeight: r.ms(20) },
}));
