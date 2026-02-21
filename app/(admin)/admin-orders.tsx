import React, { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Platform, ActivityIndicator, RefreshControl, TextInput, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const FILTERS = ["all", "paid", "delivered", "pending", "cancelled"];

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  pending: { color: Colors.dark.statusPending, icon: "time-outline", label: "Pending" },
  paid: { color: Colors.dark.statusPaid, icon: "checkmark-circle-outline", label: "Paid" },
  delivered: { color: Colors.dark.statusDelivered, icon: "gift-outline", label: "Delivered" },
  cancelled: { color: Colors.dark.statusCancelled, icon: "close-circle-outline", label: "Cancelled" },
};

export default function AdminOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const [filter, setFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [responseText, setResponseText] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["admin-all-orders"],
    queryFn: () => apiFetch("api/admin/orders", { token }),
    enabled: !!token,
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, status, adminResponse }: { orderId: string; status: string; adminResponse?: string }) =>
      apiFetch(`api/admin/orders/${orderId}`, {
        method: "PUT",
        body: { status, adminResponse },
        token,
      }),
    onSuccess: () => {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      queryClient.invalidateQueries({ queryKey: ["admin-all-orders"] });
      setShowModal(false);
      setSelectedOrder(null);
      setResponseText("");
    },
  });

  const filteredOrders = filter === "all"
    ? (orders || [])
    : (orders || []).filter((o: any) => o.status === filter);

  function openDeliverModal(order: any) {
    setSelectedOrder(order);
    setResponseText("");
    setShowModal(true);
  }

  function handleDeliver() {
    if (!selectedOrder || !responseText.trim()) return;
    updateMutation.mutate({
      orderId: selectedOrder.id,
      status: "delivered",
      adminResponse: responseText.trim(),
    });
  }

  function renderOrder({ item }: { item: any }) {
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const date = new Date(item.createdAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric",
    });

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderTop}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderService}>{item.service?.title}</Text>
            <Text style={styles.orderClient}>{item.client?.email} | {date}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${config.color}20` }]}>
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        {item.intake && (
          <View style={styles.intakePreview}>
            <Text style={styles.intakeName}>{item.intake.fullName}</Text>
            <Text style={styles.intakeQuestion} numberOfLines={2}>{item.intake.question}</Text>
          </View>
        )}

        <View style={styles.orderActions}>
          <Text style={styles.orderPrice}>${(item.priceUsdCents / 100).toFixed(2)}</Text>
          {item.status === "paid" && (
            <Pressable
              onPress={() => openDeliverModal(item)}
              style={({ pressed }) => [styles.deliverBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="send" size={14} color="#0A0A1A" />
              <Text style={styles.deliverBtnText}>Deliver</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Orders</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.dark.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item: any) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(filteredOrders && filteredOrders.length > 0)}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor={Colors.dark.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="inbox-outline" size={48} color={Colors.dark.textSecondary} />
              <Text style={styles.emptyText}>No orders found</Text>
            </View>
          }
        />
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deliver Reading</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={Colors.dark.text} />
              </Pressable>
            </View>

            {selectedOrder && (
              <View style={styles.modalOrderInfo}>
                <Text style={styles.modalInfoText}>
                  Order #{selectedOrder.id.slice(0, 8)} - {selectedOrder.service?.title}
                </Text>
                <Text style={styles.modalInfoClient}>{selectedOrder.intake?.fullName}</Text>
                <Text style={styles.modalInfoQuestion}>{selectedOrder.intake?.question}</Text>
              </View>
            )}

            <View style={styles.responseInputWrap}>
              <TextInput
                style={styles.responseInput}
                placeholder="Write your reading response..."
                placeholderTextColor={Colors.dark.textSecondary}
                value={responseText}
                onChangeText={setResponseText}
                multiline
                textAlignVertical="top"
              />
            </View>

            <Pressable
              onPress={handleDeliver}
              disabled={updateMutation.isPending || !responseText.trim()}
              style={({ pressed }) => [
                styles.deliverSubmitBtn,
                (!responseText.trim() || updateMutation.isPending) && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <LinearGradient
                colors={["#4CAF50", "#388E3C"]}
                style={styles.deliverSubmitGradient}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.deliverSubmitText}>Mark as Delivered</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  filterChipActive: {
    backgroundColor: "rgba(212, 168, 83, 0.15)",
    borderColor: Colors.dark.accent,
  },
  filterText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  filterTextActive: {
    color: Colors.dark.accent,
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
    gap: 12,
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderInfo: {
    flex: 1,
    gap: 2,
  },
  orderService: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  orderClient: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  intakePreview: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  intakeName: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  intakeQuestion: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  orderActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.dark.accent,
  },
  deliverBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  deliverBtnText: {
    color: "#0A0A1A",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
    gap: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  modalOrderInfo: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modalInfoText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  modalInfoClient: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  modalInfoQuestion: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  responseInputWrap: {
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
    padding: 14,
    minHeight: 140,
  },
  responseInput: {
    color: Colors.dark.text,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  deliverSubmitBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  deliverSubmitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  deliverSubmitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
