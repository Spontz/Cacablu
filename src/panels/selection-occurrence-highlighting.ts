import type * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';

const MAX_HIGHLIGHTED_OCCURRENCES = 1_000;

type SelectionModel = Pick<monaco.editor.ITextModel, 'findMatches' | 'getValueInRange'>;

export function findSelectionOccurrenceRanges(
  model: SelectionModel,
  selection: monaco.IRange,
): monaco.IRange[] {
  if (isEmptyRange(selection)) return [];

  const selectedText = model.getValueInRange(selection);
  if (!selectedText.trim()) return [];

  return model.findMatches(
    selectedText,
    false,
    false,
    true,
    null,
    false,
    MAX_HIGHLIGHTED_OCCURRENCES,
  )
    .map((match) => match.range)
    .filter((range) => !rangesEqual(range, selection));
}

export function installSelectionOccurrenceHighlighting(
  editor: monaco.editor.IStandaloneCodeEditor,
): () => void {
  const decorations = editor.createDecorationsCollection();

  const update = (): void => {
    const model = editor.getModel();
    const selection = editor.getSelection();
    const ranges = model && selection ? findSelectionOccurrenceRanges(model, selection) : [];
    decorations.set(ranges.map((range) => ({
      range,
      options: { inlineClassName: 'cacablu-code-selection-occurrence' },
    })));
  };

  const selectionSubscription = editor.onDidChangeCursorSelection(update);
  const contentSubscription = editor.onDidChangeModelContent(update);
  const modelSubscription = editor.onDidChangeModel(update);
  update();

  return () => {
    selectionSubscription.dispose();
    contentSubscription.dispose();
    modelSubscription.dispose();
    decorations.clear();
  };
}

function isEmptyRange(range: monaco.IRange): boolean {
  return range.startLineNumber === range.endLineNumber
    && range.startColumn === range.endColumn;
}

function rangesEqual(left: monaco.IRange, right: monaco.IRange): boolean {
  return left.startLineNumber === right.startLineNumber
    && left.startColumn === right.startColumn
    && left.endLineNumber === right.endLineNumber
    && left.endColumn === right.endColumn;
}
