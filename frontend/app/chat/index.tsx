import React from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image } from "expo-image";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { api, fileUrl, type Conversation } from "@/src/api";
import { Avatar, EmptyState, IconButton, RoleBadge } from "@/src/components/ui";
import { LineArt } from "@/src/components/line-art";

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "now";
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

export default function Inbox() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convs = useQuery({ queryKey: ["conversations"], queryFn: () => api<Conversation[]>("/conversations"), refetchInterval: 8000 });

  return (
    <View style={styles.root} testID="inbox-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <LineArt name="chat" opacity={0.28} align="center" />
        <View style={styles.headerRow}>
          <IconButton testID="inbox-back-button" icon="chevron-back" onPress={() => router.back()} bg={colors.glassStrong} />
          <Text style={styles.title}>Messages</Text>
          <View style={{ width: 44 }} />
        </View>
      </View>
      <FlatList
        data={convs.data ?? []}
        keyExtractor={(c) => c.conversation_id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        refreshing={convs.isLoading}
        onRefresh={convs.refetch}
        renderItem={({ item }) => (
          <Pressable testID={`conversation-${item.conversation_id}`} onPress={() => router.push(`/chat/${item.conversation_id}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
            <Avatar uri={item.other?.picture} name={item.other?.name} size={50} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.other?.name ?? "User"}
                </Text>
                <Text style={styles.time}>{timeAgo(item.last_message_at)}</Text>
              </View>
              <Text style={styles.listing} numberOfLines={1}>
                {item.listing?.title ?? "Listing"}
              </Text>
              <Text style={[styles.preview, item.unread > 0 && styles.previewUnread]} numberOfLines={1}>
                {item.last_message || "Say hello 👋"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              {item.listing?.photos?.[0] ? <Image source={{ uri: fileUrl(item.listing.photos[0]) }} style={styles.thumb} contentFit="cover" /> : <RoleBadge role={item.other?.role} />}
              {item.unread > 0 && (
                <View style={styles.unread} testID={`conversation-unread-${item.conversation_id}`}>
                  <Text style={styles.unreadText}>{item.unread}</Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          convs.isLoading ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
          ) : (
            <EmptyState icon="chatbubbles-outline" title="No conversations yet" subtitle="Chats open when a homeowner accepts an offer, or when a homeowner messages a tenant who made one." testID="inbox-empty" />
          )
        }
      />
    </View>
  );
}

const useStyles = makeStyles((colors, r) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, position: "relative", overflow: "hidden", minHeight: 150 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.family, fontSize: r.ms(22), fontWeight: "800", color: colors.onSurface },
  list: { padding: spacing.lg, gap: spacing.md, width: "100%", maxWidth: r.contentMaxWidth, alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { fontFamily: fonts.family, fontSize: r.ms(15), fontWeight: "800", color: colors.onSurface, flex: 1 },
  time: { fontFamily: fonts.family, fontSize: r.ms(11), color: colors.muted },
  listing: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.brandPrimary, fontWeight: "700" },
  preview: { fontFamily: fonts.family, fontSize: r.ms(13), color: colors.muted },
  previewUnread: { color: colors.onSurface, fontWeight: "700" },
  thumb: { width: 44, height: 44, borderRadius: radius.md },
  unread: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  unreadText: { fontFamily: fonts.family, fontSize: r.ms(11), fontWeight: "800", color: colors.onBrandPrimary },
}));
