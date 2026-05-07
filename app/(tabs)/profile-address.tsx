import { Check } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../components/auth/AuthProvider";
import AppHeader from "../../components/ui/AppHeader";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedCard,
  ThemedInput,
  ThemedText,
} from "../../components/ui/Themed";
import {
  AppAddress,
  AppProfile,
  getProfileSettings,
  saveProfileSettings,
} from "../../lib/settingsService";

const emptyAddress: AppAddress = {
  streetAddress: "",
  apartmentSuite: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
};

function formatState(value: string) {
  return value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
}

function formatZipCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 5);
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "words",
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <ThemedText variant="small" style={styles.label}>
        {label}
      </ThemedText>

      <ThemedInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        returnKeyType="done"
        editable={editable}
      />
    </View>
  );
}

export default function ProfileAddressScreen() {
  const { user } = useAuth();

  const isMountedRef = useRef(true);
  const loadRequestVersionRef = useRef(0);
  const actionLockRef = useRef(false);

  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [address, setAddress] = useState<AppAddress>(emptyAddress);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      loadRequestVersionRef.current += 1;
      actionLockRef.current = false;
    };
  }, []);

  const loadAddress = useCallback(async () => {
    const requestVersion = loadRequestVersionRef.current + 1;
    loadRequestVersionRef.current = requestVersion;

    if (!user) {
      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      setProfile(null);
      setAddress(emptyAddress);
      setLoading(false);
      return;
    }

    try {
      if (isMountedRef.current) {
        setLoading(true);
      }

      const data = await getProfileSettings(user.uid);

      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      setProfile(data);
      setAddress({
        ...emptyAddress,
        ...(data.address ?? {}),
      });
    } catch (err) {
      console.error("Failed to load address:", err);

      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      Alert.alert("Error", "Failed to load address.");
    } finally {
      if (
        isMountedRef.current &&
        loadRequestVersionRef.current === requestVersion
      ) {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    loadAddress();
  }, [loadAddress]);

  function isBusy() {
    return loading || saving || actionLockRef.current;
  }

  function updateAddressField<K extends keyof AppAddress>(
    key: K,
    value: AppAddress[K]
  ) {
    if (isBusy()) return;

    setAddress((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSaveAddress() {
    if (!user || !profile || isBusy()) return;

    actionLockRef.current = true;

    const cleanedAddress: AppAddress = {
      streetAddress: address.streetAddress.trim(),
      apartmentSuite: address.apartmentSuite.trim(),
      city: address.city.trim(),
      state: formatState(address.state),
      zipCode: formatZipCode(address.zipCode),
      country: address.country.trim(),
    };

    try {
      if (isMountedRef.current) {
        setSaving(true);
      }

      const nextProfile: AppProfile = {
        ...profile,
        address: cleanedAddress,
      };

      await saveProfileSettings(user.uid, nextProfile);

      if (!isMountedRef.current) {
        return;
      }

      setProfile(nextProfile);
      setAddress(cleanedAddress);

      Alert.alert("Saved", "Your address has been updated.");
    } catch (err) {
      console.error("Failed to save address:", err);

      if (!isMountedRef.current) {
        return;
      }

      Alert.alert("Error", "Failed to save address.");
    } finally {
      actionLockRef.current = false;

      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  }

  const formEditable = !isBusy();

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
            <AppHeader
              title="My Address"
              showBackButton
              backHref="/(tabs)/profile"
            />

            {loading ? (
              <ThemedText color="secondary">Loading address...</ThemedText>
            ) : !user ? (
              <ThemedCard>
                <ThemedText variant="title" style={styles.emptyTitle}>
                  Sign in required
                </ThemedText>
                <ThemedText color="secondary">
                  Please sign in to edit your address.
                </ThemedText>
              </ThemedCard>
            ) : (
              <>
                <ThemedCard style={styles.heroCard}>
                  <ThemedText variant="title" style={styles.heroTitle}>
                    Address Information
                  </ThemedText>
                  <ThemedText color="secondary" style={styles.heroText}>
                    Add or update your address details. This information is saved
                    to your profile settings.
                  </ThemedText>
                </ThemedCard>

                <ThemedCard>
                  <LabeledInput
                    label="Street Address"
                    value={address.streetAddress}
                    onChangeText={(text) =>
                      updateAddressField("streetAddress", text)
                    }
                    placeholder="Enter street address"
                    editable={formEditable}
                  />

                  <LabeledInput
                    label="Apartment / Suite"
                    value={address.apartmentSuite}
                    onChangeText={(text) =>
                      updateAddressField("apartmentSuite", text)
                    }
                    placeholder="Apt, suite, unit, etc."
                    editable={formEditable}
                  />

                  <LabeledInput
                    label="City"
                    value={address.city}
                    onChangeText={(text) => updateAddressField("city", text)}
                    placeholder="Enter city"
                    editable={formEditable}
                  />

                  <View style={styles.inlineFieldsRow}>
                    <View style={styles.stateField}>
                      <LabeledInput
                        label="State"
                        value={address.state}
                        onChangeText={(text) =>
                          updateAddressField("state", formatState(text))
                        }
                        placeholder="State"
                        autoCapitalize="characters"
                        editable={formEditable}
                      />
                    </View>

                    <View style={styles.zipField}>
                      <LabeledInput
                        label="ZIP Code"
                        value={address.zipCode}
                        onChangeText={(text) =>
                          updateAddressField("zipCode", formatZipCode(text))
                        }
                        placeholder="ZIP Code"
                        keyboardType="number-pad"
                        autoCapitalize="none"
                        editable={formEditable}
                      />
                    </View>
                  </View>

                  <LabeledInput
                    label="Country"
                    value={address.country}
                    onChangeText={(text) => updateAddressField("country", text)}
                    placeholder="Country"
                    editable={formEditable}
                  />
                </ThemedCard>

                <ThemedButton onPress={handleSaveAddress} disabled={isBusy()}>
                  <Check size={18} color="#fff" />
                  <ThemedText style={styles.saveButtonText}>
                    {saving ? "Saving..." : "Save Address"}
                  </ThemedText>
                </ThemedButton>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  flex: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 180,
  },

  heroCard: {
    marginBottom: 16,
  },

  heroTitle: {
    marginBottom: 6,
  },

  heroText: {
    lineHeight: 20,
  },

  fieldWrap: {
    marginBottom: 12,
  },

  inlineFieldsRow: {
    flexDirection: "row",
    gap: 12,
  },

  stateField: {
    flex: 0.42,
  },

  zipField: {
    flex: 0.58,
  },

  label: {
    fontWeight: "700",
    marginBottom: 6,
  },

  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  emptyTitle: {
    marginBottom: 6,
  },
});