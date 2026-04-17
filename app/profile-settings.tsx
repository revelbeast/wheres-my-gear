import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, UserCircle2, ImagePlus } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

import ScreenBackground from "../components/ui/ScreenBackground";
import AppHeader from "../components/ui/AppHeader";
import { colors } from "../theme/tokens";
import {
  AppProfile,
  getProfileSettings,
  saveProfileSettings,
} from "../lib/settingsService";

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = "sentences",
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, !editable && styles.inputDisabled]}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
      />
    </View>
  );
}

export default function ProfileSettingsScreen() {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const data = await getProfileSettings();
      setProfile(data);
    } catch (err) {
      console.error("Failed to load profile settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!profile) return;

    try {
      setSaving(true);
      await saveProfileSettings(profile);
    } catch (err) {
      console.error("Failed to save profile settings:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handlePickProfilePhoto() {
    if (!profile) return;

    try {
      setPickingImage(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Photo not selected", "No valid image was returned.");
        return;
      }

      const nextProfile = {
        ...profile,
        profilePhotoUri: asset.uri,
      };

      setProfile(nextProfile);
      await saveProfileSettings(nextProfile);
    } catch (err) {
      console.error("Failed to pick profile photo:", err);
      Alert.alert("Photo upload failed", "Please try selecting a photo again.");
    } finally {
      setPickingImage(false);
    }
  }

  function updateField<K extends keyof AppProfile>(key: K, value: AppProfile[K]) {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (loading || !profile) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.container}>
            <AppHeader title="Profile Settings" showBackButton />
            <Text style={styles.helperText}>Loading profile...</Text>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppHeader title="Profile Settings" showBackButton />

          <View style={styles.heroCard}>
            <View style={styles.heroPhotoWrap}>
              {profile.profilePhotoUri ? (
                <Image source={{ uri: profile.profilePhotoUri }} style={styles.heroPhoto} />
              ) : (
                <View style={styles.heroPhotoFallback}>
                  <UserCircle2 size={42} color={colors.text} />
                </View>
              )}
            </View>

            <View style={styles.heroTextWrap}>
              <Text style={styles.heroTitle}>
                {profile.firstName || profile.username}
              </Text>
              <Text style={styles.heroSubtitle}>
                Account basics only for now
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Account Basics</Text>

            <LabeledInput label="Username" value={profile.username} editable={false} />

            <LabeledInput
              label="First Name"
              value={profile.firstName}
              onChangeText={(t) => updateField("firstName", t)}
            />

            <LabeledInput
              label="Last Name"
              value={profile.lastName}
              onChangeText={(t) => updateField("lastName", t)}
            />

            <LabeledInput
              label="Email"
              value={profile.email}
              onChangeText={(t) => updateField("email", t)}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <LabeledInput
              label="Phone"
              value={profile.phoneNumber}
              onChangeText={(t) =>
                updateField("phoneNumber", formatPhoneNumber(t))
              }
              keyboardType="phone-pad"
            />

            <View style={styles.photoCard}>
              <View style={styles.photoHeader}>
                <ImagePlus size={18} color={colors.text} />
                <Text style={styles.photoTitle}>Profile Photo</Text>
              </View>

              <Text style={styles.photoText}>
                Select a photo from your device library.
              </Text>

              <Pressable
                style={[
                  styles.photoButton,
                  pickingImage && styles.photoButtonDisabled,
                ]}
                onPress={handlePickProfilePhoto}
                disabled={pickingImage}
              >
                <Text style={styles.photoButtonText}>
                  {pickingImage ? "Opening..." : "Choose Photo"}
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Check size={18} color="#fff" />
            <Text style={styles.saveButtonText}>
              {saving ? "Saving..." : "Save Profile"}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 16 },
  content: { padding: 16, paddingBottom: 140 },

  heroCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    flexDirection: "row",
    alignItems: "center",
  },

  heroPhotoWrap: {
    marginRight: 12,
  },

  heroPhoto: {
    width: 64,
    height: 64,
    borderRadius: 18,
  },

  heroPhotoFallback: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  heroTextWrap: {
    flex: 1,
  },

  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },

  heroSubtitle: {
    color: colors.textSecondary,
  },

  card: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
  },

  sectionTitle: {
    color: colors.text,
    fontWeight: "700",
    marginBottom: 10,
  },

  fieldWrap: {
    marginBottom: 10,
  },

  label: {
    color: colors.text,
    marginBottom: 4,
  },

  input: {
    backgroundColor: "rgba(7,20,44,0.7)",
    borderRadius: 12,
    padding: 12,
    color: colors.text,
  },

  inputDisabled: {
    opacity: 0.6,
  },

  photoCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  photoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },

  photoTitle: {
    color: colors.text,
    fontWeight: "600",
  },

  photoText: {
    color: colors.textSecondary,
    marginBottom: 10,
  },

  photoButton: {
    backgroundColor: "rgba(55,130,245,0.95)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  photoButtonDisabled: {
    opacity: 0.6,
  },

  photoButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  saveButton: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(55,130,245,0.95)",
    flexDirection: "row",
    gap: 8,
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  helperText: {
    color: colors.textSecondary,
  },
});