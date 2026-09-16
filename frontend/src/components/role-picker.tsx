import React from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import type { Role } from "@/src/api";

export function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const opts: { role: Role; title: string; desc: string; icon: any; bg: string; fg: string }[] = [
    { role: "tenant", title: "I'm a tenant", desc: "Find homes & make offers", icon: "key", bg: colors.accentMint, fg: colors.onAccentMint },
    { role: "homeowner", title: "I'm a homeowner", desc: "List homes & get offers", icon: "home", bg: colors.accentLemon, fg: colors.onAccentLemon },
  ];
  return (
    <View style={styles.row}>
      {opts.map((o) => {
        const sel = value === o.role;
        return (
          <Pressable
            key={o.role}
            testID={`role-option-${o.role}`}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(o.role);
            }}
            style={[styles.card, { backgroundColor: o.bg, borderColor: sel ? colors.surfaceInverse : "transparent" }]}
          >
            <View style={styles.top}>
              <Ionicons name={o.icon} size={22} color={o.fg} />
              {sel && <Ionicons name="checkmark-circle" size={20} color={colors.surfaceInverse} />}
            </View>
            <Text style={[styles.title, { color: o.fg }]}>{o.title}</Text>
            <Text style={[styles.desc, { color: o.fg }]}>{o.desc}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: "row", gap: spacing.md },
  card: { flex: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs, borderWidth: 2, minHeight: 110 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  title: { fontFamily: fonts.family, fontSize: 15, fontWeight: "800" },
  desc: { fontFamily: fonts.family, fontSize: 12, fontWeight: "600", opacity: 0.85 },
}));
