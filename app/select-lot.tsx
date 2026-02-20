import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type LotNo = {
  code: string;
  refLotNo: string;
  company: string;
  countryCode: string;
  shippingTypeCode: string;
  createdAt: string;
};

type ApiResponse<T = any> = {
  code: number;
  message?: string;
  data: T;
};

export default function SelectLotScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lotNos, setLotNos] = useState<LotNo[]>([]);

  useEffect(() => {
    loadLotNos();
  }, []);

  const loadLotNos = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const endpoint = `${apiUrl}/v1/lot_nos`;

      console.log("Fetching Lot Nos from:", endpoint);

      const response = await axios.get<ApiResponse<LotNo[]>>(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data && response.data.code === 200) {
        setLotNos(response.data.data);
      } else {
        Alert.alert(
          "Error",
          response.data.message || "Failed to load Lot Numbers",
        );
      }
    } catch (error: any) {
      console.error("Load Lot Nos error:", error);
      if (error?.response?.status === 401) {
        router.replace("/login");
      } else {
        Alert.alert("Error", "Failed to connect to server");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLot = async (lot: LotNo) => {
    try {
      await AsyncStorage.setItem("selected_lot", JSON.stringify(lot));
      console.log("Selected Lot:", lot);
      router.replace("/(tabs)/release");
    } catch (error) {
      console.error("Save lot error:", error);
      Alert.alert("Error", "Failed to save selection");
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("access_token");
      await AsyncStorage.removeItem("user_data");
      await AsyncStorage.removeItem("token_expires_at");
      await AsyncStorage.removeItem("selected_lot");
      router.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const renderItem = ({ item }: { item: LotNo }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleSelectLot(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <Text style={styles.lotText}>{item.code}</Text>
        <Text style={styles.noteText}>Ref: {item.refLotNo || "-"}</Text>
        <Text style={styles.dateText}>{item.createdAt}</Text>
      </View>
      <Text style={styles.arrow}>{">"}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Lot No.</Text>
        <Text style={styles.headerSubtitle}>
          กรุณาเลือก Lot Number ก่อนเริ่มงาน
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#3B82F6"
            style={{ marginTop: 40 }}
          />
        ) : (
          <FlatList
            data={lotNos}
            renderItem={renderItem}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>ไม่พบข้อมูล Lot Number</Text>
                <TouchableOpacity
                  onPress={loadLotNos}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>ลองใหม่</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>

      {/* Footer / Logout */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1F2937",
  },
  header: {
    padding: 20,
    backgroundColor: "#374151",
    borderBottomWidth: 1,
    borderBottomColor: "#4B5563",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#D1D5DB",
  },
  content: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
  },
  lotText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  noteText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  arrow: {
    fontSize: 20,
    color: "#9CA3AF",
    marginLeft: 10,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#3B82F6",
    borderRadius: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  footer: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  logoutButton: {
    alignItems: "center",
    padding: 15,
  },
  logoutText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "500",
  },
});
