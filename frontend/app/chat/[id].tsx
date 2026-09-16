import React, { useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { api, type Conversation, type Message } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { Avatar, IconButton } from "@/src/components/ui";
import { Glass } from "@/src/components/glass";
import { LineArt } from "@/src/components/line-art";
import { useToast } from "@/src/components/toast";

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const listRef = useRef<FlatList<Message>>(null);

  const conv = useQuery({ queryKey: ["conversation", id], queryFn: () => api<Conversation>(`/conversations/${id}`) });
  const messages = useQuery({
    queryKey: ["messages", id],
    queryFn: () => api<Message[]>(`/conversations/${id}/messages`),
    refetchInterval: 4000,
  });

  const send = useMutation({
    mutationFn: (t: string) => api<Message>(`/conversations/${id}/messages`, { method: "POST", body: { text: t } }),
    onMutate: (t) => {
      const optimistic: Message = { message_id: `tmp_${Date.now()}`, conversation_id: id!, sender_id: user!.user_id, text: t, created_at: new Date().toISOString() };
      qc.setQueryData<Message[]>(["messages", id], (old) => [...(old ?? []), optimistic]);
      setText("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: any) => {
      toast.show(e.message ?? "Message failed", "error");
      qc.invalidateQueries({ queryKey: ["messages", id] });
    },
  });

  const data = [...(messages.data ?? [])].reverse();
  const other = conv.data?.other;

  return (
    <View style={styles.root} testID="chat-screen">
      <LineArt name="chat" opacity={0.16} fade={false} align="center" fit="contain" />
      <Glass strong style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <IconButton testID="chat-back-button" icon="chevron-back" onPress={() => router.back()} bg={colors.surfaceSecondary} />
          <Pressable style={styles.headerUser} onPress={() => other && router.push(`/user/${other.user_id}`)} testID="chat-other-profile">
            <Avatar uri={other?.picture} name={other?.name} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {other?.name ?? "…"}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {conv.data?.listing?.title ?? ""}
              </Text>
            </View>
          </Pressable>
          <IconButton testID="chat-open-listing" icon="home-outline" onPress={() => conv.data && router.push(`/listing/${conv.data.listing_id}`)} bg={colors.surfaceSecondary} />
        </View>
      </Glass>

      <KeyboardAvoidingView behavior="translate-with-padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          inverted
          data={data}
          keyExtractor={(m) => m.message_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.user_id;
            return (
              <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]} testID={`message-${item.message_id}`}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                  <Text style={[styles.msg, mine && styles.msgMine]}>{item.text}</Text>
                  <Text style={[styles.time, mine && styles.timeMine]}>{fmtTime(item.created_at)}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            messages.isLoading ? (
              <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>This is the start of your conversation about “{conv.data?.listing?.title ?? "this home"}”. Be kind, be clear. 🏠</Text>
              </View>
            )
          }
        />
        <Glass strong style={styles.composer}>
          <View style={[styles.composerInner, { paddingBottom: insets.bottom + spacing.sm }]}>
            <TextInput
              testID="chat-input"
              value={text}
              onChangeText={setText}
              placeholder="Type a message…"
              placeholderTextColor={colors.muted}
              style={styles.input}
              multiline
              maxLength={2000}
            />
            <Pressable
              testID="chat-send-button"
              disabled={!text.trim() || send.isPending}
              onPress={() => send.mutate(text.trim())}
              style={[styles.sendBtn, (!text.trim() || send.isPending) && { opacity: 0.5 }]}
            >
              <Ionicons name="arrow-up" size={22} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        </Glass>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors, r) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderRadius: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  headerUser: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { fontFamily: fonts.family, fontSize: r.ms(15), fontWeight: "800", color: colors.onSurface },
  sub: { fontFamily: fonts.family, fontSize: r.ms(12), color: colors.brandPrimary, fontWeight: "700" },
  list: { padding: spacing.lg, gap: spacing.sm, width: "100%", maxWidth: r.contentMaxWidth, alignSelf: "center" },
  bubbleRow: { flexDirection: "row", justifyContent: "flex-start" },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "80%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: radius.lg, gap: 2 },
  bubbleOther: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  bubbleMine: { backgroundColor: colors.brandPrimary, borderTopRightRadius: radius.sm },
  msg: { fontFamily: fonts.family, fontSize: r.ms(15), color: colors.onSurface, lineHeight: r.ms(21) },
  msgMine: { color: colors.onBrandPrimary },
  time: { fontFamily: fonts.family, fontSize: r.ms(10), color: colors.muted, alignSelf: "flex-end" },
  timeMine: { color: colors.brandTertiary },
  emptyWrap: { padding: spacing.xl, alignItems: "center" },
  emptyText: { fontFamily: fonts.family, fontSize: r.ms(14), color: colors.muted, textAlign: "center", lineHeight: r.ms(20) },
  composer: { borderTopLeftRadius: radius.lg + 4, borderTopRightRadius: radius.lg + 4, borderBottomWidth: 0 },
  composerInner: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontFamily: fonts.family, fontSize: r.ms(15), color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
