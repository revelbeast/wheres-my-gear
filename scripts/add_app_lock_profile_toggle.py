from pathlib import Path

path = Path("app/(tabs)/profile-settings.tsx")
text = path.read_text()

old_import = '''import { publishAppBackgroundUpdate } from "../../lib/backgroundUpdateBus";'''
new_import = '''import {
  getBiometricLabel,
  isAppLockEnabled,
  isBiometricUnlockAvailable,
  setAppLockEnabled,
} from "../../lib/appLockService";
import { publishAppBackgroundUpdate } from "../../lib/backgroundUpdateBus";'''

if old_import not in text:
    raise SystemExit("Could not find background update import")
text = text.replace(old_import, new_import, 1)

old_state = '''  const [showBackgroundOptions, setShowBackgroundOptions] = useState(false);
  const [, setActionLockRevision] = useState(0);'''

new_state = '''  const [showBackgroundOptions, setShowBackgroundOptions] = useState(false);
  const [appLockEnabled, setAppLockEnabledState] = useState(false);
  const [appLockAvailable, setAppLockAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Face ID");
  const [savingAppLock, setSavingAppLock] = useState(false);
  const [, setActionLockRevision] = useState(0);'''

if old_state not in text:
    raise SystemExit("Could not find state block")
text = text.replace(old_state, new_state, 1)

effect_anchor = '''  useEffect(() => {
    const loadVersion = profileLoadVersionRef.current + 1;'''

app_lock_effect = '''  useEffect(() => {
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

'''

if effect_anchor not in text:
    raise SystemExit("Could not find profile load effect anchor")
text = text.replace(effect_anchor, app_lock_effect + effect_anchor, 1)

handler_anchor = '''  async function handleSignOut() {'''

handler = '''  async function handleToggleAppLock() {
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

'''

if handler_anchor not in text:
    raise SystemExit("Could not find handleSignOut anchor")
text = text.replace(handler_anchor, handler + handler_anchor, 1)

card_anchor = '''            <ThemedCard
              style={styles.actionsCard}
              contentStyle={styles.actionsCardContent}
            >'''

security_card = '''            <ThemedCard
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

'''

if card_anchor not in text:
    raise SystemExit("Could not find actions card anchor")
text = text.replace(card_anchor, security_card + card_anchor, 1)

style_anchor = '''  formCardContent: {
    padding: 14,
  },

  sectionTitle: {'''

style_insert = '''  formCardContent: {
    padding: 14,
  },

  securityRow: {
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

  sectionTitle: {'''

if style_anchor not in text:
    raise SystemExit("Could not find styles anchor")
text = text.replace(style_anchor, style_insert, 1)

path.write_text(text)
print("Added App Lock toggle to Profile Settings")
