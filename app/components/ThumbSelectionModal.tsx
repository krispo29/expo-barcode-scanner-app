import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ThumbModalItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    variant?: "blue" | "green" | "amber" | "gray" | "purple";
  };
  selected?: boolean;
};

export type ThumbFilterTab = {
  key: string;
  label: string;
};

export type ThumbSelectionModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  items: ThumbModalItem[];
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (text: string) => void;
  tabs?: ThumbFilterTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  onSelectItem: (item: ThumbModalItem) => void;
  onClose: () => void;
  emptyText?: string;
  loading?: boolean;
};

// Memoized item row to eliminate unnecessary re-renders in large lists (500-700 items)
export const ThumbModalItemRow = React.memo(function ThumbModalItemRow({
  item,
  onSelect,
}: {
  item: ThumbModalItem;
  onSelect: (item: ThumbModalItem) => void;
}) {
  const isSelected = !!item.selected;
  const badgeVariant = item.badge?.variant || "gray";

  return (
    <TouchableOpacity
      style={[styles.itemCard, isSelected && styles.itemCardSelected]}
      onPress={() => onSelect(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.itemMain}>
        <View style={styles.itemTitleRow}>
          <Text
            style={[styles.itemTitle, isSelected && styles.itemTitleSelected]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {item.badge ? (
            <View
              style={[
                styles.itemBadge,
                badgeVariant === "blue" && styles.badgeBlue,
                badgeVariant === "green" && styles.badgeGreen,
                badgeVariant === "amber" && styles.badgeAmber,
                badgeVariant === "purple" && styles.badgePurple,
              ]}
            >
              <Text
                style={[
                  styles.itemBadgeText,
                  badgeVariant === "blue" && styles.badgeTextBlue,
                  badgeVariant === "green" && styles.badgeTextGreen,
                  badgeVariant === "amber" && styles.badgeTextAmber,
                  badgeVariant === "purple" && styles.badgeTextPurple,
                ]}
              >
                {item.badge.text}
              </Text>
            </View>
          ) : null}
        </View>
        {item.subtitle ? (
          <Text
            style={[
              styles.itemSubtitle,
              isSelected && styles.itemSubtitleSelected,
            ]}
            numberOfLines={2}
          >
            {item.subtitle}
          </Text>
        ) : null}
      </View>
      {isSelected ? (
        <View style={styles.checkContainer}>
          <Text style={styles.checkText}>✓</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

export function ThumbSelectionModal({
  visible,
  title,
  subtitle,
  items,
  searchPlaceholder = "ค้นหา...",
  searchValue,
  onSearchChange,
  tabs,
  activeTab,
  onTabChange,
  onSelectItem,
  onClose,
  emptyText = "ไม่พบข้อมูลที่ตรงกับคำค้นหา",
  loading = false,
}: ThumbSelectionModalProps) {
  const insets = useSafeAreaInsets();

  // Local search text for instant typing feedback (0ms latency)
  const [localSearch, setLocalSearch] = useState(searchValue);

  // Synchronize when parent searchValue changes (e.g. modal opens/resets)
  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  // Debounce search update to parent (150ms) to keep scrolling and typing buttery smooth
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchValue) {
        onSearchChange(localSearch);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [localSearch, searchValue, onSearchChange]);

  const handleClearSearch = useCallback(() => {
    setLocalSearch("");
    onSearchChange("");
  }, [onSearchChange]);

  const renderItem = useCallback(
    ({ item }: { item: ThumbModalItem }) => (
      <ThumbModalItemRow item={item} onSelect={onSelectItem} />
    ),
    [onSelectItem],
  );

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    ),
    [emptyText],
  );

  const keyExtractor = useCallback((item: ThumbModalItem) => item.id, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* Backdrop touchable to close modal when tapping outside */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="ปิดหน้าต่าง"
        />

        {/* Full-height Bottom Sheet container */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="ปิดหน้าต่าง"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Tabs (Optional, e.g. All / Air / Sea) */}
          {tabs && tabs.length > 0 && onTabChange ? (
            <View style={styles.tabContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabScroll}
              >
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      style={[styles.tab, isActive && styles.tabActive]}
                      onPress={() => onTabChange(tab.key)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          isActive && styles.tabTextActive,
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor="#9CA3AF"
              value={localSearch}
              onChangeText={setLocalSearch}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="never"
            />
            {localSearch.length > 0 && (
              <TouchableOpacity
                style={styles.clearSearchBtn}
                onPress={handleClearSearch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="ล้างข้อความค้นหา"
              >
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Items Summary Count */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {loading
                ? "กำลังโหลดข้อมูล..."
                : `พบทั้งหมด ${items.length} รายการ`}
            </Text>
          </View>

          {/* Virtualized Items List with FlatList */}
          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ItemSeparatorComponent={renderSeparator}
            ListEmptyComponent={renderEmpty}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            removeClippedSubviews={Platform.OS === "android"}
          />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "92%",
    maxHeight: "94%",
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4B5563",
  },
  tabContainer: {
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  tabScroll: {
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tabActive: {
    backgroundColor: "#1E40AF",
    borderColor: "#1E40AF",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
    color: "#9CA3AF",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    paddingVertical: 6,
  },
  clearSearchBtn: {
    padding: 6,
  },
  clearSearchText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "700",
  },
  summaryRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  separator: {
    height: 8,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 54,
  },
  itemCardSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
    borderWidth: 2,
  },
  itemMain: {
    flex: 1,
    marginRight: 10,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    flexShrink: 1,
  },
  itemTitleSelected: {
    color: "#1D4ED8",
  },
  itemSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
  },
  itemSubtitleSelected: {
    color: "#2563EB",
  },
  itemBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
  },
  badgeBlue: {
    backgroundColor: "#DBEAFE",
  },
  badgeTextBlue: {
    color: "#1E40AF",
  },
  badgeGreen: {
    backgroundColor: "#D1FAE5",
  },
  badgeTextGreen: {
    color: "#065F46",
  },
  badgeAmber: {
    backgroundColor: "#FEF3C7",
  },
  badgeTextAmber: {
    color: "#92400E",
  },
  badgePurple: {
    backgroundColor: "#F3E8FF",
  },
  badgeTextPurple: {
    color: "#6B21A8",
  },
  itemBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#374151",
  },
  checkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
