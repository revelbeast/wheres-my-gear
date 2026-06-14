from pathlib import Path

p = Path("app/(tabs)/general-settings.tsx")
text = p.read_text()

if 'import AsyncStorage from "@react-native-async-storage/async-storage";' not in text:
    text = text.replace(
        'import { Check, Moon, Sun } from "lucide-react-native";\n',
        'import AsyncStorage from "@react-native-async-storage/async-storage";\nimport { Check, Moon, Sun } from "lucide-react-native";\n',
    )

text = text.replace(
    '  Alert, ScrollView, StyleSheet, Switch, View } from "react-native";',
    '  Alert, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";',
)

if 'const APP_LOCK_ENABLED_KEY = "wmg.appLock.enabled.v1";' not in text:
    text = text.replace(
        'import { publishAppThemeUpdate } from "../../lib/themeUpdateBus";\n',
        'import { publishAppThemeUpdate } from "../../lib/themeUpdateBus";\n\nconst APP_LOCK_ENABLED_KEY = "wmg.appLock.enabled.v1";\nconst APP_LOCK_PASSCODE_KEY = "wmg.appLock.passcode.v1";\n',
    )

if 'const [appLockEnabled, setAppLockEnabled]' not in text:
    text = text.replace(
        '  const [hapticsEnabled, setHapticsEnabled] = useState(true);\n',
        '  const [hapticsEnabled, setHapticsEnabled] = useState(true);\n  const [appLockEnabled, setAppLockEnabled] = useState(false);\n  const [appLockPasscode, setAppLockPasscode] = useState("");\n',
    )

if 'const savedAppLockEnabled = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);' not in text:
    text = text.replace(
        '      const nextHapticsEnabled = data.hapticsEnabled ?? true;\n\n      setProfile(data);',
        '      const nextHapticsEnabled = data.hapticsEnabled ?? true;\n      const savedAppLockEnabled = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);\n      const savedAppLockPasscode = await AsyncStorage.getItem(APP_LOCK_PASSCODE_KEY);\n\n      setAppLockEnabled(savedAppLockEnabled === "true" && Boolean(savedAppLockPasscode));\n      setAppLockPasscode(savedAppLockPasscode ?? "");\n\n      setProfile(data);',
    )

if 'await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, appLockEnabled ? "true" : "false");' not in text:
    text = text.replace(
        '      await saveProfileSettings(user.uid, nextProfile);\n',
        '      if (appLockEnabled && appLockPasscode.trim().length < 4) {\n        Alert.alert("Passcode Required", "Enter at least 4 digits for App Lock.");\n        return;\n      }\n\n      await saveProfileSettings(user.uid, nextProfile);\n      await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, appLockEnabled ? "true" : "false");\n      if (appLockEnabled) {\n        await AsyncStorage.setItem(APP_LOCK_PASSCODE_KEY, appLockPasscode.trim());\n      } else {\n        await AsyncStorage.removeItem(APP_LOCK_PASSCODE_KEY);\n      }\n',
        1,
    )

if 'function handleAppLockChange(value: boolean)' not in text:
    text = text.replace(
        '  function handleHapticsChange(value: boolean) {\n    if (saving || loading || actionLockRef.current) return;\n\n    setHapticsEnabled(value);\n  }\n',
        '  function handleHapticsChange(value: boolean) {\n    if (saving || loading || actionLockRef.current) return;\n\n    setHapticsEnabled(value);\n  }\n\n  function handleAppLockChange(value: boolean) {\n    if (saving || loading || actionLockRef.current) return;\n\n    setAppLockEnabled(value);\n    if (!value) {\n      setAppLockPasscode("");\n    }\n  }\n',
    )

app_lock_card = '''              <ThemedCard style={styles.feedbackCard}>
                <View style={styles.settingRow}>
                  <View style={styles.settingTextBlock}>
                    <ThemedText variant="bodyStrong">Face ID App Lock</ThemedText>
                    <ThemedText color="secondary" style={styles.settingHelper}>
                      Require Face ID first, with passcode fallback, when opening the app.
                    </ThemedText>
                  </View>

                  <Switch
                    value={appLockEnabled}
                    onValueChange={handleAppLockChange}
                    disabled={saving || loading || actionLockRef.current}
                    trackColor={{
                      false: activeTheme.colors.inputSurface,
                      true: "rgba(55,130,245,0.45)",
                    }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={activeTheme.colors.inputSurface}
                  />
                </View>

                {appLockEnabled ? (
                  <TextInput
                    value={appLockPasscode}
                    onChangeText={setAppLockPasscode}
                    placeholder="Set fallback passcode"
                    placeholderTextColor={activeTheme.colors.textSecondary}
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={12}
                    style={[
                      styles.appLockInput,
                      {
                        borderColor: activeTheme.colors.border,
                        backgroundColor: activeTheme.colors.inputSurface,
                        color: activeTheme.colors.text,
                      },
                    ]}
                  />
                ) : null}
              </ThemedCard>

'''

if 'Face ID App Lock' not in text:
    text = text.replace('              <ThemedCard style={styles.restoreCard}>', app_lock_card + '              <ThemedCard style={styles.restoreCard}>')

if 'appLockInput:' not in text:
    text = text.replace(
        '  settingTextBlock: {',
        '  appLockInput: {\n    borderWidth: 1,\n    borderRadius: 14,\n    paddingHorizontal: 14,\n    paddingVertical: 12,\n    fontSize: 16,\n    marginTop: 14,\n  },\n\n  settingTextBlock: {',
    )

p.write_text(text)
print("Added App Lock settings.")
