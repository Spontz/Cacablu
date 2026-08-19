export {
  registerResourceFileSaveUndo as registerGlslSaveUndo,
  shouldReplaceResourceFileEditorContent as shouldReplaceGlslEditorContent,
  snapshotResourceFileContent,
} from './resource-file-editor-undo';

export type { ResourceFileContentSnapshot } from './resource-file-editor-undo';
