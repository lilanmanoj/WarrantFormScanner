import { extractWarrantFields, thinkingOptionsFor } from '../src/services/gemini';

describe('thinkingOptionsFor', () => {
  it('disables or minimises thinking per model family', () => {
    expect(thinkingOptionsFor('models/gemini-2.5-flash')[0]).toEqual({ thinkingBudget: 0 });
    expect(thinkingOptionsFor('models/gemini-2.5-pro')[0]).toEqual({ thinkingBudget: 128 });
    expect(thinkingOptionsFor('models/gemini-3-flash')[0]).toEqual({ thinkingLevel: 'minimal' });
    expect(thinkingOptionsFor('models/gemini-3.1-pro')[0]).toEqual({ thinkingLevel: 'low' });
    expect(thinkingOptionsFor('models/gemini-2.0-flash')).toEqual([undefined]);
  });
});

describe('extractWarrantFields', () => {
  const ok = (json: object) => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }),
  });
  const badRequest = {
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ error: { message: 'thinking_level not supported' } }),
  };

  afterEach(() => jest.restoreAllMocks());

  it('sends a thinking config and normalises the result', async () => {
    const fetchMock = jest.fn().mockResolvedValue(ok({ warrantNo: 'D/1 282681', total: '2050', notes: '' }));
    (globalThis as any).fetch = fetchMock;
    const r = await extractWarrantFields('k', 'models/gemini-2.5-flash', 'AAAA');
    expect(r.warrantNo).toBe('282681');
    expect(r.total).toBe('2050:00');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it('falls back when the model rejects a thinking setting, then remembers it', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(badRequest)
      .mockResolvedValue(ok({ warrantNo: '559952', total: '6400:00', notes: '' }));
    (globalThis as any).fetch = fetchMock;
    const r = await extractWarrantFields('k', 'models/gemini-3-flash', 'AAAA');
    expect(r.warrantNo).toBe('559952');
    const sent = fetchMock.mock.calls.map(c => JSON.parse(c[1].body).generationConfig.thinkingConfig);
    expect(sent).toEqual([{ thinkingLevel: 'minimal' }, { thinkingLevel: 'low' }]);

    // Second scan goes straight to the accepted setting.
    await extractWarrantFields('k', 'models/gemini-3-flash', 'AAAA');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).generationConfig.thinkingConfig).toEqual({
      thinkingLevel: 'low',
    });
  });

  it('does not retry on non-400 errors (e.g. 402 credits depleted)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () => JSON.stringify({ error: { message: 'Your prepayment credits are depleted.' } }),
    });
    (globalThis as any).fetch = fetchMock;
    await expect(extractWarrantFields('k', 'models/gemini-2.5-flash-x', 'AAAA')).rejects.toThrow('402');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
