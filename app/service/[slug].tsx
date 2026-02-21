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
import * as Haptics from "expo-haptics";
import type { Service } from "@shared/schema";

const SERVICE_ICONS: Record<string, string> = {
  "psychic-reading": "eye",
  "tarot-reading": "grid",
  "telepathy-mind-reading": "radio",
  "telepathy-mind-implants": "pulse",
  "live-chat": "chatbubbles",
};

const SERVICE_COLORS: Record<string, [string, string, string]> = {
  "psychic-reading": ["#6C3483", "#4A235A", "#2C1136"],
  "tarot-reading": ["#1A5276", "#154360", "#0D2F45"],
  "telepathy-mind-reading": ["#1E8449", "#145A32", "#0B3D22"],
  "telepathy-mind-implants": ["#B7950B", "#7D6608", "#524405"],
  "live-chat": ["#C0392B", "#922B21", "#641E16"],
};

const DELIVERY_INFO: Record<string, string> = {
  "psychic-reading": "Your personalized psychic reading will be delivered within 24-48 hours via the app. You'll receive a notification when it's ready.",
  "tarot-reading": "A detailed tarot spread interpretation will be delivered within 24-48 hours. Each card's meaning is explained in the context of your question.",
  "telepathy-mind-reading": "Results from the telepathic session will be compiled and delivered within 48 hours. Includes detailed impressions and insights.",
  "telepathy-mind-implants": "The telepathic implant session requires 3-5 days for full completion. Progress updates will be provided throughout.",
  "live-chat": "Per-reply pricing. Each advisor response costs $2.99. Purchase a bundle to get started with your live consultation.",
};

export default function ServiceDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: service, isLoading } = useQuery<Service>({
    queryKey: [`api/services/${slug}`],
  });

  function handleOrder() {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (service) {
      router.push({ pathname: "/order-form", params: { serviceId: service.id, serviceTitle: service.title, price: String(service.priceUsdCents) } });
    }
  }

  if (isLoading || !service) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={Colors.dark.accent} style={{ marginTop: 100 }} />
      </View>
    );
  }

  const iconName = SERVICE_ICONS[service.slug] || "star";
  const colors = SERVICE_COLORS[service.slug] || ["#2C3E50", "#1A252F", "#111820"];
  const deliveryInfo = DELIVERY_INFO[service.slug] || "Delivery details will be provided after order confirmation.";

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={20}>
          <Ionicons name="chevron-back" size={28} color={Colors.dark.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={colors} style={styles.heroSection} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.heroIcon}>
            <Ionicons name={iconName as any} size={48} color="rgba(255,255,255,0.9)" />
          </View>
          <Text style={styles.heroTitle}>{service.title}</Text>
          <Text style={styles.heroPrice}>${(service.priceUsdCents / 100).toFixed(2)}</Text>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.sectionText}>{service.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery</Text>
          <View style={styles.deliveryCard}>
            <Ionicons name="time-outline" size={20} color={Colors.dark.accent} />
            <Text style={styles.deliveryText}>{deliveryInfo}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What You'll Receive</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.dark.success} />
              <Text style={styles.featureText}>Personalized reading based on your question</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.dark.success} />
              <Text style={styles.featureText}>Detailed written response from our advisor</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.dark.success} />
              <Text style={styles.featureText}>In-app notification when delivered</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 12 }]}>
        <View style={styles.bottomPrice}>
          <Text style={styles.bottomPriceLabel}>Total</Text>
          <Text style={styles.bottomPriceValue}>${(service.priceUsdCents / 100).toFixed(2)}</Text>
        </View>
        <Pressable
          onPress={handleOrder}
          style={({ pressed }) => [styles.orderBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          <LinearGradient
            colors={["#D4A853", "#B08930"]}
            style={styles.orderBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="cart-outline" size={20} color="#0A0A1A" />
            <Text style={styles.orderBtnText}>Order Now</Text>
          </LinearGradient>
        </Pressable>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  heroSection: {
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 24,
    color: "#fff",
    textAlign: "center",
  },
  heroPrice: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.dark.accentLight,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    lineHeight: 22,
  },
  deliveryCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: Colors.dark.card,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: "flex-start",
  },
  deliveryText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: Colors.dark.text,
    flex: 1,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: Colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    gap: 16,
  },
  bottomPrice: {
    gap: 2,
  },
  bottomPriceLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  bottomPriceValue: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.dark.accent,
  },
  orderBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  orderBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  orderBtnText: {
    color: "#0A0A1A",
    fontSize: 16,
    fontWeight: "700",
  },
});
