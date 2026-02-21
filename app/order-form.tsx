import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

export default function OrderFormScreen() {
  const { serviceId, serviceTitle, price } = useLocalSearchParams<{
    serviceId: string;
    serviceTitle: string;
    price: string;
  }>();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");

  const priceStr = price ? (parseInt(price) / 100).toFixed(2) : "0.00";

  const orderMutation = useMutation({
    mutationFn: () =>
      apiFetch("api/orders", {
        method: "POST",
        body: { serviceId, fullName, dob: dob || undefined, question },
        token,
      }),
    onSuccess: () => {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      queryClient.invalidateQueries({ queryKey: ["client-orders"] });
      router.dismissAll();
      router.push("/(main)/orders");
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to place order");
    },
  });

  function handleSubmit() {
    if (!fullName.trim()) {
      setError("Please enter your full name");
      return;
    }
    if (!question.trim()) {
      setError("Please enter your question");
      return;
    }
    setError("");
    orderMutation.mutate();
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={20}>
          <Ionicons name="close" size={28} color={Colors.dark.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Place Order</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 20 }]}
        bottomOffset={40}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{serviceTitle}</Text>
          <Text style={styles.summaryPrice}>${priceStr} USD</Text>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={Colors.dark.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color={Colors.dark.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Your full name"
                placeholderTextColor={Colors.dark.textSecondary}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth (optional)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="calendar-outline" size={18} color={Colors.dark.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={Colors.dark.textSecondary}
                value={dob}
                onChangeText={setDob}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your Question *</Text>
            <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What would you like to know? Be as specific as possible for the most accurate reading..."
                placeholderTextColor={Colors.dark.textSecondary}
                value={question}
                onChangeText={setQuestion}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.dark.accent} />
            <Text style={styles.infoText}>Your order will be processed immediately. Our advisor will deliver your reading within the specified timeframe.</Text>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={orderMutation.isPending}
            style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          >
            <LinearGradient
              colors={["#D4A853", "#B08930"]}
              style={styles.submitBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {orderMutation.isPending ? (
                <ActivityIndicator color="#0A0A1A" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#0A0A1A" />
                  <Text style={styles.submitBtnText}>Confirm & Pay ${priceStr}</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
  summaryCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    flex: 1,
  },
  summaryPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.accent,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(231, 76, 60, 0.1)",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(231, 76, 60, 0.3)",
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 13,
    flex: 1,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
    paddingHorizontal: 14,
    height: 52,
  },
  textAreaWrapper: {
    height: 140,
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 16,
  },
  textArea: {
    height: 116,
    textAlignVertical: "top",
  },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(212, 168, 83, 0.08)",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212, 168, 83, 0.2)",
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  submitBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  submitBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  submitBtnText: {
    color: "#0A0A1A",
    fontSize: 16,
    fontWeight: "700",
  },
});
