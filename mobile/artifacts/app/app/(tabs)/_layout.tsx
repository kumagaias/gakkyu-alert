import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ icon }: { icon: string }) {
  return <Text style={{ fontSize: 22 }}>{icon}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1a56db",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#e5e7eb",
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "ホーム",
          tabBarIcon: () => <TabIcon icon="🏠" />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "地域マップ",
          tabBarIcon: () => <TabIcon icon="🗺️" />,
        }}
      />
    </Tabs>
  );
}
