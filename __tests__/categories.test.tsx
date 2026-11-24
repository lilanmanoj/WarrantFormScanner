import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { move } from '../src/components/SortableList';
import { CategoriesScreen } from '../src/screens/CategoriesScreen';
import { activeCategoryNames, Category } from '../src/storage';

jest.mock('@react-native-async-storage/async-storage', () => ({}));

const cats: Category[] = [
  { id: 'a', name: 'Alpha', active: true },
  { id: 'b', name: 'Bravo', active: false },
  { id: 'c', name: 'Charlie', active: true },
];

describe('move', () => {
  it('reorders down and up', () => {
    expect(move(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(move(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });
});

describe('activeCategoryNames', () => {
  it('keeps only active ones in order', () => {
    expect(activeCategoryNames(cats)).toEqual(['Alpha', 'Charlie']);
    expect(activeCategoryNames([cats[2], cats[1], cats[0]])).toEqual(['Charlie', 'Alpha']);
  });
});

describe('CategoriesScreen', () => {
  function setup() {
    const onChange = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <CategoriesScreen categories={cats} onChange={onChange} onBack={() => {}} />,
      );
    });
    return { tree, onChange };
  }

  it('adds a new active category at the end', () => {
    const { tree, onChange } = setup();
    const input = tree.root.findByType(TextInput);
    act(() => input.props.onChangeText('  Delta '));
    const add = tree.root.findByProps({ accessibilityLabel: 'Add category' });
    act(() => add.props.onPress());
    const next: Category[] = onChange.mock.calls[0][0];
    expect(next.map(c => c.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
    expect(next[3].active).toBe(true);
  });

  it('does not add duplicates (case-insensitive)', () => {
    const { tree, onChange } = setup();
    act(() => tree.root.findByType(TextInput).props.onChangeText('alpha'));
    expect(tree.root.findAllByProps({ children: 'This category already exists.' }).length).toBeGreaterThan(0);
    // Alert is a no-op in tests; just make sure nothing was added.
    act(() => tree.root.findByProps({ accessibilityLabel: 'Add category' }).props.onPress());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toggles Active/Inactive', () => {
    const { tree, onChange } = setup();
    // The status dropdowns render options 'Active' / 'Inactive' in a modal list.
    const dropdowns = tree.root.findAll(
      n => typeof n.props.onChange === 'function' && Array.isArray(n.props.options),
    );
    act(() => dropdowns[1].props.onChange('Active'));
    expect(onChange.mock.calls[0][0][1]).toEqual({ id: 'b', name: 'Bravo', active: true });
  });
});
