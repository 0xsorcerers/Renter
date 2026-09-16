import React from "react";
import { Platform, StyleProp, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";

import { makeStyles, useTheme } from "@/src/theme";

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  dark?: boolean;
  strong?: boolean;
  testID?: string;
};

/** Frosted glass surface: expo-blur with a translucent tint and hairline border. */
export function Glass({ children, style, intensity = 40, dark, strong, testID }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tint = dark ? colors.glassDark : strong ? colors.glassStrong : colors.glass;
  return (
    <View testID={testID} style={[styles.wrap, { borderColor: dark ? colors.overlay : colors.glassBorder }, style]}>
      <BlurView
        intensity={intensity}
        tint={dark ? "dark" : "light"}
        experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
        style={[styles.fill, { backgroundColor: tint }]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  content: { position: "relative" },
}));
