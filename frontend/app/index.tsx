import { ActivityIndicator, View } from "react-native";

import { useTheme } from "@/src/theme";

// Root route: the auth gate in _layout redirects to login or tabs.
export default function Index() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator color={colors.brandPrimary} />
    </View>
  );
}
