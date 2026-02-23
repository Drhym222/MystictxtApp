import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, Platform, FlatList, TextInput, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";

export default function LiveChatScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const [messageText, setMessageText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const isAdmin = user?.role === "admin";

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["chat-session", orderId],
    queryFn: () => apiFetch(`api/chat/session/${orderId}`, { token }),
    enabled: !!token && !!orderId,
    refetchInterval: 3000,
  });

  const { data: messages } = useQuery({
    queryKey: ["chat-messages", session?.id],
    queryFn: () => apiFetch(`api/chat/${session?.id}/messages`, { token }),
    enabled: !!token && !!session?.id,
    refetchInterval: session?.status === "active" ? 2000 : session?.status === "ringing" ? 5000 : false,
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      apiFetch(`api/chat/${session?.id}/messages`, {
        method: "POST",
        body: { message },
        token,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", session?.id] });
      setMessageText("");
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`api/admin/chat/${sessionId}/accept`, { method: "POST", token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-session", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-ringing-chats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-chat"] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
  });

  const declineMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`api/admin/chat/${sessionId}/end`, { method: "POST", token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-session", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-ringing-chats"] });
      router.back();
    },
  });

  function handleSend() {
    if (!messageText.trim() || !session?.id || session.status !== "active") return;
    sendMutation.mutate(messageText.trim());
  }

  const getElapsedSeconds = useCallback(() => {
    if (!session?.acceptedAt) return 0;
    const start = new Date(session.acceptedAt).getTime();
    const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
    return Math.floor((end - start) / 1000);
  }, [session?.acceptedAt, session?.endedAt]);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (session?.status !== "active") {
      setElapsed(getElapsedSeconds());
      return;
    }
    const interval = setInterval(() => {
      setElapsed(getElapsedSeconds());
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.status, getElapsedSeconds]);

  const totalSeconds = (session?.purchasedMinutes || 0) * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsed);
  const timerMinutes = Math.floor(remainingSeconds / 60);
  const timerSeconds = remainingSeconds % 60;
  const timerProgress = totalSeconds > 0 ? 1 - (remainingSeconds / totalSeconds) : 0;

  const isExpired = remainingSeconds <= 0 && session?.status === "active";

  function renderMessage({ item }: { item: any }) {
    const isMe = item.senderId === user?.id;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        <Text style={styles.messageRole}>
          {item.senderRole === "admin" ? "Advisor" : "You"}
        </Text>
        <Text style={styles.messageText}>{item.message}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    );
  }

  if (sessionLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={Colors.dark.accent} style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={20}>
            <Ionicons name="chevron-back" size={28} color={Colors.dark.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Live Chat</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.dark.accent} />
          <Text style={styles.emptyText}>Setting up your chat session...</Text>
          <Text style={{ fontSize: 13, color: Colors.dark.textSecondary, textAlign: "center", marginTop: 4 }}>
            This may take a moment while payment is confirmed.
          </Text>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { marginTop: 16 }]}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />

        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={20}>
            <Ionicons name="chevron-back" size={28} color={Colors.dark.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Live Chat</Text>
            <View style={[styles.statusDot, {
              backgroundColor: session.status === "active" ? Colors.dark.success :
                session.status === "ringing" ? Colors.dark.warning : Colors.dark.textSecondary,
            }]} />
            <Text style={styles.headerStatus}>
              {session.status === "ringing" ? "Connecting..." :
                session.status === "active" ? "Active" : "Ended"}
            </Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {session.status === "active" && (
          <View style={styles.timerBar}>
            <View style={[styles.timerProgress, { width: `${Math.min(timerProgress * 100, 100)}%` }]} />
            <View style={styles.timerContent}>
              <Ionicons name="time-outline" size={14} color={remainingSeconds < 60 ? Colors.dark.error : Colors.dark.accent} />
              <Text style={[styles.timerText, remainingSeconds < 60 && { color: Colors.dark.error }]}>
                {timerMinutes}:{timerSeconds.toString().padStart(2, "0")} remaining
              </Text>
              <Text style={styles.timerTotal}>of {session.purchasedMinutes} min</Text>
            </View>
          </View>
        )}

        {session.status === "ringing" && (
          <View style={styles.waitingCard}>
            <ActivityIndicator size="small" color={Colors.dark.accent} />
            <Text style={styles.waitingTitle}>
              {isAdmin ? "Client is waiting..." : "Waiting for advisor..."}
            </Text>
            <Text style={styles.waitingText}>
              {isAdmin
                ? `A client is requesting a ${session.purchasedMinutes}-minute live chat session.`
                : `Your ${session.purchasedMinutes}-minute session is ready. The timer will start once the advisor connects.`}
            </Text>
            {isAdmin && (
              <View style={styles.ringingActions}>
                <Pressable
                  onPress={() => acceptMutation.mutate(session.id)}
                  disabled={acceptMutation.isPending}
                  style={({ pressed }) => [styles.acceptChatBtn, pressed && { opacity: 0.8 }]}
                >
                  <LinearGradient colors={["#4CAF50", "#388E3C"]} style={styles.acceptChatBtnGradient}>
                    {acceptMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    )}
                    <Text style={styles.acceptChatBtnText}>Accept Chat</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={() => declineMutation.mutate(session.id)}
                  disabled={declineMutation.isPending}
                  style={({ pressed }) => [styles.declineChatBtn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.declineChatBtnText}>Decline</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {session.status === "ended" && (
          <View style={styles.endedCard}>
            <Ionicons name="checkmark-circle" size={32} color={Colors.dark.success} />
            <Text style={styles.endedTitle}>Session Ended</Text>
            <Text style={styles.endedText}>
              Your live chat session has ended. Thank you for consulting with our advisor.
            </Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages || []}
          keyExtractor={(item: any) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(messages && messages.length > 0)}
          onContentSizeChange={() => {
            if (messages?.length) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          ListEmptyComponent={
            session.status === "active" ? (
              <View style={styles.chatEmptyState}>
                <Ionicons name="chatbubble-ellipses-outline" size={36} color={Colors.dark.textSecondary} />
                <Text style={styles.chatEmptyText}>Say hello to start the conversation</Text>
              </View>
            ) : null
          }
        />

        {session.status === "active" && !isExpired && (
          <View style={[styles.inputBar, { paddingBottom: bottomPadding + 8 }]}>
            <TextInput
              style={styles.chatInput}
              placeholder="Type a message..."
              placeholderTextColor={Colors.dark.textSecondary}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={1000}
              onSubmitEditing={handleSend}
            />
            <Pressable
              onPress={handleSend}
              disabled={!messageText.trim() || sendMutation.isPending}
              style={({ pressed }) => [
                styles.sendBtn,
                (!messageText.trim()) && { opacity: 0.4 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="send" size={20} color="#0A0A1A" />
            </Pressable>
          </View>
        )}

        {isExpired && session.status === "active" && (
          <View style={[styles.expiredBar, { paddingBottom: bottomPadding + 8 }]}>
            <Ionicons name="time-outline" size={18} color={Colors.dark.error} />
            <Text style={styles.expiredText}>Session time has expired</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 18,
    color: Colors.dark.text,
  },
  headerStatus: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timerBar: {
    backgroundColor: Colors.dark.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    overflow: "hidden",
  },
  timerProgress: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "rgba(212, 168, 83, 0.1)",
  },
  timerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  timerText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.dark.accent,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  timerTotal: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  waitingCard: {
    margin: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  waitingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.dark.accent,
  },
  waitingText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  endedCard: {
    margin: 16,
    backgroundColor: "rgba(76, 175, 80, 0.08)",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.2)",
  },
  endedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.dark.success,
  },
  endedText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "80%",
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(212, 168, 83, 0.15)",
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: "flex-start",
    backgroundColor: Colors.dark.card,
    borderBottomLeftRadius: 4,
  },
  messageRole: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.dark.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 15,
    color: Colors.dark.text,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    alignSelf: "flex-end",
  },
  chatEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 8,
  },
  chatEmptyText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: Colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  chatInput: {
    flex: 1,
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.dark.text,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  expiredBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  expiredText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.error,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  backBtn: {
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  backBtnText: {
    color: "#0A0A1A",
    fontWeight: "700",
    fontSize: 14,
  },
  ringingActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    width: "100%",
  },
  acceptChatBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  acceptChatBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  acceptChatBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  declineChatBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 82, 82, 0.3)",
    backgroundColor: "rgba(255, 82, 82, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  declineChatBtnText: {
    color: "#FF5252",
    fontWeight: "700",
    fontSize: 15,
  },
});
