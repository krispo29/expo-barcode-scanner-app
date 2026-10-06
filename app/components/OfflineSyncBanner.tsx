import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type OfflineSyncBannerProps = {
  count: number;
  syncing?: boolean;
  onSync: () => void;
  onClear?: () => void;
};

export const OfflineSyncBanner = React.memo(function OfflineSyncBanner({
  count,
  syncing = false,
  onSync,
  onClear,
}: OfflineSyncBannerProps) {
  if (count <= 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>⏳</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>
          มี {count} รายการรอซิงค์ขึ้นระบบ
        </Text>
        <Text style={styles.subtitle}>
          บันทึกในเครื่องแล้ว สามารถกดส่งข้อมูลเมื่อมีเน็ต
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
          onPress={onSync}
          disabled={syncing}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`ซิงค์ข้อมูล ${count} รายการ`}
        >
          {syncing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.syncButtonText}>⚡ ซิงค์ทันที</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  icon: {
    fontSize: 18,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
  },
  subtitle: {
    fontSize: 11,
    color: "#B45309",
    marginTop: 2,
    lineHeight: 15,
  },
  actions: {
    justifyContent: "center",
  },
  syncButton: {
    backgroundColor: "#D97706",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 40,
    minWidth: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  syncButtonDisabled: {
    backgroundColor: "#FBBF24",
  },
  syncButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
