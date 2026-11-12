import React, { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Mail, LockKeyhole, Globe } from "lucide-react-native";
import { BrandMark } from "@/components/BrandMark";
import { colors } from "@/theme/colors";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/auth";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  const run = async (operation: () => Promise<unknown>) => {
    try {
      setBusy(true);
      await operation();
    } catch (error) {
      Alert.alert("Connexion impossible", error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = () => run(async () => {
    if (mode === "signin") {
      await signInWithEmail(email, password);
      return;
    }
    const result = await signUpWithEmail(email, password);
    if (!result.session) {
      Alert.alert("Vérifiez votre boîte mail", "Un lien de confirmation vient de vous être envoyé.");
    }
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 26 }}>
      <View style={{ alignItems: "center", marginBottom: 42 }}>
        <View style={{ width: 82, height: 82, borderRadius: 28, backgroundColor: "#1B1230", alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderColor: "#55318A" }}>
          <BrandMark size={58} />
        </View>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 }}>Galingtosh</Text>
        <Text style={{ color: colors.muted, fontSize: 14, marginTop: 9 }}>Votre studio audiovisuel intelligent.</Text>
      </View>

      <Pressable disabled={busy} onPress={() => run(signInWithGoogle)}
        style={{ height: 54, borderRadius: 15, borderWidth: 1, borderColor: colors.borderStrong, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.surface, opacity: busy ? 0.6 : 1 }}>
        <Globe color={colors.text} size={20} /><Text style={{ color: colors.text, fontWeight: "600" }}>Continuer avec Google</Text>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 23 }}>
        <View style={{ height: 1, flex: 1, backgroundColor: colors.border }} />
        <Text style={{ color: colors.subtle, fontSize: 12 }}>OU PAR E-MAIL</Text>
        <View style={{ height: 1, flex: 1, backgroundColor: colors.border }} />
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ height: 54, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, gap: 12 }}>
          <Mail color={colors.muted} size={19} />
          <TextInput value={email} onChangeText={setEmail} placeholder="Adresse e-mail" placeholderTextColor={colors.subtle}
            autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={{ flex: 1, color: colors.text, fontSize: 15 }} />
        </View>
        <View style={{ height: 54, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, gap: 12 }}>
          <LockKeyhole color={colors.muted} size={19} />
          <TextInput value={password} onChangeText={setPassword} placeholder="Mot de passe" placeholderTextColor={colors.subtle}
            secureTextEntry autoComplete={mode === "signin" ? "current-password" : "new-password"} style={{ flex: 1, color: colors.text, fontSize: 15 }} />
        </View>
        <Pressable disabled={busy || !email.trim() || password.length < 6} onPress={submitEmail}
          style={{ height: 54, borderRadius: 15, backgroundColor: colors.violet, alignItems: "center", justifyContent: "center", marginTop: 4, opacity: busy || !email.trim() || password.length < 6 ? 0.55 : 1 }}>
          {busy ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>{mode === "signin" ? "Se connecter" : "Créer mon compte"}</Text>}
        </Pressable>
        <Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")} style={{ alignItems: "center", padding: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {mode === "signin" ? "Nouveau sur Galingtosh ? " : "Déjà un compte ? "}
            <Text style={{ color: colors.violetBright, fontWeight: "700" }}>{mode === "signin" ? "Créer un compte" : "Se connecter"}</Text>
          </Text>
        </Pressable>
      </View>
      <Text style={{ color: colors.subtle, fontSize: 11, textAlign: "center", marginTop: 25, lineHeight: 17 }}>
        En continuant, vous acceptez les conditions d'utilisation de Galingtosh.
      </Text>
    </KeyboardAvoidingView>
  );
}
