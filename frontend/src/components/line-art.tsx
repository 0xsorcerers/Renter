import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/src/theme";

export type ArtName = "welcome" | "explore" | "saved" | "activity" | "profile" | "chat" | "create" | "rented";

const ART: Record<ArtName, any> = {
  welcome: require("../../assets/images/art/welcome.jpg"),
  explore: require("../../assets/images/art/explore.jpg"),
  saved: require("../../assets/images/art/saved.jpg"),
  activity: require("../../assets/images/art/activity.jpg"),
  profile: require("../../assets/images/art/profile.jpg"),
  chat: require("../../assets/images/art/chat.jpg"),
  create: require("../../assets/images/art/create.jpg"),
  rented: require("../../assets/images/art/rented.jpg"),
};

type Props = {
  name: ArtName;
  /** 0-1 strength of the artwork */
  opacity?: number;
  style?: StyleProp<ViewStyle>;
  /** fade the artwork into the surface at the bottom */
  fade?: boolean;
  align?: "bottom" | "center" | "top";
  fit?: "cover" | "contain";
};

/** Exhibition-style line-art backdrop. Absolutely positioned; place as the first child of a relative container. */
export function LineArt({ name, opacity = 0.35, style, fade = true, align = "bottom", fit = "cover" }: Props) {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }, style]}>
      <Image
        source={ART[name]}
        style={{ width: "100%", height: "100%", opacity }}
        contentFit={fit}
        contentPosition={align}
        transition={400}
      />
      {fade && <LinearGradient colors={["transparent", colors.surface]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "45%" }} />}
    </View>
  );
}

/** Small framed artwork used as an empty-state illustration. */
export function ArtFrame({ name, size = 180, testID }: { name: ArtName; size?: number; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ width: size, height: size, borderRadius: 24, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <Image source={ART[name]} style={{ width: "100%", height: "100%" }} contentFit="cover" />
    </View>
  );
}
