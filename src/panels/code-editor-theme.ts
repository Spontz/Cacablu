import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';

export const CACABLU_CODE_THEME = 'cacablu-code-dark';

let registered = false;

export function registerCacabluCodeTheme(): void {
  if (registered) return;
  registered = true;

  monaco.editor.defineTheme(CACABLU_CODE_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'FFB000', fontStyle: 'bold' },
      { token: 'keyword.glsl', foreground: 'FFB000', fontStyle: 'bold' },
      { token: 'type', foreground: 'FF3DF2', fontStyle: 'bold' },
      { token: 'type.glsl', foreground: 'FF3DF2', fontStyle: 'bold' },
      { token: 'type.identifier', foreground: 'FF3DF2', fontStyle: 'bold' },
      { token: 'type.identifier.glsl', foreground: 'FF3DF2', fontStyle: 'bold' },
      { token: 'constant', foreground: 'FF5A1F', fontStyle: 'bold' },
      { token: 'constant.glsl', foreground: 'FF5A1F', fontStyle: 'bold' },
      { token: 'predefined', foreground: 'A7FF00', fontStyle: 'bold' },
      { token: 'predefined.glsl', foreground: 'A7FF00', fontStyle: 'bold' },
      { token: 'metatag', foreground: 'FFF200', fontStyle: 'bold' },
      { token: 'metatag.glsl', foreground: 'FFF200', fontStyle: 'bold' },
      { token: 'number', foreground: 'FF7A00' },
      { token: 'number.glsl', foreground: 'FF7A00' },
      { token: 'string', foreground: 'E8FF00' },
      { token: 'string.glsl', foreground: 'E8FF00' },
      { token: 'comment', foreground: 'C879FF', fontStyle: 'italic' },
      { token: 'comment.glsl', foreground: 'C879FF', fontStyle: 'italic' },
      { token: 'operator', foreground: 'FFFA6B' },
      { token: 'operator.glsl', foreground: 'FFFA6B' },
      { token: 'delimiter', foreground: 'FFFA6B' },
      { token: 'delimiter.glsl', foreground: 'FFFA6B' },
    ],
    colors: {
      'editor.background': '#05070BF5',
      'editor.foreground': '#F8FAFC',
      'editorGutter.background': '#05070BF5',
      'editorLineNumber.foreground': '#9AA8BC',
      'editorLineNumber.activeForeground': '#FFFFFF',
      'editorCursor.foreground': '#FFB000',
      'editor.selectionBackground': '#7A2E0088',
      'editor.lineHighlightBackground': '#FFFFFF0B',
    },
  });
}
