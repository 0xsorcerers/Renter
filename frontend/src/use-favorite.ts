import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api, type Listing } from "./api";
import { useToast } from "./components/toast";

/** Toggle a listing's favourite state with optimistic updates across all listing caches. */
export function useFavorite() {
  const qc = useQueryClient();
  const toast = useToast();

  const patch = (listingId: string, favorited: boolean) => {
    qc.setQueriesData<Listing[]>({ queryKey: ["listings"] }, (old) => old?.map((l) => (l.listing_id === listingId ? { ...l, is_favorited: favorited } : l)));
    qc.setQueriesData<Listing>({ queryKey: ["listing", listingId] }, (old) => (old ? { ...old, is_favorited: favorited } : old));
    qc.setQueriesData<Listing[]>({ queryKey: ["favorites"] }, (old) =>
      favorited ? old : old?.filter((l) => l.listing_id !== listingId),
    );
  };

  return useMutation({
    mutationFn: (vars: { listingId: string; next: boolean }) => api<{ favorited: boolean }>(`/listings/${vars.listingId}/favorite`, { method: "POST" }),
    onMutate: (vars) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      patch(vars.listingId, vars.next);
    },
    onError: (e: any, vars) => {
      patch(vars.listingId, !vars.next);
      toast.show(e.message ?? "Could not update favourites", "error");
    },
    onSuccess: (res, vars) => {
      if (res.favorited) toast.show("Saved to your favourites", "success");
      qc.invalidateQueries({ queryKey: ["favorites"] });
      qc.invalidateQueries({ queryKey: ["listing", vars.listingId] });
    },
  });
}
