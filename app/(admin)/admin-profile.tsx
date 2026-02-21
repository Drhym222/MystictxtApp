import React from "react";
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

export default function AdminProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  async function handleLogout() {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    await logout();
    router.replace("/");
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 118 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="shield-checkmark" size={36} color={Colors.dark.accent} />
          </View>
          <Text style={styles.email}>{user?.email || "Admin"}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Legacy Admin</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuPressed]}
            onPress={() => router.push("/(admin)/dashboard")}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "rgba(212, 168, 83, 0.15)" }]}>
                <Ionicons name="grid-outline" size={20} color={Colors.dark.accent} />
              </View>
              <Text style={styles.menuLabel}>Dashboard</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.dark.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuPressed]}
            onPress={() => router.push("/(admin)/admin-orders")}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "rgba(52, 152, 219, 0.15)" }]}>
                <Ionicons name="receipt-outline" size={20} color="#3498DB" />
              </View>
              <Text style={styles.menuLabel}>Manage Orders</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.dark.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuPressed]}
            onPress={() => router.push("/(admin)/notifications")}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "rgba(76, 175, 80, 0.15)" }]}>
                <Ionicons name="notifications-outline" size={20} color={Colors.dark.success} />
              </View>
              <Text style={styles.menuLabel}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.dark.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.menuSection}>
          <Pressable
            style={({ pressed }) => [styles.menuItem, styles.logoutItem, pressed && styles.menuPressed]}
            onPress={handleLogout}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "rgba(231, 76, 60, 0.15)" }]}>
                <Ionicons name="log-out-outline" size={20} color={Colors.dark.error} />
              </View>
              <Text style={[styles.menuLabel, { color: Colors.dark.error }]}>Sign Out</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 22,
    color: Colors.dark.text,
  },
  content: {
    paddingHorizontal: 20,
    gap: 24,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(212, 168, 83, 0.1)",
    borderWidth: 2,
    borderColor: Colors.dark.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  roleBadge: {
    backgroundColor: "rgba(212, 168, 83, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: Colors.dark.accent,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  menuSection: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  menuPressed: {
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.dark.text,
  },
});
