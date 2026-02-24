import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, ActivityIndicator, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, googleSignIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const [_request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  });

  React.useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      handleGoogleAuth(id_token);
    } else if (response?.type === "error") {
      setError("Google sign-in was cancelled or failed");
      setGoogleLoading(false);
    }
  }, [response]);

  async function handleGoogleAuth(idToken: string) {
    setGoogleLoading(true);
    setError("");
    const result = await googleSignIn(idToken);
    setGoogleLoading(false);
    if (result.success) {
      router.dismissAll();
      router.replace("/(main)/services");
    } else {
      setError(result.error || "Google sign-in failed");
    }
  }

  async function handleGooglePress() {
    setGoogleLoading(true);
    setError("");
    try {
      await promptAsync();
    } catch (err: any) {
      setError("Could not start Google sign-in");
      setGoogleLoading(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    const result = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (result.success) {
      router.dismissAll();
      router.replace("/(main)/services");
    } else {
      setError(result.error || "Login failed");
    }
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#0A0A1A", "#12122A", "#1A1035"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={20}>
          <Ionicons name="chevron-back" size={28} color={Colors.dark.text} />
        </Pressable>
      </View>

      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 20 }]}
        bottomOffset={40}
      >
        <View style={styles.titleArea}>
          <Image source={require("@/assets/images/icon.png")} style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 12 }} resizeMode="contain" />
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your journey</Text>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={Colors.dark.error} />
            <Text style={styles.errorText} selectable>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={handleGooglePress}
          disabled={googleLoading}
          style={({ pressed }) => [styles.googleBtn, pressed && styles.btnPressed]}
        >
          <View style={styles.googleBtnInner}>
            {googleLoading ? (
              <ActivityIndicator color="#333" size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#DB4437" />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </View>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={Colors.dark.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={Colors.dark.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.dark.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={Colors.dark.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [styles.loginBtn, pressed && styles.btnPressed]}
          >
            <LinearGradient
              colors={["#D4A853", "#B08930"]}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#0A0A1A" />
              ) : (
                <Text style={styles.loginBtnText}>Sign In</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={{ alignSelf: "center" }}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <Pressable onPress={() => router.replace("/(auth)/register")}>
            <Text style={styles.footerLink}>Sign Up</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    gap: 24,
  },
  titleArea: {
    marginTop: 20,
    marginBottom: 8,
  },
  title: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 28,
    color: Colors.dark.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    marginTop: 6,
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
  googleBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  googleBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 14,
  },
  googleBtnText: {
    color: "#333333",
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  dividerText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
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
  input: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 16,
  },
  loginBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  btnGradient: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 14,
  },
  loginBtnText: {
    color: "#0A0A1A",
    fontSize: 16,
    fontWeight: "700",
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
  },
  forgotText: {
    color: Colors.dark.accent,
    fontSize: 14,
    fontWeight: "500",
  },
  footerText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    color: Colors.dark.accent,
    fontSize: 14,
    fontWeight: "600",
  },
});
