import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { buildWarrantRow } from '../src/services/rows';
import { ManualEntryScreen } from '../src/screens/ManualEntryScreen';

jest.mock('@react-native-async-storage/async-storage', () => ({}));

const mockAppendRow = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/services/sheets', () => ({
  appendRow: (...args: unknown[]) => mockAppendRow(...args),
  parseServiceAccount: () => ({ client_email: 'x', private_key: 'k', token_uri: 't' }),
}));

describe('buildWarrantRow', () => {
  it('orders Category, No, Total, timestamp and normalises values', () => {
    const row = buildWarrantRow('Cat A', ' 282681 ', '2050');
    expect(row.slice(0, 3)).toEqual(['Cat A', 282681, '2050:00']);
    expect(row[3]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(buildWarrantRow('C', '012', 'n/a').slice(1, 3)).toEqual(['012', 'n/a']);
  });
});

describe('ManualEntryScreen', () => {
  const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
  afterEach(() => {
    act(() => mounted.splice(0).forEach(t => t.unmount()));
  });

  function setup(category = 'Cat A') {
    const onCategoryChange = jest.fn();
    const onDone = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <ManualEntryScreen
          settings={{ processor: 'device', geminiApiKey: '', geminiModel: '', serviceAccountJson: '{}' }}
          target={{ spreadsheetId: 'sid', sheetTitle: 'Sheet1' }}
          categoryOptions={['Cat A', 'Cat B']}
          category={category}
          onCategoryChange={onCategoryChange}
          onDone={onDone}
        />,
      );
    });
    mounted.push(tree);
    const [noInput, totalInput] = tree.root.findAllByType(TextInput);
    const pressByText = (text: string) =>
      act(async () => {
        const [node] = tree.root.findAll(
          n =>
            typeof n.props.onPress === 'function' &&
            n.findAll(c => c.props.children === text).length > 0,
        );
        await node.props.onPress();
      });
    return { tree, noInput, totalInput, onCategoryChange, onDone, pressByText };
  }

  beforeEach(() => mockAppendRow.mockClear());

  it('Next appends a row with the category and clears No/Total', async () => {
    const { noInput, totalInput, pressByText } = setup();
    act(() => noInput.props.onChangeText('282681'));
    act(() => totalInput.props.onChangeText('2050:00'));
    await pressByText('Next  ›');
    expect(mockAppendRow).toHaveBeenCalledTimes(1);
    const [, sid, title, row] = mockAppendRow.mock.calls[0];
    expect([sid, title]).toEqual(['sid', 'Sheet1']);
    expect(row.slice(0, 3)).toEqual(['Cat A', 282681, '2050:00']);
    expect(noInput.props.value).toBe('');
    expect(totalInput.props.value).toBe('');
  });

  it('does not submit when fields are missing', async () => {
    const { noInput, pressByText } = setup();
    act(() => noInput.props.onChangeText('282681'));
    await pressByText('Next  ›');
    expect(mockAppendRow).not.toHaveBeenCalled();
  });

  it('category change is reported back to the home screen', () => {
    const { tree, onCategoryChange } = setup();
    const dropdown = tree.root.find(n => Array.isArray(n.props.options) && typeof n.props.onChange === 'function');
    act(() => dropdown.props.onChange('Cat B'));
    expect(onCategoryChange).toHaveBeenCalledWith('Cat B');
  });

  it('Done Edit leaves immediately when nothing is typed', async () => {
    const { onDone, pressByText } = setup();
    await pressByText('Done Edit');
    expect(onDone).toHaveBeenCalled();
  });
});
