import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { Dropdown } from '../components/Dropdown';
import {
  parseServiceAccount,
  parseSpreadsheetUrl,
  resolveSheetTitle,
} from '../services/sheets';
import type { AppSettings } from '../storage';
import { colors, spacing } from '../theme';

export interface SheetTarget {
  spreadsheetId: string;
  sheetTitle: string;
}

interface Props {
  settings: AppSettings;
  /** Active category names, in the user's order. */
  categoryOptions: string[];
  sheetUrl: string;
  onSheetUrlChange: (url: string) => void;
  selectedOption: string;
  onSelectedOptionChange: (value: string) => void;
  onOpenSettings: () => void;
  onStartScan: (target: SheetTarget) => void;
}

export function HomeScreen({
  settings,
  categoryOptions,
  sheetUrl,
  onSheetUrlChange,
  selectedOption,
  onSelectedOptionChange,
  onOpenSettings,
  onStartScan,
}: Props) {
  const [starting, setStarting] = useState(false);

  const aiReady = Boolean(settings.geminiApiKey && settings.geminiModel);
  const sheetsReady = Boolean(settings.serviceAccountJson);

  const handleStartScan = async () => {
    const problems: string[] = [];
    if (!selectedOption) {
      problems.push(
        categoryOptions.length === 0
          ? 'Add a category in Settings → Category Data.'
          : 'Select a category.',
      );
    }
    const ref = parseSpreadsheetUrl(sheetUrl.trim());
    if (!ref) {
      problems.push('Paste a valid Google Sheet URL.');
    }
    if (!aiReady) {
      problems.push('Set up the Gemini API key in Settings.');
    }
    if (!sheetsReady) {
      problems.push('Add the Google service account key in Settings.');
    }
    if (problems.length > 0 || !ref) {
      Alert.alert('Before scanning', problems.join('\n'));
      return;
    }

    setStarting(true);
    try {
      // Verifies the sheet is reachable before the user starts scanning.
      const sa = parseServiceAccount(settings.serviceAccountJson);
      const sheetTitle = await resolveSheetTitle(sa, ref);
      onStartScan({ spreadsheetId: ref.spreadsheetId, sheetTitle });
    } catch (e: any) {
      Alert.alert('Cannot access Google Sheet', e?.message ?? String(e));
    } finally {
      setStarting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Warrant Form Scanner</Text>
          <Button
            title="⚙  Settings"
            variant="secondary"
            onPress={onOpenSettings}
            style={styles.settingsButton}
          />
        </View>

        <View style={styles.statusRow}>
          <StatusPill ok={aiReady} label={aiReady ? 'Gemini ready' : 'Gemini not set'} />
          <StatusPill ok={sheetsReady} label={sheetsReady ? 'Sheets key set' : 'Sheets not set'} />
        </View>

        <Text style={styles.label}>Category</Text>
        <Dropdown
          options={categoryOptions}
          value={selectedOption}
          onChange={onSelectedOptionChange}
          placeholder="Select a category"
        />

        <Text style={styles.label}>Google Sheet URL</Text>
        <TextInput
          style={styles.textArea}
          value={sheetUrl}
          onChangeText={onSheetUrlChange}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          placeholderTextColor={colors.textMuted}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          textAlignVertical="top"
        />
        <Text style={styles.hint}>
          Rows are added to the tab in the URL (#gid=…), or the first tab.
        </Text>

        <Button
          title="Start scan"
          onPress={handleStartScan}
          loading={starting}
          style={styles.startButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={[styles.pill, ok ? styles.pillOk : styles.pillWarn]}>
      <Text style={[styles.pillText, ok ? styles.pillTextOk : styles.pillTextWarn]}>
        {ok ? '●' : '○'} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  settingsButton: {
    minHeight: 40,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  pillOk: { backgroundColor: '#E8F5E9' },
  pillWarn: { backgroundColor: '#FFF3E0' },
  pillText: { fontWeight: '600' },
  pillTextOk: { color: colors.success },
  pillTextWarn: { color: colors.warning },
  label: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  startButton: {
    marginTop: spacing.lg,
    minHeight: 60,
  },
});
