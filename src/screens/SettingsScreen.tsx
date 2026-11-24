import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import {
  GeminiModel,
  listGeminiModels,
  pickDefaultModel,
} from '../services/gemini';
import { getAccessToken, parseServiceAccount } from '../services/sheets';
import { AppSettings, Processor, PROCESSOR_LABELS } from '../storage';
import { colors, spacing } from '../theme';

interface Props {
  settings: AppSettings;
  /** Number of categories / active categories, shown on the Category Data button. */
  categoryCount: number;
  activeCategoryCount: number;
  onOpenCategories: () => void;
  onSave: (settings: AppSettings) => Promise<void>;
  onBack: () => void;
}

type Status = { ok: boolean; message: string } | null;

export function SettingsScreen({
  settings,
  categoryCount,
  activeCategoryCount,
  onOpenCategories,
  onSave,
  onBack,
}: Props) {
  const [processor, setProcessor] = useState<Processor>(settings.processor);
  const [apiKey, setApiKey] = useState(settings.geminiApiKey);
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(settings.geminiModel);
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [serviceAccountJson, setServiceAccountJson] = useState(
    settings.serviceAccountJson,
  );
  const [saving, setSaving] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<Status>(null);
  const [sheetsStatus, setSheetsStatus] = useState<Status>(null);

  const serviceAccountEmail = useMemo(() => {
    try {
      return parseServiceAccount(serviceAccountJson).client_email;
    } catch {
      return '';
    }
  }, [serviceAccountJson]);

  const modelOptions = useMemo(() => {
    const names = models.map(m => m.name);
    if (model && !names.includes(model)) {
      names.unshift(model);
    }
    return names;
  }, [models, model]);

  const handleSave = async () => {
    setSaving(true);
    setGeminiStatus(null);
    setSheetsStatus(null);

    const trimmedKey = apiKey.trim();
    let chosenModel = model;

    // 1. Connect to Gemini.
    if (trimmedKey) {
      try {
        const available = await listGeminiModels(trimmedKey);
        setModels(available);
        if (!available.some(m => m.name === chosenModel)) {
          chosenModel = pickDefaultModel(available);
          setModel(chosenModel);
        }
        setGeminiStatus(
          chosenModel
            ? { ok: true, message: `Connected. Using ${chosenModel.replace('models/', '')}.` }
            : { ok: false, message: 'Connected, but no Gemini vision models are available for this key.' },
        );
      } catch (e: any) {
        setGeminiStatus({ ok: false, message: e?.message ?? String(e) });
      }
    } else {
      // Only required when Gemini is the selected reader.
      setGeminiStatus(
        processor === 'gemini' ? { ok: false, message: 'Enter a Gemini API key.' } : null,
      );
    }

    // 2. Verify the Google service account can sign in.
    const trimmedJson = serviceAccountJson.trim();
    if (trimmedJson) {
      try {
        const sa = parseServiceAccount(trimmedJson);
        await getAccessToken(sa);
        setSheetsStatus({
          ok: true,
          message: `Signed in as ${sa.client_email}. Share your Google Sheet with this email (Editor).`,
        });
      } catch (e: any) {
        setSheetsStatus({ ok: false, message: e?.message ?? String(e) });
      }
    } else {
      setSheetsStatus({ ok: false, message: 'Paste a service account key JSON.' });
    }

    // 3. Persist everything (even if a connection check failed, so nothing typed is lost).
    try {
      await onSave({
        processor,
        geminiApiKey: trimmedKey,
        geminiModel: chosenModel,
        serviceAccountJson: trimmedJson,
      });
    } catch (e: any) {
      Alert.alert('Could not save settings', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {/* ---------- Reader ---------- */}
        <Text style={styles.section}>Scan reader</Text>
        <Text style={styles.hint}>
          Built-in: reads the printed No on the phone in about a second – free and
          offline. It can't read handwriting, so you type the Total on the review
          screen (the cursor is already there).{'\n'}Gemini AI: reads both No and the
          handwritten Total, but takes a few seconds per scan and needs internet and an
          API key.
        </Text>
        <Dropdown
          options={Object.keys(PROCESSOR_LABELS)}
          value={processor}
          onChange={v => setProcessor(v as Processor)}
          getLabel={v => PROCESSOR_LABELS[v as Processor] ?? v}
        />

        {/* ---------- Gemini ---------- */}
        <Text style={styles.section}>
          Google Gemini{processor === 'gemini' ? '' : ' (optional)'}
        </Text>
        <Text style={styles.hint}>
          Create an API key at aistudio.google.com/apikey (the same key the Gemini
          CLI uses as GEMINI_API_KEY).
        </Text>
        <Text style={styles.label}>API key</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="AIza…"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable onPress={() => setShowKey(v => !v)} style={styles.showButton}>
            <Text style={styles.showText}>{showKey ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Model</Text>
        <Dropdown
          options={modelOptions}
          value={model}
          onChange={setModel}
          placeholder="Save once to load available models"
        />
        <StatusText status={geminiStatus} />

        {/* ---------- Google Sheets ---------- */}
        <Text style={styles.section}>Google Sheets</Text>
        <Text style={styles.hint}>
          In Google Cloud Console: enable the Google Sheets API, create a service
          account, add a JSON key, and paste the whole JSON file below. Then share
          your sheet with the service account email.
        </Text>
        <Text style={styles.label}>Service account key (JSON)</Text>
        <TextInput
          style={[styles.input, styles.jsonInput]}
          value={serviceAccountJson}
          onChangeText={setServiceAccountJson}
          placeholder='{ "type": "service_account", … }'
          placeholderTextColor={colors.textMuted}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
        />
        {serviceAccountEmail ? (
          <Text style={styles.hint} selectable>
            Share the sheet with: {serviceAccountEmail}
          </Text>
        ) : null}
        <StatusText status={sheetsStatus} />

        {/* ---------- Categories ---------- */}
        <Text style={styles.section}>Categories</Text>
        <Text style={styles.hint}>
          Values for the Category dropdown on the home screen. Changes there are saved
          immediately.
        </Text>
        <Button
          title={`Category Data  (${activeCategoryCount} active / ${categoryCount})  ›`}
          variant="secondary"
          onPress={onOpenCategories}
        />

        <Button
          title="Save"
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatusText({ status }: { status: Status }) {
  if (!status) {
    return null;
  }
  return (
    <Text
      style={[styles.status, { color: status.ok ? colors.success : colors.danger }]}
      selectable>
      {status.ok ? '✓ ' : '✗ '}
      {status.message}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: {
    fontSize: 17,
    color: colors.primary,
    fontWeight: '600',
    width: 70,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  topBarSpacer: { width: 70 },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.lg * 2,
  },
  section: {
    marginTop: spacing.md,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  label: {
    marginTop: spacing.xs,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  showButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  showText: {
    color: colors.primary,
    fontWeight: '600',
  },
  jsonInput: {
    minHeight: 140,
    maxHeight: 240,
    paddingTop: spacing.sm,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 12,
  },
  status: {
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
});
