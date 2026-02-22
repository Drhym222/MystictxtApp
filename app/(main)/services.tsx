import React from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";
import type { Service } from "@shared/schema";

const SERVICE_ICONS: Record<string, string> = {
  "psychic-reading": "eye-outline",
  "tarot-reading": "grid-outline",
  "telepathy-mind-reading": "radio-outline",
  "find-lost-items": "search-outline",
  "live-chat": "chatbubbles-outline",
};

const SERVICE_COLORS: Record<string, [string, string]> = {
  "psychic-reading": ["#6C3483", "#4A235A"],
  "tarot-reading": ["#1A5276", "#154360"],
  "telepathy-mind-reading": ["#1E8449", "#145A32"],
  "find-lost-items": ["#B7950B", "#7D6608"],
  "live-chat": ["#C0392B", "#922B21"],
};

function ServiceCard({ service }: { service: Service }) {
  const iconName = SERVICE_ICONS[service.slug] || "star-outline";
  const colors = SERVICE_COLORS[service.slug] || ["#2C3E50", "#1A252F"];
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/service/[slug]", params: { slug: service.slug } })}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <LinearGradient
        colors={colors}
        style={styles.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.cardIconWrap}>
          <Ionicons name={iconName as any} size={28} color="rgba(255,255,255,0.9)" />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{service.title}</Text>
          <Text style={styles.cardDesc} numberOfLines={2}>{service.description}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardPrice}>
              {service.slug === "live-chat" ? "From $3.99/5min" : `From $${(service.priceUsdCents / 100).toFixed(2)}`}
            </Text>
            <View style={styles.cardArrow}>
              <Ionicons name="arrow-forward" size={16} color={Colors.dark.accent} />
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ["api/services"],
  });

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#0A0A1A", "#12122A"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>MysticTxt</Text>
          <Text style={styles.headerSubtitle}>Choose your reading</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="sparkles" size={24} color={Colors.dark.accent} />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.accent} />
        </View>
      ) : (
        <FlatList
          data={services || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ServiceCard service={item} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(services && services.length > 0)}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={Colors.dark.textSecondary} />
              <Text style={styles.emptyText}>No services available</Text>
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
    fontSize: 24,
    color: Colors.dark.accent,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(212, 168, 83, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 14,
    paddingTop: 4,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  cardGradient: {
    padding: 20,
    flexDirection: "row",
    gap: 16,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  cardDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  cardPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.dark.accentLight,
  },
  cardArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    gap: 12,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },
});
