import React from "react";
import { Platform, View } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import Ionicons from "@react-native-vector-icons/ionicons";

import { usesNativeTabs } from "@/src/navigation";
import { useTheme, fonts } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="map.fill" />
          <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="saved">
          <NativeTabs.Trigger.Icon sf="heart.fill" />
          <NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="activity">
          <NativeTabs.Trigger.Icon sf="bolt.fill" />
          <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf="person.fill" />
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.family, fontSize: 11, fontWeight: "700" },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.OS === "web" ? colors.glassStrong : "transparent",
          borderTopWidth: 1,
          borderTopColor: colors.glassBorder,
          elevation: 0,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarBackground: () => (
          <View style={{ flex: 1, overflow: "hidden" }}>
            <BlurView
              intensity={50}
              tint="light"
              experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
              style={{ flex: 1, backgroundColor: colors.glass }}
            />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Explore", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "map" : "map-outline"} size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: "Saved", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "heart" : "heart-outline"} size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="activity"
        options={{ title: "Activity", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "flash" : "flash-outline"} size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} /> }}
      />
    </Tabs>
  );
}
