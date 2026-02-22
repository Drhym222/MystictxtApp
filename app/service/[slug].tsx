import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ScrollView, ActivityIndicator, TextInput } from "react-native";
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
  "find-lost-items": "search",
  "live-chat": "chatbubbles",
};

const SERVICE_COLORS: Record<string, [string, string, string]> = {
  "psychic-reading": ["#6C3483", "#4A235A", "#2C1136"],
  "tarot-reading": ["#1A5276", "#154360", "#0D2F45"],
  "telepathy-mind-reading": ["#1E8449", "#145A32", "#0B3D22"],
  "find-lost-items": ["#B7950B", "#7D6608", "#524405"],
  "live-chat": ["#C0392B", "#922B21", "#641E16"],
};

const LIVE_CHAT_OPTIONS = [
  { minutes: 5, priceCents: 399, label: "5 Minutes" },
  { minutes: 10, priceCents: 799, label: "10 Minutes" },
  { minutes: 15, priceCents: 1199, label: "15 Minutes" },
  { minutes: 30, priceCents: 1999, label: "30 Minutes" },
  { minutes: 60, priceCents: 3599, label: "60 Minutes" },
];

const EXPRESS_SURCHARGE_CENTS = 1000;

export default function ServiceDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const [deliveryType, setDeliveryType] = useState<"standard" | "express">("standard");
  const [selectedChatIndex, setSelectedChatIndex] = useState(0);
  const [customMinutes, setCustomMinutes] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const { data: service, isLoading } = useQuery<Service>({
    queryKey: [`api/services/${slug}`],
  });

  const isLiveChat = service?.slug === "live-chat";

  function getChatPriceCents(): number {
    if (useCustom) {
      const mins = parseInt(customMinutes) || 0;
      return Math.ceil(mins * (399 / 5));
    }
    return LIVE_CHAT_OPTIONS[selectedChatIndex]?.priceCents || 399;
  }

  function getChatMinutes(): number {
    if (useCustom) return parseInt(customMinutes) || 5;
    return LIVE_CHAT_OPTIONS[selectedChatIndex]?.minutes || 5;
  }

  const standardPriceCents = isLiveChat ? getChatPriceCents() : (service?.priceUsdCents || 499);
  const expressPriceCents = standardPriceCents + EXPRESS_SURCHARGE_CENTS;
  const currentPriceCents = deliveryType === "express" ? expressPriceCents : standardPriceCents;
  const currentPrice = currentPriceCents / 100;

  function handleOrder() {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (service) {
      const params: any = {
        serviceId: service.id,
        serviceTitle: service.title,
        price: String(currentPriceCents),
        deliveryType,
      };
      if (isLiveChat) {
        params.chatMinutes = String(getChatMinutes());
      }
      router.push({ pathname: "/order-form", params });
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
  const basePrice = isLiveChat ? 3.99 : service.priceUsdCents / 100;

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
          <Text style={styles.heroSubtitle}>
            {isLiveChat ? "From $3.99 / 5 min" : `Starting at $${basePrice.toFixed(2)}`}
          </Text>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.sectionText}>{service.description}</Text>
        </View>

        {isLiveChat ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Session Time</Text>
            <View style={styles.deliveryOptions}>
              {LIVE_CHAT_OPTIONS.map((opt, idx) => (
                <Pressable
                  key={opt.minutes}
                  onPress={() => {
                    setSelectedChatIndex(idx);
                    setUseCustom(false);
                    try { Haptics.selectionAsync(); } catch {}
                  }}
                  style={[
                    styles.deliveryOption,
                    !useCustom && selectedChatIndex === idx && styles.deliveryOptionActive,
                  ]}
                >
                  <View style={styles.deliveryOptionHeader}>
                    <View style={[styles.radioOuter, !useCustom && selectedChatIndex === idx && styles.radioOuterActive]}>
                      {!useCustom && selectedChatIndex === idx && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.deliveryOptionInfo}>
                      <Text style={[styles.deliveryOptionTitle, !useCustom && selectedChatIndex === idx && styles.deliveryOptionTitleActive]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.deliveryOptionTime}>
                        <Ionicons name="time-outline" size={12} color={Colors.dark.textSecondary} /> Live session
                      </Text>
                    </View>
                    <Text style={[styles.deliveryOptionPrice, !useCustom && selectedChatIndex === idx && styles.deliveryOptionPriceActive]}>
                      ${(opt.priceCents / 100).toFixed(2)}
                    </Text>
                  </View>
                </Pressable>
              ))}

              <Pressable
                onPress={() => {
                  setUseCustom(true);
                  try { Haptics.selectionAsync(); } catch {}
                }}
                style={[
                  styles.deliveryOption,
                  useCustom && styles.deliveryOptionActiveExpress,
                ]}
              >
                <View style={styles.expressTag}>
                  <Ionicons name="create" size={10} color="#0A0A1A" />
                  <Text style={styles.expressTagText}>CUSTOM</Text>
                </View>
                <View style={styles.deliveryOptionHeader}>
                  <View style={[styles.radioOuter, useCustom && styles.radioOuterActiveExpress]}>
                    {useCustom && <View style={styles.radioInnerExpress} />}
                  </View>
                  <View style={[styles.deliveryOptionInfo, { flex: 1 }]}>
                    <Text style={[styles.deliveryOptionTitle, useCustom && styles.deliveryOptionTitleActiveExpress]}>Custom Time</Text>
                    {useCustom && (
                      <View style={styles.customInputRow}>
                        <TextInput
                          style={styles.customInput}
                          placeholder="Minutes"
                          placeholderTextColor={Colors.dark.textSecondary}
                          value={customMinutes}
                          onChangeText={setCustomMinutes}
                          keyboardType="number-pad"
                          maxLength={3}
                        />
                        <Text style={styles.customLabel}>min</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.deliveryOptionPrice, useCustom && styles.deliveryOptionPriceActiveExpress]}>
                    {useCustom && customMinutes ? `$${(getChatPriceCents() / 100).toFixed(2)}` : "$0.80/min"}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Delivery Speed</Text>
            <View style={styles.deliveryOptions}>
              <Pressable
                onPress={() => {
                  setDeliveryType("standard");
                  try { Haptics.selectionAsync(); } catch {}
                }}
                style={[
                  styles.deliveryOption,
                  deliveryType === "standard" && styles.deliveryOptionActive,
                ]}
              >
                <View style={styles.deliveryOptionHeader}>
                  <View style={[styles.radioOuter, deliveryType === "standard" && styles.radioOuterActive]}>
                    {deliveryType === "standard" && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.deliveryOptionInfo}>
                    <Text style={[styles.deliveryOptionTitle, deliveryType === "standard" && styles.deliveryOptionTitleActive]}>Standard</Text>
                    <Text style={styles.deliveryOptionTime}>24-hour delivery</Text>
                  </View>
                  <Text style={[styles.deliveryOptionPrice, deliveryType === "standard" && styles.deliveryOptionPriceActive]}>
                    ${(standardPriceCents / 100).toFixed(2)}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setDeliveryType("express");
                  try { Haptics.selectionAsync(); } catch {}
                }}
                style={[
                  styles.deliveryOption,
                  deliveryType === "express" && styles.deliveryOptionActiveExpress,
                ]}
              >
                <View style={styles.expressTag}>
                  <Ionicons name="flash" size={10} color="#0A0A1A" />
                  <Text style={styles.expressTagText}>FAST</Text>
                </View>
                <View style={styles.deliveryOptionHeader}>
                  <View style={[styles.radioOuter, deliveryType === "express" && styles.radioOuterActiveExpress]}>
                    {deliveryType === "express" && <View style={styles.radioInnerExpress} />}
                  </View>
                  <View style={styles.deliveryOptionInfo}>
                    <Text style={[styles.deliveryOptionTitle, deliveryType === "express" && styles.deliveryOptionTitleActiveExpress]}>Express</Text>
                    <Text style={styles.deliveryOptionTime}>59-minute delivery</Text>
                  </View>
                  <Text style={[styles.deliveryOptionPrice, deliveryType === "express" && styles.deliveryOptionPriceActiveExpress]}>
                    ${(expressPriceCents / 100).toFixed(2)}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What You'll Receive</Text>
          <View style={styles.featureList}>
            {isLiveChat ? (
              <>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.dark.success} />
                  <Text style={styles.featureText}>Real-time text chat with our mystic advisor</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.dark.success} />
                  <Text style={styles.featureText}>Timer starts when advisor accepts your connection</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.dark.success} />
                  <Text style={styles.featureText}>Ask unlimited questions within your session time</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="time-outline" size={18} color="#E8C878" />
                  <Text style={styles.featureText}>Session time counted only while actively connected</Text>
                </View>
              </>
            ) : (
              <>
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
                {deliveryType === "express" && (
                  <View style={styles.featureItem}>
                    <Ionicons name="flash" size={18} color="#E8C878" />
                    <Text style={styles.featureText}>Priority processing within 59 minutes</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 12 }]}>
        <View style={styles.bottomPrice}>
          <Text style={styles.bottomPriceLabel}>
            {isLiveChat ? `${getChatMinutes()} min session` : deliveryType === "express" ? "Express" : "Standard"}
          </Text>
          <Text style={styles.bottomPriceValue}>${currentPrice.toFixed(2)}</Text>
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
            <Text style={styles.orderBtnText}>{isLiveChat ? "Buy Session" : "Order Now"}</Text>
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
  heroSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
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
  deliveryOptions: {
    gap: 12,
  },
  deliveryOption: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    overflow: "hidden",
  },
  deliveryOptionActive: {
    borderColor: Colors.dark.accent,
    backgroundColor: "rgba(212, 168, 83, 0.08)",
  },
  deliveryOptionActiveExpress: {
    borderColor: "#E8C878",
    backgroundColor: "rgba(232, 200, 120, 0.08)",
  },
  deliveryOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.dark.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    borderColor: Colors.dark.accent,
  },
  radioOuterActiveExpress: {
    borderColor: "#E8C878",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.dark.accent,
  },
  radioInnerExpress: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E8C878",
  },
  deliveryOptionInfo: {
    flex: 1,
    gap: 2,
  },
  deliveryOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  deliveryOptionTitleActive: {
    color: Colors.dark.accent,
  },
  deliveryOptionTitleActiveExpress: {
    color: "#E8C878",
  },
  deliveryOptionTime: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  deliveryOptionPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.dark.textSecondary,
  },
  deliveryOptionPriceActive: {
    color: Colors.dark.accent,
  },
  deliveryOptionPriceActiveExpress: {
    color: "#E8C878",
  },
  expressTag: {
    position: "absolute",
    top: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#E8C878",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomLeftRadius: 8,
    zIndex: 1,
  },
  expressTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0A0A1A",
    letterSpacing: 1,
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
  customInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  customInput: {
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: Colors.dark.text,
    fontSize: 16,
    width: 80,
    textAlign: "center",
  },
  customLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
});
