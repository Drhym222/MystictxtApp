import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ScrollView, ActivityIndicator, RefreshControl, Switch, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";
import { useAudioPlayer, AudioModule } from "expo-audio";

function IncomingCallCard({ chat, onAccept, onDecline, isAccepting }: {
  chat: any;
  onAccept: () => void;
  onDecline: () => void;
  isAccepting: boolean;
}) {
  const ringAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const ringtoneSource = require("@/assets/ringtone.mp3");
  const player = useAudioPlayer(ringtoneSource);

  useEffect(() => {
    const ringLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
        Animated.timing(ringAnim, { toValue: -1, duration: 150, useNativeDriver: false }),
        Animated.timing(ringAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
        Animated.timing(ringAnim, { toValue: 0, duration: 150, useNativeDriver: false }),
        Animated.delay(1000),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.08, duration: 600, useNativeDriver: false }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
      ])
    );

    ringLoop.start();
    pulseLoop.start();
    glowLoop.start();

    const hapticInterval = setInterval(() => {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
    }, 2000);

    try {
      player.loop = true;
      player.volume = 1.0;
      player.play();
    } catch {}

    return () => {
      ringLoop.stop();
      pulseLoop.stop();
      glowLoop.stop();
      clearInterval(hapticInterval);
      try { player.pause(); } catch {}
    };
  }, []);

  const stopSound = () => {
    try { player.pause(); } catch {}
  };

  const rotateInterpolate = ringAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-15deg", "0deg", "15deg"],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  const clientName = chat.order?.intake?.fullName || "Client";
  const minutes = chat.purchasedMinutes || 5;

  return (
    <Animated.View style={[styles.incomingCallCard, { transform: [{ scale: scaleAnim }] }]}>
      <Animated.View style={[styles.callGlowRing, { opacity: glowOpacity }]} />
      <LinearGradient
        colors={["rgba(76, 175, 80, 0.15)", "rgba(76, 175, 80, 0.05)", "rgba(10, 10, 26, 0.95)"]}
        style={styles.callCardGradient}
      >
        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
          <View style={styles.callIconCircle}>
            <Ionicons name="call" size={28} color="#4CAF50" />
          </View>
        </Animated.View>

        <Text style={styles.callLabel}>INCOMING LIVE CHAT</Text>
        <Text style={styles.callerName}>{clientName}</Text>
        <Text style={styles.callDuration}>{minutes}-minute session</Text>

        <View style={styles.callActions}>
          <Pressable
            onPress={() => {
              stopSound();
              onDecline();
            }}
            style={({ pressed }) => [styles.callDeclineBtn, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.callDeclineBtnInner}>
              <Ionicons name="close" size={24} color="#fff" />
            </View>
            <Text style={styles.callActionLabel}>Decline</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              stopSound();
              onAccept();
            }}
            disabled={isAccepting}
            style={({ pressed }) => [styles.callAcceptBtn, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.callAcceptBtnInner}>
              {isAccepting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="chatbubbles" size={24} color="#fff" />
              )}
            </View>
            <Text style={styles.callActionLabel}>Accept</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const prevRingingCount = useRef(0);
  const queryClient = useQueryClient();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["admin-all-orders"],
    queryFn: () => apiFetch("api/admin/orders", { token }),
    enabled: !!token,
  });

  const { data: notifData } = useQuery({
    queryKey: ["admin-notif-count"],
    queryFn: () => apiFetch("api/notifications/unread-count", { token }),
    enabled: !!token,
  });

  const { data: chatSetting } = useQuery({
    queryKey: ["admin-chat-setting"],
    queryFn: () => apiFetch("api/admin/settings/live-chat", { token }),
    enabled: !!token,
  });

  const { data: ringingChats } = useQuery({
    queryKey: ["admin-ringing-chats"],
    queryFn: () => apiFetch("api/admin/chat/ringing", { token }),
    enabled: !!token,
    refetchInterval: 5000,
  });

  const { data: activeChat } = useQuery({
    queryKey: ["admin-active-chat"],
    queryFn: () => apiFetch("api/admin/chat/active", { token }),
    enabled: !!token,
    refetchInterval: 5000,
  });

  const toggleChatMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch("api/admin/settings/live-chat", { method: "PUT", body: { enabled }, token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-chat-setting"] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
  });

  const acceptChatMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`api/admin/chat/${sessionId}/accept`, { method: "POST", token }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-ringing-chats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-chat"] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      if (data?.orderId) {
        router.push({ pathname: "/live-chat/[orderId]", params: { orderId: data.orderId } });
      }
    },
  });

  const declineChatMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`api/admin/chat/${sessionId}/end`, { method: "POST", token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ringing-chats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-chat"] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
  });

  const endChatMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`api/admin/chat/${sessionId}/end`, { method: "POST", token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ringing-chats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-chat"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-orders"] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
  });

  const liveChatEnabled = chatSetting?.enabled || false;

  const allOrders = orders || [];
  const paidOrders = allOrders.filter((o: any) => o.status === "paid");
  const deliveredOrders = allOrders.filter((o: any) => o.status === "delivered");
  const totalRevenue = allOrders
    .filter((o: any) => o.status === "paid" || o.status === "delivered")
    .reduce((sum: number, o: any) => sum + o.priceUsdCents, 0);

  const recentOrders = allOrders.slice(0, 5);
  const hasRingingChats = (ringingChats || []).length > 0;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Legacy Portal</Text>
          <Text style={styles.headerSubtitle}>Admin Dashboard</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => router.push("/(admin)/notifications")}
            style={styles.bellBtn}
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.dark.accent} />
            {(notifData?.count || 0) > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{notifData.count}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor={Colors.dark.accent} />}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.dark.accent} style={{ marginTop: 60 }} />
        ) : (
          <>
            <View style={styles.liveChatSection}>
              <View style={styles.liveChatHeader}>
                <View style={styles.liveChatLeft}>
                  <Ionicons name="chatbubbles" size={20} color={liveChatEnabled ? Colors.dark.success : Colors.dark.textSecondary} />
                  <View>
                    <Text style={styles.liveChatTitle}>Live Chat</Text>
                    <Text style={styles.liveChatStatus}>
                      {liveChatEnabled ? "You are online" : "You are offline"}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={liveChatEnabled}
                  onValueChange={(val) => toggleChatMutation.mutate(val)}
                  trackColor={{ false: Colors.dark.border, true: "rgba(76, 175, 80, 0.4)" }}
                  thumbColor={liveChatEnabled ? Colors.dark.success : Colors.dark.textSecondary}
                />
              </View>
            </View>

            {activeChat && (
              <Pressable
                onPress={() => router.push({ pathname: "/live-chat/[orderId]", params: { orderId: activeChat.orderId } })}
                style={styles.activeChatCard}
              >
                <LinearGradient
                  colors={["rgba(76, 175, 80, 0.15)", "rgba(76, 175, 80, 0.05)"]}
                  style={styles.activeChatGradient}
                >
                  <View style={styles.activeChatDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeChatTitle}>Active Chat Session</Text>
                    <Text style={styles.activeChatSub}>
                      {activeChat.purchasedMinutes} min | Tap to continue
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => endChatMutation.mutate(activeChat.id)}
                    style={styles.endChatBtn}
                  >
                    <Text style={styles.endChatBtnText}>End</Text>
                  </Pressable>
                </LinearGradient>
              </Pressable>
            )}

            {hasRingingChats && (
              <View style={styles.ringingSection}>
                {(ringingChats || []).map((chat: any) => (
                  <IncomingCallCard
                    key={chat.id}
                    chat={chat}
                    onAccept={() => acceptChatMutation.mutate(chat.id)}
                    onDecline={() => declineChatMutation.mutate(chat.id)}
                    isAccepting={acceptChatMutation.isPending}
                  />
                ))}
              </View>
            )}

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { borderLeftColor: Colors.dark.statusPaid }]}>
                <Text style={styles.statNumber}>{paidOrders.length}</Text>
                <Text style={styles.statLabel}>Awaiting Delivery</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: Colors.dark.statusDelivered }]}>
                <Text style={styles.statNumber}>{deliveredOrders.length}</Text>
                <Text style={styles.statLabel}>Delivered</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: Colors.dark.accent }]}>
                <Text style={styles.statNumber}>${(totalRevenue / 100).toFixed(0)}</Text>
                <Text style={styles.statLabel}>Revenue</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: Colors.dark.statusPending }]}>
                <Text style={styles.statNumber}>{allOrders.length}</Text>
                <Text style={styles.statLabel}>Total Orders</Text>
              </View>
            </View>

            <View style={styles.recentSection}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentTitle}>Recent Orders</Text>
                <Pressable onPress={() => router.push("/(admin)/admin-orders")}>
                  <Text style={styles.viewAll}>View All</Text>
                </Pressable>
              </View>

              {recentOrders.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="inbox-outline" size={36} color={Colors.dark.textSecondary} />
                  <Text style={styles.emptyText}>No orders yet</Text>
                </View>
              ) : (
                recentOrders.map((order: any) => {
                  const statusConfig: Record<string, { color: string; label: string }> = {
                    pending: { color: Colors.dark.statusPending, label: "Pending" },
                    paid: { color: Colors.dark.statusPaid, label: "Paid" },
                    delivered: { color: Colors.dark.statusDelivered, label: "Delivered" },
                    cancelled: { color: Colors.dark.statusCancelled, label: "Cancelled" },
                  };
                  const sc = statusConfig[order.status] || statusConfig.pending;
                  return (
                    <Pressable
                      key={order.id}
                      style={({ pressed }) => [styles.recentCard, pressed && { opacity: 0.85 }]}
                      onPress={() => router.push({ pathname: "/order/[id]", params: { id: order.id } })}
                    >
                      <View style={styles.recentInfo}>
                        <Text style={styles.recentService}>{order.service?.title}</Text>
                        <Text style={styles.recentClient}>{order.client?.email}</Text>
                      </View>
                      <View style={[styles.statusDot, { backgroundColor: sc.color }]} />
                    </Pressable>
                  );
                })
              )}
            </View>
          </>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 22,
    color: Colors.dark.accent,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(212, 168, 83, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: Colors.dark.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 24,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "47%",
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderLeftWidth: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 4,
    fontWeight: "500",
  },
  recentSection: {
    gap: 12,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.dark.text,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  viewAll: {
    fontSize: 13,
    color: Colors.dark.accent,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  recentInfo: {
    flex: 1,
    gap: 2,
  },
  recentService: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  recentClient: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  liveChatSection: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  liveChatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  liveChatLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  liveChatTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  liveChatStatus: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  activeChatCard: {
    borderRadius: 14,
    overflow: "hidden",
  },
  activeChatGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.3)",
    gap: 12,
  },
  activeChatDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.dark.success,
  },
  activeChatTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.dark.success,
  },
  activeChatSub: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  endChatBtn: {
    backgroundColor: Colors.dark.error,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  endChatBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  ringingSection: {
    gap: 12,
  },
  incomingCallCard: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(76, 175, 80, 0.5)",
  },
  callGlowRing: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: "#4CAF50",
  },
  callCardGradient: {
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  callIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(76, 175, 80, 0.2)",
    borderWidth: 2,
    borderColor: "rgba(76, 175, 80, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  callLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4CAF50",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  callerName: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 22,
    color: Colors.dark.text,
    textAlign: "center",
  },
  callDuration: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  callActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 40,
    marginTop: 16,
    width: "100%",
  },
  callDeclineBtn: {
    alignItems: "center",
    gap: 6,
  },
  callDeclineBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FF5252",
    alignItems: "center",
    justifyContent: "center",
  },
  callAcceptBtn: {
    alignItems: "center",
    gap: 6,
  },
  callAcceptBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
  },
  callActionLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: "600",
  },
});
