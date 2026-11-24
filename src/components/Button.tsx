import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, spacing } from '../theme';

type Variant = 'primary' | 'secondary' | 'success' | 'danger';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const BG: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.surface,
  success: colors.success,
  danger: colors.danger,
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  const textColor = variant === 'secondary' ? colors.primary : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: BG[variant] },
        variant === 'secondary' && styles.secondary,
        (pressed || isDisabled) && styles.dimmed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dimmed: {
    opacity: 0.6,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
