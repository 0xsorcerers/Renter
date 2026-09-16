import { Linking, Platform, Share } from "react-native";

import type { Listing } from "./api";
import { formatPrice, PERIOD_LABEL } from "./currency";

export function listingShareMessage(l: Listing) {
  const price = `${formatPrice(l.price, l.currency_symbol, l.currency)} ${PERIOD_LABEL[l.period]} (${l.currency})`;
  const maps = `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;
  const app = `renter://listing/${l.listing_id}`;
  return `\u{1F3E0} ${l.title}\n${price}\n\u{1F4CD} ${l.address}\n\nView on Renter: ${app}\nMap: ${maps}\n\nNo agents, no hidden fees \u2014 direct from the homeowner.`;
}

/** Native share sheet; on web falls back to WhatsApp share link. */
export async function shareListing(l: Listing) {
  const message = listingShareMessage(l);
  if (Platform.OS === "web") {
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    if (nav?.share) {
      try {
        await nav.share({ title: l.title, text: message });
        return;
      } catch {
        // user cancelled or unsupported -> fall through
      }
    }
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
    return;
  }
  await Share.share({ message, title: l.title });
}

export async function shareListingWhatsApp(l: Listing) {
  await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(listingShareMessage(l))}`);
}
