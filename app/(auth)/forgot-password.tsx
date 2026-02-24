import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/lib/auth-context";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";
import { fetch } from "expo/fetch";

type Step = "email" | "reset";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  async function handleSendCode() {
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: "reset" }),
      });
      const data = await res.json() as any;
      if (!res.ok) {
        setError(data.message || "Failed to send code");
      } else {
        setSuccessMsg("A reset code has been sent to your email");
        setStep("reset");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: "reset" }),
      });
      const data = await res.json() as any;
      if (!res.ok) {
        setError(data.message || "Failed to resend code");
      } else {
        setSuccessMsg("A new code has been sent to your email");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!code.trim()) {
      setError("Please enter the reset code");
      return;
    }
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setError("Please fill in all fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMsg("");
    const result = await resetPassword(email.trim().toLowerCase(), code.trim(), newPassword);
    setLoading(false);
    if (result.success) {
      router.dismissAll();
      router.replace("/(main)/services");
    } else {
      setError(result.error || "Password reset failed");
    }
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#0A0A1A", "#12122A", "#1A1035"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable onPress={() => step === "reset" ? setStep("email") : router.back()} hitSlop={20}>
          <Ionicons name="chevron-back" size={28} color={Colors.dark.text} />
        </Pressable>
      </View>

      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 20 }]}
        bottomOffset={40}
      >
        <View style={styles.titleArea}>
          <View style={styles.iconCircle}>
            <Ionicons name="key-outline" size={32} color={Colors.dark.accent} />
          </View>
          <Text style={styles.title}>{step === "email" ? "Forgot Password?" : "Reset Password"}</Text>
          <Text style={styles.subtitle}>
            {step === "email"
              ? "Enter your email and we'll send you a code to reset your password"
              : `Enter the code sent to ${email}`}
          </Text>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={Colors.dark.error} />
            <Text style={styles.errorText} selectable>{error}</Text>
          </View>
        )}

        {!!successMsg && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={16} color="#2ECC71" />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        )}

        {step === "email" && (
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

            <Pressable
              onPress={handleSendCode}
              disabled={loading}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
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
                  <Text style={styles.primaryBtnText}>Send Reset Code</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {step === "reset" && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Reset Code</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="keypad-outline" size={18} color={Colors.dark.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.dark.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="At least 6 characters"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.dark.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter new password"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <Pressable
              onPress={handleResetPassword}
              disabled={loading}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
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
                  <Text style={styles.primaryBtnText}>Reset Password</Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable onPress={handleResendCode} disabled={loading}>
              <Text style={styles.resendText}>Didn't get the code? <Text style={styles.resendLink}>Resend</Text></Text>
            </Pressable>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Remember your password?</Text>
          <Pressable onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.footerLink}>Sign In</Text>
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
    alignItems: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(212, 168, 83, 0.1)",
    borderWidth: 2,
    borderColor: Colors.dark.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 24,
    color: Colors.dark.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
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
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(46, 204, 113, 0.1)",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(46, 204, 113, 0.3)",
  },
  successText: {
    color: "#2ECC71",
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
  input: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 16,
  },
  primaryBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
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
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  resendText: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  resendLink: {
    color: Colors.dark.accent,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
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
