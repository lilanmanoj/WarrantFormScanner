import React, { useState } from 'react';
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
import { Dropdown } from '../components/Dropdown';
import { SortableList } from '../components/SortableList';
import { Category, newCategoryId } from '../storage';
import { colors, spacing } from '../theme';

interface Props {
  categories: Category[];
  /** Called on every change; the parent persists immediately. */
  onChange: (categories: Category[]) => void;
  onBack: () => void;
}

const ROW_HEIGHT = 64;
const STATUS_OPTIONS = ['Active', 'Inactive'];

export function CategoriesScreen({ categories, onChange, onBack }: Props) {
  const [newName, setNewName] = useState('');
  const [dragging, setDragging] = useState(false);

  const trimmed = newName.trim();
  const isDuplicate = categories.some(
    c => c.name.toLowerCase() === trimmed.toLowerCase(),
  );

  const handleAdd = () => {
    if (!trimmed) {
      return;
    }
    if (isDuplicate) {
      Alert.alert('Already exists', `"${trimmed}" is already in the list.`);
      return;
    }
    onChange([...categories, { id: newCategoryId(), name: trimmed, active: true }]);
    setNewName('');
  };

  const setActive = (id: string, active: boolean) =>
    onChange(categories.map(c => (c.id === id ? { ...c, active } : c)));

  const confirmDelete = (category: Category) =>
    Alert.alert('Delete category?', `"${category.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onChange(categories.filter(c => c.id !== category.id)),
      },
    ]);

  const activeCount = categories.filter(c => c.active).length;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
          <Text style={styles.back}>‹ Settings</Text>
        </Pressable>
        <Text style={styles.title}>Category Data</Text>
        <View style={styles.topBarSpacer} />
      </View>

      {/* Add new category */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="New category"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
          blurOnSubmit={false}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add category"
          onPress={handleAdd}
          disabled={!trimmed}
          style={({ pressed }) => [
            styles.addButton,
            (!trimmed || pressed) && styles.dimmed,
          ]}>
          <Text style={styles.addIcon}>＋</Text>
        </Pressable>
      </View>
      {trimmed && isDuplicate ? (
        <Text style={styles.duplicate}>This category already exists.</Text>
      ) : null}

      <Text style={styles.summary}>
        {categories.length === 0
          ? 'No categories yet. Add one above.'
          : `${categories.length} categories, ${activeCount} active. Drag ☰ to reorder. Home shows active ones in this order.`}
      </Text>

      <ScrollView
        contentContainerStyle={styles.listContent}
        scrollEnabled={!dragging}
        keyboardShouldPersistTaps="handled">
        <SortableList
          items={categories}
          keyExtractor={c => c.id}
          rowHeight={ROW_HEIGHT}
          onReorder={onChange}
          onDragStateChange={setDragging}
          renderItem={category => (
            <View style={styles.itemRow}>
              <Text
                style={[styles.itemName, !category.active && styles.inactiveName]}
                numberOfLines={2}>
                {category.name}
              </Text>
              <Dropdown
                options={STATUS_OPTIONS}
                value={category.active ? 'Active' : 'Inactive'}
                onChange={v => setActive(category.id, v === 'Active')}
                style={[
                  styles.statusDropdown,
                  category.active ? styles.statusActive : styles.statusInactive,
                ]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${category.name}`}
                onPress={() => confirmDelete(category)}
                hitSlop={8}
                style={styles.deleteButton}>
                <Text style={styles.deleteIcon}>✕</Text>
              </Pressable>
            </View>
          )}
        />
      </ScrollView>
    </KeyboardAvoidingView>
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
    width: 90,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  topBarSpacer: { width: 90 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 30,
  },
  dimmed: { opacity: 0.5 },
  duplicate: {
    color: colors.danger,
    fontSize: 13,
    paddingHorizontal: spacing.md,
  },
  summary: {
    color: colors.textMuted,
    fontSize: 13,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg * 2,
  },
  itemRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  inactiveName: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  statusDropdown: {
    width: 118,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  statusActive: {
    borderColor: colors.success,
    backgroundColor: '#E8F5E9',
  },
  statusInactive: {
    borderColor: colors.border,
    backgroundColor: '#ECEFF1',
  },
  deleteButton: {
    width: 28,
    alignItems: 'center',
  },
  deleteIcon: {
    fontSize: 16,
    color: colors.danger,
    fontWeight: '700',
  },
});
