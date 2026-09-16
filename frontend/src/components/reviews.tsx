import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { makeStyles, useTheme, fonts, radius, spacing } from "@/src/theme";
import { api, type Review } from "@/src/api";
import { Avatar, RoleBadge, Button } from "./ui";
import { useToast } from "./toast";

export function Stars({ rating, size = 14, onChange, testID }: { rating: number; size?: number; onChange?: (n: number) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={4} testID={onChange ? `star-${n}` : undefined}>
          <Ionicons name={n <= rating ? "star" : "star-outline"} size={size} color={n <= rating ? colors.brandSecondary : colors.borderStrong} />
        </Pressable>
      ))}
    </View>
  );
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export function ReviewCard({ review, showListing }: { review: Review; showListing?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");

  const reply = useMutation({
    mutationFn: () => api(`/reviews/${review.review_id}/replies`, { method: "POST", body: { text } }),
    onSuccess: () => {
      setText("");
      setReplying(false);
      qc.invalidateQueries({ queryKey: ["reviews"] });
      toast.show("Reply posted", "success");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  return (
    <View style={styles.card} testID={`review-${review.review_id}`}>
      <View style={styles.head}>
        <Pressable onPress={() => review.author && router.push(`/user/${review.author.user_id}`)} style={styles.authorRow}>
          <Avatar uri={review.author?.picture} name={review.author?.name} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{review.author?.name ?? "Tenant"}</Text>
            <Text style={styles.time}>{timeAgo(review.created_at)}</Text>
          </View>
        </Pressable>
        <Stars rating={review.rating} />
      </View>
      {showListing && review.listing && (
        <Pressable onPress={() => router.push(`/listing/${review.listing!.listing_id}`)}>
          <Text style={styles.listingRef}>on “{review.listing.title}”</Text>
        </Pressable>
      )}
      <Text style={styles.text}>{review.text}</Text>

      {review.replies?.length > 0 && (
        <View style={styles.thread}>
          {review.replies.map((r) => (
            <View key={r.reply_id} style={styles.replyBubble} testID={`reply-${r.reply_id}`}>
              <View style={styles.replyHead}>
                <Avatar uri={r.author?.picture} name={r.author?.name} size={24} />
                <Text style={styles.replyName}>{r.author?.name ?? "User"}</Text>
                <RoleBadge role={r.author?.role} />
                <Text style={styles.time}>{timeAgo(r.created_at)}</Text>
              </View>
              <Text style={styles.replyText}>{r.text}</Text>
            </View>
          ))}
        </View>
      )}

      {replying ? (
        <View style={styles.replyBox}>
          <TextInput
            testID={`reply-input-${review.review_id}`}
            value={text}
            onChangeText={setText}
            placeholder="Write a reply…"
            placeholderTextColor={colors.muted}
            style={styles.replyInput}
            multiline
          />
          <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
            <Button title="Cancel" variant="ghost" small onPress={() => setReplying(false)} testID={`reply-cancel-${review.review_id}`} />
            <Button title="Post" small loading={reply.isPending} disabled={!text.trim()} onPress={() => reply.mutate()} testID={`reply-submit-${review.review_id}`} />
          </View>
        </View>
      ) : (
        <Pressable testID={`reply-button-${review.review_id}`} onPress={() => setReplying(true)} style={styles.replyLink} hitSlop={8}>
          <Ionicons name="arrow-undo" size={14} color={colors.brandPrimary} />
          <Text style={styles.replyLinkText}>Reply</Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  name: { fontFamily: fonts.family, fontSize: 14, fontWeight: "800", color: colors.onSurface },
  time: { fontFamily: fonts.family, fontSize: 11, color: colors.muted },
  listingRef: { fontFamily: fonts.family, fontSize: 12, color: colors.brandPrimary, fontWeight: "700" },
  text: { fontFamily: fonts.family, fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 20 },
  thread: { marginLeft: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.brandTertiary, paddingLeft: spacing.md, gap: spacing.sm, marginTop: spacing.xs },
  replyBubble: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: 6 },
  replyHead: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  replyName: { fontFamily: fonts.family, fontSize: 13, fontWeight: "700", color: colors.onSurface },
  replyText: { fontFamily: fonts.family, fontSize: 13, color: colors.onSurfaceSecondary, lineHeight: 18 },
  replyBox: { gap: spacing.sm },
  replyInput: {
    fontFamily: fonts.family,
    fontSize: 14,
    color: colors.onSurface,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.border,
  },
  replyLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 4 },
  replyLinkText: { fontFamily: fonts.family, fontSize: 13, fontWeight: "700", color: colors.brandPrimary },
}));
