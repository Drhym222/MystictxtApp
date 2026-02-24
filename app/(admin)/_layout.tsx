import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs, router } from "expo-router";
import { NativeTabs, Icon, Label, Badge } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, Text, Pressable, Animated, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";

function GlobalRingingOverlay() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  const ringtoneSource = require("@/assets/ringtone.mp3");
  const player = useAudioPlayer(ringtoneSource);

  const { data: ringingChats } = useQuery({
    queryKey: ["admin-ringing-chats"],
    queryFn: () => apiFetch("api/admin/chat/ringing", { token }),
    enabled: !!token,
    refetchInterval: 3000,
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
    },
  });

  const hasRinging = (ringingChats || []).length > 0;
  const firstRinging = hasRinging ? ringingChats[0] : null;

  useEffect(() => {
    if (!hasRinging) {
      try { player.pause(); } catch {}
      return;
    }

    try {
      player.loop = true;
      player.volume = 1.0;
      player.play();
    } catch {}

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 500, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
      ])
    );

    const ringLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 100, useNativeDriver: false }),
        Animated.timing(ringAnim, { toValue: -1, duration: 100, useNativeDriver: false }),
        Animated.timing(ringAnim, { toValue: 1, duration: 100, useNativeDriver: false }),
        Animated.timing(ringAnim, { toValue: 0, duration: 100, useNativeDriver: false }),
        Animated.delay(1500),
      ])
    );

    pulseLoop.start();
    ringLoop.start();

    const hapticInterval = setInterval(() => {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
    }, 3000);

    return () => {
      pulseLoop.stop();
      ringLoop.stop();
      clearInterval(hapticInterval);
      try { player.pause(); } catch {}
    };
  }, [hasRinging]);

  if (!hasRinging || !firstRinging) return null;

  const clientName = firstRinging.order?.intake?.fullName || "Client";
  const minutes = firstRinging.purchasedMinutes || 5;

  const rotateInterpolate = ringAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-12deg", "0deg", "12deg"],
  });

  return (
    <Animated.View style={[overlayStyles.container, { transform: [{ scale: pulseAnim }] }]}>
      <View style={overlayStyles.banner}>
        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
          <View style={overlayStyles.phoneIcon}>
            <Ionicons name="call" size={20} color="#4CAF50" />
          </View>
        </Animated.View>

        <View style={overlayStyles.info}>
          <Text style={overlayStyles.label}>INCOMING LIVE CHAT</Text>
          <Text style={overlayStyles.name}>{clientName}</Text>
          <Text style={overlayStyles.duration}>{minutes}-min session</Text>
        </View>

        <View style={overlayStyles.actions}>
          <Pressable
            onPress={() => declineChatMutation.mutate(firstRinging.id)}
            style={overlayStyles.declineBtn}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>

          <Pressable
            onPress={() => acceptChatMutation.mutate(firstRinging.id)}
            disabled={acceptChatMutation.isPending}
            style={overlayStyles.acceptBtn}
          >
            {acceptChatMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="chatbubbles" size={20} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const overlayStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "web" ? 67 : 50,
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(10, 10, 26, 0.97)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: "rgba(76, 175, 80, 0.6)",
    gap: 12,
    boxShadow: "0 4px 20px rgba(76, 175, 80, 0.3)",
  },
  phoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(76, 175, 80, 0.2)",
    borderWidth: 1.5,
    borderColor: "rgba(76, 175, 80, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    fontWeight: "800",
    color: "#4CAF50",
    letterSpacing: 1.5,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginTop: 2,
  },
  duration: {
    fontSize: 11,
    color: "rgba(200, 192, 216, 0.7)",
    marginTop: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  declineBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF5252",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
  },
});

function NativeTabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <NativeTabs>
        <NativeTabs.Trigger name="dashboard">
          <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
          <Label>Dashboard</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="admin-orders">
          <Icon sf={{ default: "list.bullet.rectangle", selected: "list.bullet.rectangle.fill" }} />
          <Label>Orders</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="notifications">
          <Icon sf={{ default: "bell", selected: "bell.fill" }} />
          <Label>Alerts</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="admin-profile">
          <Icon sf={{ default: "person", selected: "person.fill" }} />
          <Label>Profile</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      <GlobalRingingOverlay />
    </View>
  );
}

function ClassicTabLayout() {
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const { token } = useAuth();

  const { data: notifData } = useQuery({
    queryKey: ["admin-notif-count"],
    queryFn: () => apiFetch("api/notifications/unread-count", { token }),
    enabled: !!token,
    refetchInterval: 15000,
  });

  const unreadCount = notifData?.count || 0;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.dark.accent,
          tabBarInactiveTintColor: Colors.dark.textSecondary,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: isIOS ? "transparent" : Colors.dark.surface,
            borderTopWidth: isWeb ? 1 : 0,
            borderTopColor: Colors.dark.border,
            elevation: 0,
            ...(isWeb ? { height: 84 } : {}),
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
            ) : isWeb ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.dark.surface }]} />
            ) : null,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin-orders"
          options={{
            title: "Orders",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="receipt-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: "Alerts",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications-outline" size={size} color={color} />
            ),
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          }}
        />
        <Tabs.Screen
          name="admin-profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      <GlobalRingingOverlay />
    </View>
  );
}

export default function AdminTabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
