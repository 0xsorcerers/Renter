import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usesNativeTabs } from "@/src/navigation";

/**
 * Bottom clearance for content inside tab screens.
 * NativeTabs: insets.bottom already includes the floating bar.
 * JS <Tabs> (absolute, translucent): default bar height 49 + bottom inset (web: fixed 64).
 */
export function useTabBottomChrome() {
  const insets = useSafeAreaInsets();
  if (usesNativeTabs) return insets.bottom;
  if (Platform.OS === "web") return 64;
  return 49 + insets.bottom;
}
