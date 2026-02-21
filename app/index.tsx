import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, isLoading } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === "admin") {
        router.replace("/(admin)/dashboard");
      } else {
        router.replace("/(main)/services");
      }
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <LinearGradient colors={["#0A0A1A", "#12122A", "#1A1035"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={Colors.dark.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#0A0A1A", "#12122A", "#1A1035"]} style={StyleSheet.absoluteFill} />

      <View style={styles.content}>
        <Animated.View entering={FadeInUp.delay(200).duration(800)} style={styles.logoArea}>
          <View style={styles.orbContainer}>
            <LinearGradient
              colors={["#D4A853", "#E8C878", "#B08930"]}
              style={styles.orb}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.orbGlow} />
          </View>
          <Text style={styles.title}>MysticTxt</Text>
          <Text style={styles.subtitle}>Unveil Your Destiny</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.features}>
          <View style={styles.featureRow}>
            <Ionicons name="eye-outline" size={20} color={Colors.dark.accent} />
            <Text style={styles.featureText}>Psychic & Tarot Readings</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="flash-outline" size={20} color={Colors.dark.accent} />
            <Text style={styles.featureText}>Telepathy Mind Reading</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="chatbubble-outline" size={20} color={Colors.dark.accent} />
            <Text style={styles.featureText}>Live Chat with Advisor</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(800)} style={styles.actions}>
          <Pressable
            onPress={() => router.push("/(auth)/register")}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
          >
            <LinearGradient
              colors={["#D4A853", "#B08930"]}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.primaryBtnText}>Get Started</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(auth)/login")}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.secondaryBtnText}>Sign In</Text>
          </Pressable>
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
        <Pressable onPress={() => router.push("/(auth)/legacy-login")}>
          <Text style={styles.legacyLink}>Legacy User Login</Text>
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
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 48,
  },
  orbContainer: {
    width: 80,
    height: 80,
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  orb: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  orbGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(212, 168, 83, 0.15)",
  },
  title: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 36,
    color: Colors.dark.accent,
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 8,
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  features: {
    marginBottom: 48,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  featureText: {
    fontSize: 15,
    color: Colors.dark.text,
    fontWeight: "500",
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  btnGradient: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 14,
  },
  primaryBtnText: {
    color: "#0A0A1A",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  secondaryBtnText: {
    color: Colors.dark.accent,
    fontSize: 16,
    fontWeight: "600",
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  footer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  legacyLink: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    opacity: 0.6,
  },
});
