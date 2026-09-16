// Design tokens for this app. Light theme only.Always modify the colors and theme to Dark, Light or Dark and Light according to the design guidelines.
//
// The keys match the "color" block of /app/design_guidelines.json. Fill the
// values from that file (or from the user's brand colors). Keep every key; do
// not add a second theme or colors file; do not write color literals in
// components.
//
// How the names work: a plain key is a background, and its `on` partner is the
// text or icon color that sits on top of it. Always use them as a pair.
//   <View style={{ backgroundColor: colors.brandPrimary }}>
//     <Text style={{ color: colors.onBrandPrimary }}>Continue</Text>
//   </View>
//
// Styling a screen or component: build the sheet with makeStyles so colors
// and layout live together and follow the active scheme:
//   const useStyles = makeStyles((colors) => ({
//     card: { backgroundColor: colors.surfaceSecondary, padding: 16 },
//     title: { color: colors.onSurfaceSecondary, fontSize: 16 },
//   }));
//   function Screen() {
//     const styles = useStyles();
//     return <View style={styles.card}><Text style={styles.title}>Hi</Text></View>;
//   }
// For color props that are not styles (icon color, placeholderTextColor,
// ActivityIndicator) read useTheme().colors inside the component.
// Never call StyleSheet.create with color values at module level; it cannot
// follow the scheme.
//
// To support dark mode later: add `dark` to `themes` with every key filled.
// Nothing else changes; the device setting takes over automatically.
// Feel free to add as many new colors as you need to support the design guidelines.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FCFCF9",
  onSurface: "#1A1C19",
  surfaceSecondary: "#F2F3EC",
  onSurfaceSecondary: "#1A1C19",
  surfaceTertiary: "#E5E7E0",
  onSurfaceTertiary: "#1A1C19",
  surfaceInverse: "#1A1C19",
  onSurfaceInverse: "#FCFCF9",
  muted: "#70736B",

  brand: "#00C896",
  onBrand: "#FFFFFF",
  brandPrimary: "#00A87D",
  onBrandPrimary: "#FCFCF9",
  brandSecondary: "#F4D03F",
  onBrandSecondary: "#1A1C19",
  brandTertiary: "#E0F7F1",
  onBrandTertiary: "#005C45",

  success: "#27AE60",
  onSuccess: "#FFFFFF",
  warning: "#F1C40F",
  onWarning: "#1A1C19",
  error: "#E74C3C",
  onError: "#FFFFFF",
  info: "#2C3E50",
  onInfo: "#FFFFFF",

  border: "#E5E7E0",
  borderStrong: "#C2C6BC",
  divider: "#E5E7E0",

  // Sundry Gen-Z accents (no blue / purple / orange per design guidelines)
  accentPink: "#FFB3D9",
  onAccentPink: "#5C1F3F",
  accentLemon: "#FFF3B0",
  onAccentLemon: "#5C4A00",
  accentMint: "#B8F2E6",
  onAccentMint: "#005C45",
  whatsapp: "#25D366",

  // Glass layers
  glass: "rgba(252,252,249,0.72)",
  glassStrong: "rgba(252,252,249,0.88)",
  glassBorder: "rgba(255,255,255,0.65)",
  glassDark: "rgba(26,28,25,0.45)",
  scrim: "rgba(26,28,25,0.55)",
  overlay: "rgba(26,28,25,0.35)",
  shadow: "#1A1C19",
};

export const fonts = {
  family: "PlusJakartaSans",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 } as const;
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

// In-app theme toggle, only after `dark` exists in `themes`. Call
// setColorScheme("dark"), setColorScheme("light"), or setColorScheme(null) to
// follow the device. Every useTheme() consumer re-renders. Persisting the
// choice and re-applying it on launch is the toggle's job.
export function setColorScheme(scheme: ColorScheme | null) {
  // RN 0.86 re-reads the device scheme only for the literal "unspecified";
  // null would pin useColorScheme() to null and the app to light.
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Keep native surfaces (alerts, pickers, navigation chrome) on the schemes this
// app ships: light only forces light; once `dark` exists the device decides.
// Optional call because react-native-web does not implement it.
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

// Themed StyleSheet: returns a hook that builds the sheet from the active
// scheme's colors and memoizes it until the scheme changes.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}


