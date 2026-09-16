import React from "react";
import { Linking, StyleProp, View, ViewStyle } from "react-native";

import { spacing } from "@/src/theme";
import { Button } from "./ui";
import { useToast } from "./toast";

function digits(n: string) {
  return (n || "").replace(/[^\d+]/g, "");
}

export function ContactButtons({ phone, whatsapp, style, small, message }: { phone?: string; whatsapp?: string; style?: StyleProp<ViewStyle>; small?: boolean; message?: string }) {
  const toast = useToast();
  const wa = digits(whatsapp || "");
  const tel = digits(phone || "");
  return (
    <View style={[{ flexDirection: "row", gap: spacing.sm }, style]}>
      <Button
        testID="contact-whatsapp-button"
        title="WhatsApp"
        icon="logo-whatsapp"
        variant="whatsapp"
        small={small}
        style={{ flex: 1 }}
        onPress={() => {
          if (!wa) return toast.show("No WhatsApp number on this profile", "error");
          Linking.openURL(`https://wa.me/${wa.replace("+", "")}${message ? `?text=${encodeURIComponent(message)}` : ""}`).catch(() =>
            toast.show("Could not open WhatsApp", "error"),
          );
        }}
      />
      <Button
        testID="contact-call-button"
        title="Call"
        icon="call"
        variant="dark"
        small={small}
        style={{ flex: 1 }}
        onPress={() => {
          if (!tel) return toast.show("No phone number on this profile", "error");
          Linking.openURL(`tel:${tel}`).catch(() => toast.show("Could not start a call", "error"));
        }}
      />
    </View>
  );
}
