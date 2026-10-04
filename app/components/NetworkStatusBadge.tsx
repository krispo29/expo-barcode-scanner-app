import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type NetworkStatusBadgeProps = {
  isOnline: boolean;
  isTestMode?: boolean;
};

export const NetworkStatusBadge: React.FC<NetworkStatusBadgeProps> = ({
  isOnline,
  isTestMode = false,
}) => {
  if (isTestMode) {
    return (
      <View style={[styles.badge, styles.badgeTest]}>
        <View style={[styles.dot, styles.dotTest]} />
        <Text style={[styles.text, styles.textTest]}>TEST</Text>
      </View>
    );
  }

  if (isOnline) {
    return (
      <View style={[styles.badge, styles.badgeOnline]}>
        <View style={[styles.dot, styles.dotOnline]} />
        <Text style={[styles.text, styles.textOnline]}>ONLINE</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, styles.badgeOffline]}>
      <View style={[styles.dot, styles.dotOffline]} />
      <Text style={[styles.text, styles.textOffline]}>OFFLINE</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  badgeOnline: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  dotOnline: {
    backgroundColor: "#10B981",
  },
  textOnline: {
    color: "#34D399",
  },
  badgeOffline: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  dotOffline: {
    backgroundColor: "#EF4444",
  },
  textOffline: {
    color: "#F87171",
  },
  badgeTest: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  dotTest: {
    backgroundColor: "#F59E0B",
  },
  textTest: {
    color: "#FBBF24",
  },
});
