import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1F2937",
          borderTopColor: "#374151",
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#3B82F6",
        tabBarInactiveTintColor: "#9CA3AF",
      }}
    >
      <Tabs.Screen
        name="receive"
        options={{
          title: "Scan Receive",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="download" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="release"
        options={{
          title: "Scan Release",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="upload-file" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
