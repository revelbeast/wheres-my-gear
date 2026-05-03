import { BlurView } from "expo-blur";
import React, { forwardRef } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
} from "react-native";

import { useTheme } from "../../lib/useTheme";

type ThemedTextVariant =
  | "caption"
  | "small"
  | "body"
  | "bodyStrong"
  | "title"
  | "header";

type ThemedTextColor = "primary" | "secondary" | "muted" | "danger" | "blue";

export function ThemedText({
  children,
  variant = "body",
  color = "primary",
  style,
  ...rest
}: TextProps & {
  children: React.ReactNode;
  variant?: ThemedTextVariant;
  color?: ThemedTextColor;
}) {
  const theme = useTheme();

  const resolvedColor =
    color === "secondary"
      ? theme.colors.textSecondary
      : color === "muted"
        ? theme.colors.textMuted
        : color === "danger"
          ? theme.colors.danger
          : color === "blue"
            ? theme.colors.primary
            : theme.colors.text;

  return (
    <Text
      style={[
        {
          color: resolvedColor,
          fontSize: theme.fontSizes[variant],
        },
        variant === "bodyStrong" ||
        variant === "title" ||
        variant === "header"
          ? styles.boldText
          : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

export function ThemedCard({
  children,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.cardShell,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
        style,
      ]}
    >
      <BlurView
        intensity={theme.isLight ? 18 : 35}
        tint={theme.isLight ? "light" : "dark"}
        style={[styles.cardBlur, contentStyle]}
      >
        {children}
      </BlurView>
    </View>
  );
}

export const ThemedInput = forwardRef<TextInput, TextInputProps>(
  function ThemedInput({ style, placeholderTextColor, ...rest }, ref) {
    const theme = useTheme();

    return (
      <TextInput
        ref={ref}
        placeholderTextColor={placeholderTextColor ?? theme.colors.textMuted}
        style={[
          styles.input,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.inputSurface,
            borderColor: theme.colors.border,
            fontSize: theme.fontSizes.body,
          },
          style,
        ]}
        {...rest}
      />
    );
  }
);

export function ThemedButton({
  children,
  onPress,
  disabled = false,
  destructive = false,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  style?: ViewStyle | ViewStyle[];
}) {
  const theme = useTheme();

  return (
    <Pressable
      style={[
        styles.button,
        {
          backgroundColor: destructive
            ? theme.colors.danger
            : theme.colors.primary,
        },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {children}
    </Pressable>
  );
}

export function useThemedValues() {
  return useTheme();
}

const styles = StyleSheet.create({
  boldText: {
    fontWeight: "700",
  },

  cardShell: {
    marginBottom: 12,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
  },

  cardBlur: {
    padding: 16,
  },

  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
  },

  button: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  disabled: {
    opacity: 0.6,
  },
});