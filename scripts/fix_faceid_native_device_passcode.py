from pathlib import Path

gate = Path("components/security/AppLockGate.tsx")
text = gate.read_text()

text = text.replace(
'''import {
  Alert,
  AppState,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";''',
'''import {
  AppState,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";'''
)

text = text.replace('const APP_LOCK_PASSCODE_KEY = "wmg.appLock.passcode.v1";\n', "")

text = text.replace('  const [passcode, setPasscode] = useState("");\n  const [storedPasscode, setStoredPasscode] = useState<string | null>(null);\n', "")

text = text.replace(
'''      const savedPasscode = await AsyncStorage.getItem(APP_LOCK_PASSCODE_KEY);

      setStoredPasscode(savedPasscode);

      if (enabled !== "true" || !savedPasscode) {
        setStatus("unlocked");
        return;
      }''',
'''      if (enabled !== "true") {
        setStatus("unlocked");
        return;
      }'''
)

text = text.replace(
'''        fallbackLabel: "Use Passcode",
        cancelLabel: "Use Passcode",
        disableDeviceFallback: true,''',
'''        fallbackLabel: "Use Passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,''',
)

text = text.replace('        setPasscode("");\n        setStatus("unlocked");', '        setStatus("unlocked");')

start = text.find('  function handlePasscodeUnlock() {')
if start != -1:
    end = text.find('\n  if (status === "checking") {', start)
    text = text[:start] + text[end+1:]

old_modal = '''          <TextInput
            value={passcode}
            onChangeText={setPasscode}
            placeholder="Enter passcode"
            placeholderTextColor="rgba(255,255,255,0.45)"
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
            maxLength={12}
          />

          <HapticPressable style={styles.primaryButton} onPress={handlePasscodeUnlock}>
            <Text style={styles.primaryButtonText}>Unlock</Text>
          </HapticPressable>

          <HapticPressable
            style={styles.secondaryButton}
            onPress={() => {
              void unlockWithBiometrics();
            }}
          >
            <Text style={styles.secondaryButtonText}>Use Face ID</Text>
          </HapticPressable>'''

new_modal = '''          <HapticPressable
            style={styles.primaryButton}
            onPress={() => {
              void unlockWithBiometrics();
            }}
          >
            <Text style={styles.primaryButtonText}>Unlock with Face ID</Text>
          </HapticPressable>

          <Text style={styles.helperText}>
            If Face ID is unavailable, iOS will offer your device passcode.
          </Text>'''

text = text.replace(old_modal, new_modal)

start = text.find('  input: {')
if start != -1:
    end = text.find('  primaryButton:', start)
    text = text[:start] + text[end:]

text = text.replace(
'''  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: "#93C5FD",
    fontSize: 15,
    fontWeight: "700",
  },''',
'''  helperText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
    textAlign: "center",
  },'''
)

gate.write_text(text)

settings = Path("app/(tabs)/general-settings.tsx")
text = settings.read_text()

text = text.replace('import AsyncStorage from "@react-native-async-storage/async-storage";\n', "")
text = text.replace('import { Alert, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";',
                    'import { Alert, ScrollView, StyleSheet, Switch, View } from "react-native";')
text = text.replace('const APP_LOCK_PASSCODE_KEY = "wmg.appLock.passcode.v1";\n', "")

text = text.replace('  const [appLockPasscode, setAppLockPasscode] = useState("");\n', "")

text = text.replace(
'''      const savedAppLockEnabled = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);
      const savedAppLockPasscode = await AsyncStorage.getItem(APP_LOCK_PASSCODE_KEY);

      setAppLockEnabled(savedAppLockEnabled === "true" && Boolean(savedAppLockPasscode));
      setAppLockPasscode(savedAppLockPasscode ?? "");''',
'''      const savedAppLockEnabled = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);

      setAppLockEnabled(savedAppLockEnabled === "true");'''
)

text = text.replace(
'''      if (appLockEnabled && appLockPasscode.trim().length < 4) {
        Alert.alert("Passcode Required", "Enter at least 4 digits for App Lock.");
        return;
      }

      await saveProfileSettings(user.uid, nextProfile);
      await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, appLockEnabled ? "true" : "false");
      if (appLockEnabled) {
        await AsyncStorage.setItem(APP_LOCK_PASSCODE_KEY, appLockPasscode.trim());
      } else {
        await AsyncStorage.removeItem(APP_LOCK_PASSCODE_KEY);
      }''',
'''      await saveProfileSettings(user.uid, nextProfile);
      await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, appLockEnabled ? "true" : "false");'''
)

text = text.replace(
'''    if (!value) {
      setAppLockPasscode("");
    }''',
'''    '''
)

start = text.find('                {appLockEnabled ? (\n                  <TextInput')
if start != -1:
    end = text.find('              </ThemedCard>', start)
    text = text[:start] + text[end:]

text = text.replace(
'''                    <ThemedText color="secondary" style={styles.settingHelper}>
                      Require Face ID first, with passcode fallback, when opening the app.
                    </ThemedText>''',
'''                    <ThemedText color="secondary" style={styles.settingHelper}>
                      Require Face ID when opening the app. If Face ID is unavailable, iOS will offer the device passcode.
                    </ThemedText>'''
)

start = text.find('  appLockInput: {')
if start != -1:
    end = text.find('\n\n  settingTextBlock:', start)
    text = text[:start] + text[end+2:]

settings.write_text(text)

print("Updated Face ID app lock to use native iOS device passcode fallback.")
