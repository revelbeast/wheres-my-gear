from pathlib import Path

profile_path = Path("app/(tabs)/profile-settings.tsx")
general_path = Path("app/(tabs)/general-settings.tsx")

profile = profile_path.read_text()
general = general_path.read_text()

# Remove app lock imports from Profile Settings.
profile = profile.replace(
'''import {
  getBiometricLabel,
  isAppLockEnabled,
  isBiometricUnlockAvailable,
  setAppLockEnabled,
} from "../../lib/appLockService";
''',
"",
)

# Remove app lock state from Profile Settings.
profile = profile.replace(
'''  const [appLockEnabled, setAppLockEnabledState] = useState(false);
  const [appLockAvailable, setAppLockAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Face ID");
  const [savingAppLock, setSavingAppLock] = useState(false);
''',
"",
)

# Remove app lock effect from Profile Settings.
profile = profile.replace(
'''  useEffect(() => {
    let isMounted = true;

    async function loadAppLockSettings() {
      try {
        const [enabled, available, label] = await Promise.all([
          isAppLockEnabled(),
          isBiometricUnlockAvailable(),
          getBiometricLabel(),
        ]);

        if (!isMounted) return;

        setAppLockEnabledState(enabled);
        setAppLockAvailable(available);
        setBiometricLabel(label);
      } catch (error) {
        console.error("Failed to load app lock settings:", error);
      }
    }

    void loadAppLockSettings();

    return () => {
      isMounted = false;
    };
  }, []);

''',
"",
)

# Remove app lock handler from Profile Settings.
profile = profile.replace(
'''  async function handleToggleAppLock() {
    if (savingAppLock) return;

    if (!appLockAvailable && !appLockEnabled) {
      Alert.alert(
        "Face ID Unavailable",
        "Set up Face ID or Touch ID on this device first, then return to enable App Lock."
      );
      return;
    }

    try {
      setSavingAppLock(true);
      const nextEnabled = !appLockEnabled;
      await setAppLockEnabled(nextEnabled);
      setAppLockEnabledState(nextEnabled);

      Alert.alert(
        "App Lock",
        nextEnabled
          ? `${biometricLabel} will be required to unlock Where's My Gear.`
          : "App Lock has been turned off."
      );
    } catch (error: any) {
      Alert.alert("App Lock Error", error?.message ?? "Unable to update App Lock.");
    } finally {
      setSavingAppLock(false);
    }
  }

''',
"",
)

# Remove Account Security card from Profile Settings.
profile = profile.replace(
'''            <ThemedCard
              style={styles.formCard}
              contentStyle={styles.formCardContent}
            >
              <ThemedText variant="bodyStrong" style={styles.sectionTitle}>
                Account Security
              </ThemedText>

              <View style={styles.securityRow}>
                <View style={styles.securityTextWrap}>
                  <ThemedText variant="bodyStrong" style={styles.securityTitle}>
                    App Lock
                  </ThemedText>
                  <ThemedText color="secondary" style={styles.securitySubtitle}>
                    {appLockEnabled
                      ? `${biometricLabel} is required to unlock the app.`
                      : `Use ${biometricLabel} to protect your gear on this device.`}
                  </ThemedText>
                </View>

                <HapticPressable
                  onPress={handleToggleAppLock}
                  disabled={interactionBusy || savingAppLock}
                  style={[
                    styles.appLockToggle,
                    {
                      backgroundColor: appLockEnabled
                        ? theme.colors.primary
                        : theme.colors.inputSurface,
                      borderColor: appLockEnabled
                        ? theme.colors.primary
                        : theme.colors.border,
                    },
                    (interactionBusy || savingAppLock) && styles.disabledInteraction,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.appLockToggleText,
                      { color: appLockEnabled ? "#FFFFFF" : theme.colors.text },
                    ]}
                  >
                    {savingAppLock ? "Saving..." : appLockEnabled ? "On" : "Off"}
                  </ThemedText>
                </HapticPressable>
              </View>
            </ThemedCard>

''',
"",
)

# Remove Profile Settings app lock styles.
profile = profile.replace(
'''  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  securityTextWrap: {
    flex: 1,
  },

  securityTitle: {
    marginBottom: 4,
  },

  securitySubtitle: {
    lineHeight: 18,
  },

  appLockToggle: {
    minWidth: 72,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  appLockToggleText: {
    fontWeight: "900",
  },

''',
"",
)

# Add app lock imports to General Settings.
general = general.replace(
'''import { setHapticsEnabled as setGlobalHapticsEnabled } from "../../lib/haptics";''',
'''import {
  getBiometricLabel,
  isAppLockEnabled,
  isBiometricUnlockAvailable,
  setAppLockEnabled,
} from "../../lib/appLockService";
import { setHapticsEnabled as setGlobalHapticsEnabled } from "../../lib/haptics";''',
1,
)

# Add app lock state to General Settings.
general = general.replace(
'''  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const restorePurchasesVersionRef = useRef(0);''',
'''  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [appLockEnabled, setAppLockEnabledState] = useState(false);
  const [appLockAvailable, setAppLockAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Face ID");
  const [savingAppLock, setSavingAppLock] = useState(false);
  const restorePurchasesVersionRef = useRef(0);''',
1,
)

# Add app lock loader effect after settings loader effect.
general = general.replace(
'''  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSaveSettings() {''',
'''  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    let isMounted = true;

    async function loadAppLockSettings() {
      try {
        const [enabled, available, label] = await Promise.all([
          isAppLockEnabled(),
          isBiometricUnlockAvailable(),
          getBiometricLabel(),
        ]);

        if (!isMounted) return;

        setAppLockEnabledState(enabled);
        setAppLockAvailable(available);
        setBiometricLabel(label);
      } catch (error) {
        console.error("Failed to load app lock settings:", error);
      }
    }

    void loadAppLockSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSaveSettings() {''',
1,
)

# Add toggle handler before restore purchases.
general = general.replace(
'''  async function handleRestorePurchases() {''',
'''  async function handleToggleAppLock() {
    if (savingAppLock || saving || loading || actionLockRef.current) return;

    if (!appLockAvailable && !appLockEnabled) {
      Alert.alert(
        "Face ID Unavailable",
        "Set up Face ID or Touch ID on this device first, then return to enable App Lock."
      );
      return;
    }

    try {
      setSavingAppLock(true);
      const nextEnabled = !appLockEnabled;
      await setAppLockEnabled(nextEnabled);
      setAppLockEnabledState(nextEnabled);

      Alert.alert(
        "App Lock",
        nextEnabled
          ? `${biometricLabel} will be required to unlock Where's My Gear.`
          : "App Lock has been turned off."
      );
    } catch (error: any) {
      Alert.alert("App Lock Error", error?.message ?? "Unable to update App Lock.");
    } finally {
      setSavingAppLock(false);
    }
  }

  async function handleRestorePurchases() {''',
1,
)

# Add Account Security card before Restore Purchases.
general = general.replace(
'''              <ThemedCard style={styles.restoreCard}>''',
'''              <ThemedCard style={styles.accountSecurityCard}>
                <View style={styles.settingRow}>
                  <View style={styles.settingTextBlock}>
                    <ThemedText variant="bodyStrong">Account Security</ThemedText>
                    <ThemedText color="secondary" style={styles.settingHelper}>
                      {appLockEnabled
                        ? `${biometricLabel} is required to unlock the app.`
                        : `Use ${biometricLabel} to protect your gear on this device.`}
                    </ThemedText>
                  </View>

                  <Switch
                    value={appLockEnabled}
                    onValueChange={handleToggleAppLock}
                    disabled={saving || loading || savingAppLock || actionLockRef.current}
                    trackColor={{
                      false: activeTheme.colors.inputSurface,
                      true: "rgba(55,130,245,0.45)",
                    }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={activeTheme.colors.inputSurface}
                  />
                </View>
              </ThemedCard>

              <ThemedCard style={styles.restoreCard}>''',
1,
)

# Add General Settings card style.
general = general.replace(
'''  feedbackCard: {
    marginTop: 16,
  },

  restoreCard: {''',
'''  feedbackCard: {
    marginTop: 16,
  },

  accountSecurityCard: {
    marginTop: 16,
  },

  restoreCard: {''',
1,
)

profile_path.write_text(profile)
general_path.write_text(general)

print("Moved App Lock Account Security from Profile Settings to General Settings")
