import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type QuickChipItem = {
  id: string;
  label: string;
  subLabel?: string;
  icon?: string;
  badge?: string;
  active?: boolean;
};

export type QuickChipsProps = {
  title?: string;
  items: QuickChipItem[];
  onSelect: (item: QuickChipItem) => void;
  emptyText?: string;
};

export const QuickChips = React.memo(function QuickChips({
  title = "⚡ สลับด่วน (Quick Switch):",
  items,
  onSelect,
  emptyText,
}: QuickChipsProps) {
  if (items.length === 0) {
    if (!emptyText) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {items.map((item) => {
          const isActive = !!item.active;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              {item.icon ? (
                <Text style={styles.chipIcon}>{item.icon}</Text>
              ) : null}
              <View style={styles.chipTextContainer}>
                <Text
                  style={[styles.chipLabel, isActive && styles.chipLabelActive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {item.subLabel ? (
                  <Text
                    style={[
                      styles.chipSubLabel,
                      isActive && styles.chipSubLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {item.subLabel}
                  </Text>
                ) : null}
              </View>
              {item.badge ? (
                <View
                  style={[styles.badge, isActive && styles.badgeActive]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      isActive && styles.badgeTextActive,
                    ]}
                  >
                    {item.badge}
                  </Text>
                </View>
              ) : null}
              {isActive ? (
                <Text style={styles.activeCheck}>✓</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  scrollContent: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  chipActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  chipIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  chipTextContainer: {
    justifyContent: "center",
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  chipLabelActive: {
    color: "#1D4ED8",
    fontWeight: "700",
  },
  chipSubLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 1,
  },
  chipSubLabelActive: {
    color: "#2563EB",
  },
  badge: {
    marginLeft: 6,
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeActive: {
    backgroundColor: "#DBEAFE",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4B5563",
    textTransform: "uppercase",
  },
  badgeTextActive: {
    color: "#1E40AF",
  },
  activeCheck: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },
  emptyContainer: {
    paddingVertical: 4,
  },
  emptyText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
});
