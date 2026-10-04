import React from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type ProductivityMetricsBarProps = {
  totalScans: number;
  scanVelocitySpm: number;
  currentCategoryLabel: string;
  currentCategoryCount: number;
  soundEnabled: boolean;
  soundBoosted: boolean;
  onResetTally: () => void;
  onToggleSoundBoost: () => void;
  onToggleSoundMute: () => void;
};

export const ProductivityMetricsBar: React.FC<ProductivityMetricsBarProps> = ({
  totalScans,
  scanVelocitySpm,
  currentCategoryLabel,
  currentCategoryCount,
  soundEnabled,
  soundBoosted,
  onResetTally,
  onToggleSoundBoost,
  onToggleSoundMute,
}) => {
  const handleConfirmReset = () => {
    Alert.alert(
      "รีเซ็ตยอดกะ (Reset Shift)",
      `ยอดสะสมปัจจุบัน: ${totalScans} ชิ้น\nคุณต้องการรีเซ็ตตัวนับยอดกะนี้เป็น 0 ใช่หรือไม่?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "รีเซ็ต",
          style: "destructive",
          onPress: onResetTally,
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Metric 1: Shift Total */}
      <View style={styles.metricItem}>
        <Text style={styles.metricLabel}>📦 ยอดกะนี้</Text>
        <Text style={styles.metricValue}>{totalScans}</Text>
      </View>

      <View style={styles.divider} />

      {/* Metric 2: Scan Velocity (SPM) */}
      <View style={styles.metricItem}>
        <Text style={styles.metricLabel}>⚡ ความเร็ว</Text>
        <Text
          style={[
            styles.metricValue,
            scanVelocitySpm > 20 && styles.metricValueHighVelocity,
          ]}
        >
          {scanVelocitySpm}{" "}
          <Text style={styles.metricUnit}>SPM</Text>
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Metric 3: Active Category (Lot / Customer) */}
      <View style={[styles.metricItem, styles.metricItemFlex]}>
        <Text style={styles.metricLabel} numberOfLines={1}>
          🏷️ {currentCategoryLabel || "ปัจจุบัน"}
        </Text>
        <Text style={styles.metricValueCategory}>
          {currentCategoryCount} <Text style={styles.metricUnit}>ชิ้น</Text>
        </Text>
      </View>

      {/* Action Buttons: Sound Booster & Reset */}
      <View style={styles.actionsContainer}>
        {/* Sound Toggle & Booster Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            soundBoosted && styles.actionButtonBoosted,
            !soundEnabled && styles.actionButtonMuted,
          ]}
          onPress={onToggleSoundBoost}
          onLongPress={onToggleSoundMute}
          activeOpacity={0.7}
          delayLongPress={400}
        >
          <Text style={styles.actionButtonText}>
            {!soundEnabled ? "🔇" : soundBoosted ? "🔊⚡" : "🔊"}
          </Text>
        </TouchableOpacity>

        {/* Reset Shift Tally Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleConfirmReset}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    justifyContent: "space-between",
  },
  metricItem: {
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  metricItemFlex: {
    flex: 1,
    paddingHorizontal: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#F3F4F6",
    fontFamily: "monospace",
  },
  metricValueHighVelocity: {
    color: "#34D399", // Emerald green for fast pace
  },
  metricValueCategory: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FCD34D", // Gold
    fontFamily: "monospace",
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: "#374151",
    marginHorizontal: 4,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 4,
  },
  actionButton: {
    backgroundColor: "#374151",
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#4B5563",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonBoosted: {
    backgroundColor: "rgba(245, 158, 11, 0.25)",
    borderColor: "#F59E0B",
  },
  actionButtonMuted: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#EF4444",
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
