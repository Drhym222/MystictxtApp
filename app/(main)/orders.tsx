import React from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  pending: { color: Colors.dark.statusPending, icon: "time-outline", label: "Pending" },
  paid: { color: Colors.dark.statusPaid, icon: "checkmark-circle-outline", label: "Paid" },
  delivered: { color: Colors.dark.statusDelivered, icon: "gift-outline", label: "Delivered" },
  cancelled: { color: Colors.dark.statusCancelled, icon: "close-circle-outline", label: "Cancelled" },
};

function OrderCard({ order }: { order: any }) {
  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const date = new Date(order.createdAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/order/[id]", params: { id: order.id } })}
      style={({ pressed }) => [styles.orderCard, pressed && styles.cardPressed]}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderService}>{order.service?.title || "Service"}</Text>
          <Text style={styles.orderDate}>{date}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${config.color}20` }]}>
          <Ionicons name={config.icon as any} size={14} color={config.color} />
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>
      <View style={styles.orderFooter}>
        <Text style={styles.orderPrice}>${(order.priceUsdCents / 100).toFixed(2)}</Text>
        <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["client-orders"],
    queryFn: () => apiFetch("api/orders", { token }),
    enabled: !!token,
  });

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.accent} />
        </View>
      ) : (
        <FlatList
          data={orders || []}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }) => <OrderCard order={item} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(orders && orders.length > 0)}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor={Colors.dark.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color={Colors.dark.textSecondary} />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptyText}>Browse services to place your first order</Text>
              <Pressable
                onPress={() => router.push("/(main)/services")}
                style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.emptyBtnText}>Browse Services</Text>
              </Pressable>
            </View>
          }
        />
      )}
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
    fontSize: 24,
    color: Colors.dark.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  orderCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
    gap: 4,
  },
  orderService: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  orderDate: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.accent,
  },
  orderId: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  emptyBtnText: {
    color: Colors.dark.accent,
    fontSize: 14,
    fontWeight: "600",
  },
});
