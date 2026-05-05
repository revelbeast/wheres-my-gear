import { router } from "expo-router";
import { ChevronRight, Shield, UserCircle2 } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../components/ui/AppHeader";
import HapticPressable from "../../components/ui/HapticPressable";
import ScreenBackground from "../../components/ui/ScreenBackground";
import { useThemedValues } from "../../components/ui/Themed";
import { useInteractionLock } from "../../lib/useInteractionLock";

type SettingRowProps = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
};

function SettingRow({
  icon,
  title,
  subtitle,
  onPress,
  disabled = false,
}: SettingRowProps) {
  const theme = useThemedValues();

  return (
    <HapticPressable
      style={[
        styles.rowCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        disabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.rowLeft}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: theme.colors.iconSurface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {icon}
        </View>

        <View style={styles.textWrap}>
          <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
            {title}
          </Text>
          <Text
            style={[
              styles.rowSubtitle,
              { color: theme.colors.textSecondary },
            ]}
          >
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.chevronWrap}>
        <ChevronRight size={18} color={theme.colors.textSecondary} />
      </View>
    </HapticPressable>
  );
}

export default function SettingsScreen() {
  const theme = useThemedValues();

  const { isLocked: interactionLocked } = useInteractionLock(450);

  const navigationTransitionLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
      }
    };
  }, []);

  function lockNavigationTransition() {
    if (navigationTransitionLockedRef.current) {
      return false;
    }

    navigationTransitionLockedRef.current = true;

    if (navigationUnlockTimeoutRef.current) {
      clearTimeout(navigationUnlockTimeoutRef.current);
    }

    navigationUnlockTimeoutRef.current = setTimeout(() => {
      navigationTransitionLockedRef.current = false;
      navigationUnlockTimeoutRef.current = null;
    }, 1500);

    return true;
  }

  function runNavigationAction(action: () => void) {
    if (interactionLocked || navigationTransitionLockedRef.current) {
      return;
    }

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    action();
  }

  function handleOpenProfile() {
    runNavigationAction(() => {
      router.push("/profile");
    });
  }

  function handleOpenPasswordManagement() {
    runNavigationAction(() => {
      router.push("/password-management");
    });
  }

  const navigationDisabled =
    interactionLocked || navigationTransitionLockedRef.current;

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader title="Profile & Settings" showBackButton />

          <HapticPressable
            style={[
              styles.profileCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
              navigationDisabled && styles.disabledButton,
            ]}
            onPress={handleOpenProfile}
            disabled={navigationDisabled}
          >
            <View
              style={[
                styles.profileIcon,
                {
                  backgroundColor: theme.colors.iconSurface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <UserCircle2 size={42} color={theme.colors.text} />
            </View>

            <View style={styles.profileTextWrap}>
              <Text
                style={[
                  styles.profileEyebrow,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Account
              </Text>
              <Text style={[styles.profileTitle, { color: theme.colors.text }]}>
                Profile
              </Text>
              <Text
                style={[
                  styles.profileSubtitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Account basics and appearance settings
              </Text>
            </View>

            <View style={styles.chevronWrap}>
              <ChevronRight size={18} color={theme.colors.textSecondary} />
            </View>
          </HapticPressable>

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionEyebrow,
                { color: theme.colors.textSecondary },
              ]}
            >
              Security
            </Text>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Account access
            </Text>

            <SettingRow
              icon={<Shield size={18} color={theme.colors.text} />}
              title="Password Management"
              subtitle="Update password and account security settings"
              onPress={handleOpenPasswordManagement}
              disabled={navigationDisabled}
            />
          </View>

          <View
            style={[
              styles.noteCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.noteEyebrow,
                { color: theme.colors.textSecondary },
              ]}
            >
              Current scope
            </Text>
            <Text style={[styles.noteTitle, { color: theme.colors.text }]}>
              Simplified for now
            </Text>
            <Text
              style={[
                styles.noteText,
                { color: theme.colors.textSecondary },
              ]}
            >
              Communication, privacy, professional details, and activity logs
              have been removed for now to keep settings focused and easier to
              manage.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 140,
  },

  profileCard: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  profileIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 14,
  },

  profileTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  profileEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },

  profileTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
    lineHeight: 26,
  },

  profileSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },

  section: {
    marginBottom: 18,
  },

  sectionEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    lineHeight: 20,
  },

  rowCard: {
    marginBottom: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 12,
  },

  textWrap: {
    flex: 1,
  },

  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
    lineHeight: 20,
  },

  rowSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },

  chevronWrap: {
    width: 24,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  noteCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },

  noteEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },

  noteTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 22,
  },

  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },

  disabledButton: {
    opacity: 0.55,
  },
});