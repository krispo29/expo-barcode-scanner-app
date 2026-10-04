import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { TrackingCodeText } from "./TrackingCodeText";

export type BannerStatusType = "idle" | "success" | "warning" | "error";

export type GlanceableHeroBannerProps = {
  statusType: BannerStatusType;
  title: string;
  trackingCode?: string;
  subtitle?: string;
  badgeLabel?: string;
  badgeType?: "air" | "sea" | "warning" | "success" | "error" | "default";
  onActionPress?: () => void;
  actionText?: string;
};

export function GlanceableHeroBanner({
  statusType,
  title,
  trackingCode,
  subtitle,
  badgeLabel,
  badgeType = "default",
  onActionPress,
  actionText,
}: GlanceableHeroBannerProps) {
  const isSuccess = statusType === "success";
  const isWarning = statusType === "warning";
  const isError = statusType === "error";

  const containerStyle = [
    styles.container,
    isSuccess && styles.containerSuccess,
    isWarning && styles.containerWarning,
    isError && styles.containerError,
  ];

  const iconText = isSuccess
    ? "✅"
    : isWarning
      ? "⚠️"
      : isError
        ? "🚫"
        : "🟢";

  return (
    <View style={containerStyle}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.icon}>{iconText}</Text>
          <Text
            style={[
              styles.title,
              isSuccess && styles.titleSuccess,
              isWarning && styles.titleWarning,
              isError && styles.titleError,
            ]}
          >
            {title}
          </Text>
        </View>

        {badgeLabel && (
          <View
            style={[
              styles.badge,
              badgeType === "air" && styles.badgeAir,
              badgeType === "sea" && styles.badgeSea,
              badgeType === "warning" && styles.badgeWarning,
              badgeType === "error" && styles.badgeError,
              badgeType === "success" && styles.badgeSuccess,
            ]}
          >
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        )}
      </View>

      {trackingCode ? (
        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>Tracking: </Text>
          <TrackingCodeText
            code={trackingCode}
            style={styles.codeText}
            highlightStyle={styles.codeHighlight}
          />
        </View>
      ) : null}

      <View style={styles.bottomRow}>
        {subtitle ? (
          <Text
            style={[
              styles.subtitle,
              isWarning && styles.subtitleWarning,
              isError && styles.subtitleError,
            ]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : (
          <View />
        )}

        {onActionPress && actionText ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onActionPress}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>{actionText}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F8FAFC",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  containerSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },
  containerWarning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#F59E0B",
  },
  containerError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  icon: {
    fontSize: 18,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
  },
  titleSuccess: {
    color: "#065F46",
  },
  titleWarning: {
    color: "#92400E",
  },
  titleError: {
    color: "#991B1B",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
  },
  badgeAir: {
    backgroundColor: "#3B82F6",
  },
  badgeSea: {
    backgroundColor: "#0D9488",
  },
  badgeWarning: {
    backgroundColor: "#F59E0B",
  },
  badgeError: {
    backgroundColor: "#EF4444",
  },
  badgeSuccess: {
    backgroundColor: "#10B981",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
    flexWrap: "wrap",
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  codeText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
  },
  codeHighlight: {
    fontSize: 19,
    fontWeight: "800",
    color: "#D97706",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    flex: 1,
    marginRight: 8,
  },
  subtitleWarning: {
    color: "#B45309",
    fontWeight: "600",
  },
  subtitleError: {
    color: "#DC2626",
    fontWeight: "600",
  },
  actionButton: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
