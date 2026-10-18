import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { saveErrorMessage } from '../saveErrorMessage';
import type { ActivitySaveOutcome } from '../activityDrafts';

// Run the actual modal save handler: a rejected or uncertain write must not
// dismiss entered values, and a pending write must not be submitted twice.
const path = join(__dirname, '../../components/ActivityInputModal.tsx');
const ast = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler: ts.VariableDeclaration | undefined;
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'handleSave') handler = node;
  ts.forEachChild(node, visit);
}
visit(ast);
if (!handler) throw new Error('ActivityInputModal save handler not found');
const js = ts.transpileModule(`const ${handler.getText(ast)}; handleSave;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function harness(canDraft = false, restricted = false) {
  const values = { startTime: new Date('2026-10-08T12:46:00Z'), volumeMl: 120, notes: 'Original input' };
  const context = {
    ...values, restricted, saving: false, canDraft,
    saveInFlightRef: { current: false },
    setIsSubmitting: jest.fn(),
    activityType: 'feeding', isStandaloneSpecialFlow: false, feedingOptions: ['bottle'], diaperOptions: ['wet'],
    feedingType: 'bottle', startTimer: !canDraft, endTime: null, date: values.startTime,
    sanitizeManualDate: (value: Date) => value,
    recipeOptions: [], selectedRecipeId: null, breastSide: 'left',
    selectedFormulaItemId: null, selectedDiaperItemId: null,
    formulaInventoryItems: [], diaperInventoryItems: [], draftKind: 'bottle',
    onSave: jest.fn<Promise<ActivitySaveOutcome | void>, unknown[]>().mockResolvedValue({ status: 'confirmed', entryId: 'saved' }),
    onClose: jest.fn(),
    draft: { ready: true, unknown: false, save: jest.fn(async (save: () => Promise<ActivitySaveOutcome | void>) => save()) },
    Alert: { alert: jest.fn() }, locale: 'de', saveErrorMessage,
    t: (key: string) => key, ot: (key: string) => key,
  };
  const save = runInNewContext(js, context, { filename: path }) as () => Promise<void>;
  return { context, save, values };
}

describe('activity input confirmation and input retention', () => {
  it.each([false,true])('closes after a durable local save while the server is offline (draft=%s)',async canDraft=>{
    const h=harness(canDraft);h.context.onSave.mockResolvedValueOnce({status:'queued',entryId:'durable-local-id'});
    await h.save();expect(h.context.onClose).toHaveBeenCalledTimes(1);
  });
  it.each(['rejected', 'confirmation_unknown'] as const)('keeps the normal form open after %s', async status => {
    const h = harness();
    h.context.onSave.mockResolvedValueOnce({ status });
    await h.save();
    expect(h.context.onClose).not.toHaveBeenCalled();
    expect(h.context.notes).toBe(h.values.notes);
    expect(h.context.volumeMl).toBe(120);
    expect(h.context.saveInFlightRef.current).toBe(false);
  });

  it('keeps a restricted form open after rejection', async () => {
    const h = harness(false, true);
    h.context.onSave.mockResolvedValueOnce({ status: 'rejected' });
    await h.save();
    expect(h.context.onClose).not.toHaveBeenCalled();
    expect(h.context.onSave).toHaveBeenCalledWith(expect.objectContaining({ notes: h.values.notes }), { startTimer: false });
  });

  it('closes only after a confirmed normal save', async () => {
    const h = harness();
    await h.save();
    expect(h.context.onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves a draft open for a lost response', async () => {
    const h = harness(true);
    h.context.onSave.mockResolvedValueOnce({ status: 'confirmation_unknown' });
    await h.save();
    expect(h.context.onClose).not.toHaveBeenCalled();
    expect(h.context.onSave).toHaveBeenCalledWith(expect.objectContaining({ feeding_volume_ml: 120 }), { startTimer: false, draftManaged: true });
  });

  it('prevents a second save while the first write is pending', async () => {
    const h = harness();
    let complete!: (value: ActivitySaveOutcome) => void;
    h.context.onSave.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const pending = h.save();
    await h.save();
    expect(h.context.onSave).toHaveBeenCalledTimes(1);
    expect(h.context.onClose).not.toHaveBeenCalled();
    complete({ status: 'confirmed', entryId: 'saved' }); await pending;
    expect(h.context.onClose).toHaveBeenCalledTimes(1);
    expect(h.context.setIsSubmitting.mock.calls).toEqual([[true], [false]]);
  });

  it('keeps the input after a thrown native offline error and uses a safe message', async () => {
    const h = harness();
    h.context.onSave.mockRejectedValueOnce(new Error('fetch failed: UnexpectedException (ExpoModulesCore/Promise.swift:56)'));
    await h.save();
    expect(h.context.onClose).not.toHaveBeenCalled();
    expect(h.context.saveInFlightRef.current).toBe(false);
    expect(h.context.Alert.alert).toHaveBeenCalledWith('common.error', expect.stringContaining('nicht bestätigt'));
  });
});
