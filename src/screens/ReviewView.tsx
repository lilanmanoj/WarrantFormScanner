import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { colors, spacing } from '../theme';

export interface ReviewData {
  imagePath: string;
  warrantNo: string;
  total: string;
  /** AI notes or the extraction error message. */
  message: string;
  extractionFailed: boolean;
  /** How long capture and AI reading took, e.g. "Photo 0.8 s · Gemini 2.1 s". */
  timing?: string;
}

interface Props {
  data: ReviewData;
  selectedOption: string;
  saving: boolean;
  /** Warrant numbers already saved in this scan session (for duplicate warning). */
  savedNumbers: Set<string>;
  onAccept: (warrantNo: string, total: string) => void;
  onReject: () => void;
}

export function ReviewView({
  data,
  selectedOption,
  saving,
  savedNumbers,
  onAccept,
  onReject,
}: Props) {
  const insets = useSafeAreaInsets();
  const [warrantNo, setWarrantNo] = useState(data.warrantNo);
  const [total, setTotal] = useState(data.total);
  const [zoomed, setZoomed] = useState(false);

  const imageUri = `file://${data.imagePath}`;
  const isDuplicate = savedNumbers.has(warrantNo.trim());
  const canAccept = warrantNo.trim() !== '' && total.trim() !== '' && !saving;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Review scanned data</Text>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => setZoomed(true)}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
          <Text style={styles.tapHint}>
            Tap image to enlarge{data.timing ? `  ·  ${data.timing}` : ''}
          </Text>
        </Pressable>

        {data.message ? (
          <View
            style={[
              styles.banner,
              data.extractionFailed ? styles.bannerError : styles.bannerInfo,
            ]}>
            <Text style={styles.bannerText}>
              {data.extractionFailed ? 'Could not read automatically: ' : 'Note: '}
              {data.message}
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>Category</Text>
        <View style={styles.readonlyField}>
          <Text style={styles.readonlyText}>{selectedOption}</Text>
        </View>

        <Text style={styles.label}>No (top right)</Text>
        <TextInput
          style={styles.input}
          value={warrantNo}
          onChangeText={setWarrantNo}
          keyboardType="number-pad"
          placeholder="e.g. 282681"
          placeholderTextColor={colors.textMuted}
          editable={!saving}
        />
        {isDuplicate ? (
          <Text style={styles.warning}>
            ⚠ This No was already saved during this scan session.
          </Text>
        ) : null}

        <Text style={styles.label}>Total (bottom right)</Text>
        <TextInput
          style={styles.input}
          value={total}
          onChangeText={setTotal}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="e.g. 2050:00"
          placeholderTextColor={colors.textMuted}
          editable={!saving}
          // Built-in reader fills only the No – jump straight to typing the Total.
          autoFocus={data.warrantNo !== '' && data.total === ''}
        />
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title="✗  Reject"
          variant="danger"
          onPress={onReject}
          disabled={saving}
          style={styles.actionButton}
        />
        <Button
          title="✓  Accept"
          variant="success"
          onPress={() => onAccept(warrantNo.trim(), total.trim())}
          disabled={!canAccept}
          loading={saving}
          style={styles.actionButton}
        />
      </View>

      <Modal visible={zoomed} onRequestClose={() => setZoomed(false)} animationType="fade">
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoomed(false)}>
          <Image source={{ uri: imageUri }} style={styles.zoomImage} resizeMode="contain" />
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  preview: {
    width: '100%',
    height: 260,
    backgroundColor: '#000',
    borderRadius: 10,
  },
  tapHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  banner: {
    borderRadius: 8,
    padding: spacing.sm,
  },
  bannerInfo: { backgroundColor: '#E3F2FD' },
  bannerError: { backgroundColor: '#FFEBEE' },
  bannerText: {
    color: colors.text,
    fontSize: 14,
  },
  label: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  readonlyField: {
    minHeight: 50,
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: '#E8EDF2',
  },
  readonlyText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '600',
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
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    minHeight: 56,
  },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  zoomImage: {
    flex: 1,
    width: '100%',
  },
});
