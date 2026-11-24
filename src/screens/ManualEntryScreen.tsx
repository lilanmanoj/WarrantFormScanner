import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { Dropdown } from '../components/Dropdown';
import { buildWarrantRow } from '../services/rows';
import { appendRow, parseServiceAccount } from '../services/sheets';
import type { AppSettings } from '../storage';
import { colors, spacing } from '../theme';
import type { SheetTarget } from './HomeScreen';

interface Props {
  settings: AppSettings;
  target: SheetTarget;
  /** Active category names, in the user's order. */
  categoryOptions: string[];
  /** The home screen's category; changing it here changes it there too. */
  category: string;
  onCategoryChange: (value: string) => void;
  onDone: () => void;
}

/** Type in warrants by hand; each "Next" adds one row to the sheet. */
export function ManualEntryScreen({
  settings,
  target,
  categoryOptions,
  category,
  onCategoryChange,
  onDone,
}: Props) {
  const [warrantNo, setWarrantNo] = useState('');
  const [total, setTotal] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const savedNumbers = useRef(new Set<string>()).current;
  const noInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const totalInput = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleDone = useCallback(() => {
    if (saving) {
      return;
    }
    if (warrantNo.trim() || total.trim()) {
      Alert.alert('Discard this entry?', 'The No / Total you typed has not been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onDone },
      ]);
      return;
    }
    onDone();
  }, [saving, warrantNo, total, onDone]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleDone();
      return true;
    });
    return () => sub.remove();
  }, [handleDone]);

  const no = warrantNo.trim();
  const isDuplicate = no !== '' && savedNumbers.has(no);
  const canSubmit = Boolean(category && no && total.trim()) && !saving;

  const handleNext = async () => {
    if (!canSubmit) {
      const missing = [
        !category && 'Category',
        !no && 'No',
        !total.trim() && 'Total',
      ].filter(Boolean);
      Alert.alert('Missing fields', `Please fill in: ${missing.join(', ')}.`);
      return;
    }
    setSaving(true);
    try {
      const sa = parseServiceAccount(settings.serviceAccountJson);
      await appendRow(
        sa,
        target.spreadsheetId,
        target.sheetTitle,
        buildWarrantRow(category, no, total),
      );
      savedNumbers.add(no);
      setSavedCount(c => c + 1);
      setToast(`Saved No ${no}`);
      setWarrantNo('');
      setTotal('');
      noInput.current?.focus();
    } catch (e: any) {
      Alert.alert('Could not save to Google Sheet', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <View style={styles.flex}>
          <Text style={styles.title}>Manual Enter</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {target.sheetTitle} · Saved: {savedCount}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={handleDone}
          disabled={saving}
          hitSlop={8}
          style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
          <Text style={styles.doneText}>Done Edit</Text>
        </Pressable>
      </View>

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>✓ {toast}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Category</Text>
        <Dropdown
          options={categoryOptions}
          value={category}
          onChange={onCategoryChange}
          placeholder="Select a category"
        />

        <Text style={styles.label}>No</Text>
        <TextInput
          ref={noInput}
          style={styles.input}
          value={warrantNo}
          onChangeText={setWarrantNo}
          keyboardType="number-pad"
          placeholder="e.g. 282681"
          placeholderTextColor={colors.textMuted}
          returnKeyType="next"
          onSubmitEditing={() => totalInput.current?.focus()}
          blurOnSubmit={false}
          editable={!saving}
          autoFocus
        />
        {isDuplicate ? (
          <Text style={styles.warning}>⚠ This No was already saved in this session.</Text>
        ) : null}

        <Text style={styles.label}>Total</Text>
        <TextInput
          ref={totalInput}
          style={styles.input}
          value={total}
          onChangeText={setTotal}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="e.g. 2050:00 (2050 is fine too)"
          placeholderTextColor={colors.textMuted}
          returnKeyType="send"
          onSubmitEditing={handleNext}
          editable={!saving}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Next  ›" onPress={handleNext} loading={saving} style={styles.nextButton} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  doneButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  pressed: { opacity: 0.7 },
  doneText: {
    color: '#fff',
    fontWeight: '700',
  },
  toast: {
    backgroundColor: colors.success,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  input: {
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.surface,
    letterSpacing: 1,
  },
  warning: {
    color: colors.warning,
    fontSize: 13,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  nextButton: {
    minHeight: 56,
  },
});
