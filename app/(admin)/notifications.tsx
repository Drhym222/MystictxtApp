import React from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";

const NOTIF_ICONS: Record<string, { icon: string; color: string }> = {
  new_order: { icon: "cart-outline", color: Colors.dark.statusPaid },
  order_delivered: { icon: "gift-outline", color: Colors.dark.statusDelivered },
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => apiFetch("api/notifications", { token }),
    enabled: !!token,
  });

  const markAllRead = useMutation({
    mutationFn: () => apiFetch("api/notifications/read-all", { method: "PUT", token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notif-count"] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`api/notifications/${id}/read`, { method: "PUT", token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notif-count"] });
    },
  });

  function renderNotif({ item }: { item: any }) {
    const config = NOTIF_ICONS[item.type] || { icon: "notifications-outline", color: Colors.dark.accent };
    const date = new Date(item.createdAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    return (
      <Pressable
        onPress={() => { if (!item.read) markRead.mutate(item.id); }}
        style={[styles.notifCard, !item.read && styles.notifUnread]}
      >
        <View style={[styles.notifIcon, { backgroundColor: `${config.color}20` }]}>
          <Ionicons name={config.icon as any} size={20} color={config.color} />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}>{item.title}</Text>
          <Text style={styles.notifBody}>{item.body}</Text>
          <Text style={styles.notifDate}>{date}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </Pressable>
    );
  }

  const hasUnread = (notifications || []).some((n: any) => !n.read);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasUnread && (
          <Pressable onPress={() => markAllRead.mutate()} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark All Read</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.dark.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={notifications || []}
          keyExtractor={(item: any) => item.id}
          renderItem={renderNotif}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(notifications && notifications.length > 0)}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor={Colors.dark.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={48} color={Colors.dark.textSecondary} />
              <Text style={styles.emptyText}>No notifications</Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 22,
    color: Colors.dark.text,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(212, 168, 83, 0.1)",
  },
  markAllText: {
    color: Colors.dark.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  notifUnread: {
    borderColor: "rgba(212, 168, 83, 0.3)",
    backgroundColor: "rgba(212, 168, 83, 0.04)",
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  notifContent: {
    flex: 1,
    gap: 3,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.dark.text,
  },
  notifTitleUnread: {
    fontWeight: "700",
  },
  notifBody: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  notifDate: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.accent,
    marginTop: 6,
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
});
