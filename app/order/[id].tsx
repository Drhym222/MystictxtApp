import React from "react";
import { View, Text, Pressable, StyleSheet, Platform, ScrollView, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
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

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-detail", id],
    queryFn: () => apiFetch(`api/orders/${id}`, { token }),
    enabled: !!token && !!id,
  });

  if (isLoading || !order) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={20}>
            <Ionicons name="chevron-back" size={28} color={Colors.dark.text} />
          </Pressable>
        </View>
        <ActivityIndicator size="large" color={Colors.dark.accent} style={{ marginTop: 100 }} />
      </View>
    );
  }

  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const createdDate = new Date(order.createdAt).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={20}>
          <Ionicons name="chevron-back" size={28} color={Colors.dark.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusCard}>
          <View style={[styles.statusBadgeLarge, { backgroundColor: `${config.color}20` }]}>
            <Ionicons name={config.icon as any} size={24} color={config.color} />
            <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
          <Text style={styles.orderDate}>{createdDate}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service</Text>
          <View style={styles.detailCard}>
            <Text style={styles.detailValue}>{order.service?.title || "Service"}</Text>
            <View style={styles.serviceMetaRow}>
              <View style={[styles.deliveryTypeBadge, order.deliveryType === "express" && styles.deliveryTypeBadgeExpress]}>
                {order.deliveryType === "express" && <Ionicons name="flash" size={12} color="#0A0A1A" />}
                <Text style={[styles.deliveryTypeBadgeText, order.deliveryType === "express" && styles.deliveryTypeBadgeTextExpress]}>
                  {order.deliveryType === "express" ? "Express - 59 min" : "Standard - 24 hrs"}
                </Text>
              </View>
              <Text style={styles.detailPrice}>${(order.priceUsdCents / 100).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {order.intake && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Details</Text>
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>{order.intake.fullName}</Text>
              </View>
              {order.intake.dobOptional && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date of Birth</Text>
                  <Text style={styles.detailValue}>{order.intake.dobOptional}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Question</Text>
                <Text style={styles.detailValueMulti}>{order.intake.question}</Text>
              </View>
            </View>
          </View>
        )}

        {order.adminResponse && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Reading</Text>
            <View style={styles.responseCard}>
              <Ionicons name="sparkles" size={20} color={Colors.dark.accent} />
              <Text style={styles.responseText}>{order.adminResponse}</Text>
            </View>
          </View>
        )}

        {order.chatSession && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Live Chat Session</Text>
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: order.chatSession.status === "active" ? Colors.dark.success :
                      order.chatSession.status === "ringing" ? Colors.dark.warning : Colors.dark.textSecondary,
                  }} />
                  <Text style={styles.detailValue}>
                    {order.chatSession.status === "ringing" ? "Waiting for advisor..." :
                      order.chatSession.status === "active" ? "Active" : "Ended"}
                  </Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Session Time</Text>
                <Text style={styles.detailValue}>{order.chatSession.purchasedMinutes} minutes</Text>
              </View>
              {(order.chatSession.status === "ringing" || order.chatSession.status === "active") && (
                <Pressable
                  onPress={() => router.push({ pathname: "/live-chat/[orderId]", params: { orderId: order.id } })}
                  style={({ pressed }) => [styles.joinChatBtn, pressed && { opacity: 0.8 }]}
                >
                  <LinearGradient
                    colors={order.chatSession.status === "active" ? ["#4CAF50", "#388E3C"] : ["#D4A853", "#B08930"]}
                    style={styles.joinChatBtnGradient}
                  >
                    <Ionicons name="chatbubbles" size={18} color="#fff" />
                    <Text style={styles.joinChatBtnText}>
                      {order.chatSession.status === "active" ? "Join Live Chat" : "View Chat Status"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          </View>
        )}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 18,
    color: Colors.dark.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 20,
  },
  statusCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statusBadgeLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  orderId: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  orderDate: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  detailCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    color: Colors.dark.text,
    fontWeight: "500",
  },
  detailValueMulti: {
    fontSize: 15,
    color: Colors.dark.text,
    lineHeight: 22,
  },
  serviceMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deliveryTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(212, 168, 83, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  deliveryTypeBadgeExpress: {
    backgroundColor: "rgba(232, 200, 120, 0.2)",
  },
  deliveryTypeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.accent,
  },
  deliveryTypeBadgeTextExpress: {
    color: "#E8C878",
  },
  detailPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.dark.accent,
  },
  responseCard: {
    backgroundColor: "rgba(212, 168, 83, 0.08)",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(212, 168, 83, 0.2)",
  },
  responseText: {
    fontSize: 15,
    color: Colors.dark.text,
    lineHeight: 24,
  },
  joinChatBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 4,
  },
  joinChatBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  joinChatBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
