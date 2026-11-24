import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, spacing } from '../theme';

interface Props {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  /** Optional per-option label (e.g. for display names). */
  getLabel?: (value: string) => string;
}

/** A simple modal-based dropdown (no native picker dependency). */
export function Dropdown({
  options,
  value,
  onChange,
  placeholder,
  style,
  getLabel = v => v,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        style={[styles.field, style]}
        onPress={() => setOpen(true)}>
        <Text
          style={[styles.fieldText, !value && styles.placeholder]}
          numberOfLines={1}>
          {value ? getLabel(value) : placeholder || 'Select…'}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <FlatList
              data={options}
              keyExtractor={(item, index) => `${index}-${item}`}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  No values configured. Add them in Settings.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.option,
                    pressed && styles.optionPressed,
                  ]}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}>
                  <Text
                    style={[
                      styles.optionText,
                      item === value && styles.optionSelected,
                    ]}>
                    {item === value ? '✓  ' : ''}
                    {getLabel(item)}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  fieldText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  placeholder: {
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 18,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: spacing.sm,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  optionPressed: {
    backgroundColor: '#E3F2FD',
  },
  optionText: {
    fontSize: 16,
    color: colors.text,
  },
  optionSelected: {
    fontWeight: '700',
    color: colors.primary,
  },
  empty: {
    padding: spacing.md,
    color: colors.textMuted,
  },
});
