import React, { useEffect, useRef } from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";

import { makeStyles, fonts, radius, spacing } from "@/src/theme";

export type MapPin = { id: string; lat: number; lng: number; label: string; selected?: boolean };

type Props = {
  pins: MapPin[];
  center?: { lat: number; lng: number };
  zoomDelta?: number;
  onPinPress?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
  testID?: string;
};

export function AppMap({ pins, center, zoomDelta = 0.08, onPinPress, style, interactive = true, testID }: Props) {
  const styles = useStyles();
  const ref = useRef<MapView>(null);
  const focus = center ?? (pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 6.5244, lng: 3.3792 });
  const region: Region = { latitude: focus.lat, longitude: focus.lng, latitudeDelta: zoomDelta, longitudeDelta: zoomDelta };

  useEffect(() => {
    ref.current?.animateToRegion(region, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.lat, focus.lng]);

  return (
    <View testID={testID} style={[styles.wrap, style]}>
      <MapView
        ref={ref}
        style={styles.map}
        initialRegion={region}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        showsPointsOfInterests={false}
      >
        {pins.map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} onPress={() => onPinPress?.(p.id)} tracksViewChanges={false}>
            <View style={[styles.pin, p.selected && styles.pinSelected]}>
              <Text style={[styles.pinText, p.selected && styles.pinTextSelected]}>{p.label}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  map: { width: "100%", height: "100%" },
  pin: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  pinSelected: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  pinText: { fontFamily: fonts.family, fontSize: 12, fontWeight: "800", color: colors.onSurface },
  pinTextSelected: { color: colors.brandSecondary },
}));
