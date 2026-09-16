import React from "react";
import { Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { fileUrl } from "@/src/api";

export function VideoTour({ uri, testID }: { uri: string; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const player = useVideoPlayer(fileUrl(uri), (p) => {
    p.loop = true;
    p.muted = true;
  });
  return (
    <View style={styles.wrap} testID={testID}>
      <VideoView player={player} style={styles.video} contentFit="cover" nativeControls allowsPictureInPicture={false} />
      <View style={styles.badge} pointerEvents="none">
        <Ionicons name="videocam" size={14} color={colors.onSurfaceInverse} />
        <Text style={styles.badgeText}>Virtual tour</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors, r) => ({
  wrap: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceInverse, position: "relative" },
  video: { width: "100%", aspectRatio: 16 / 9 },
  badge: { position: "absolute", top: spacing.md, left: spacing.md, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.glassDark, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 28 },
  badgeText: { fontFamily: fonts.family, fontSize: r.ms(12), fontWeight: "800", color: colors.onSurfaceInverse },
}));
