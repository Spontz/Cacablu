import type { IContentRenderer } from 'dockview-core';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/min/vs/editor/editor.main.css';

import type { AppState } from '../state/app-state';
import type { DbState } from '../state/db-state';
import type { DbSessionRef } from '../db/db-session';
import type { ConnectionController } from '../ws/connection';
import { buildResourceTree, type ResourceTreeNode } from '../resources/resource-tree';
import { createPhoenixAssetClient } from '../phoenix/asset-client';
import { addAssetImpactEvents } from '../phoenix/asset-impact-events';
import { writeAllowedAssetFile } from '../phoenix/asset-operations';
import { createContentRenderer } from './base-panel';
import { CACABLU_CODE_THEME, registerCacabluCodeTheme } from './code-editor-theme';

registerGlslLanguage();
registerCacabluCodeTheme();

export function createGlslAssetEditorPanel(
  state: AppState,
  dbState: DbState,
  sessionRef: DbSessionRef,
  connection: ConnectionController,
): IContentRenderer {
  return createContentRenderer((element, params) => {
    element.className = 'panel panel--glsl-editor';

    const phoenixAssets = createPhoenixAssetClient();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');
    const fixedFileId = getPanelFileId(params);
    let editor: monaco.editor.IStandaloneCodeEditor | null = null;
    let currentFileId: number | null = null;
    let originalContent = '';
    let currentPath = '';
    let updateInFlight = false;

    const header = document.createElement('div');
    header.className = 'glsl-editor__header';

    const title = document.createElement('div');
    title.className = 'glsl-editor__title';

    const code = document.createElement('div');
    code.className = 'glsl-editor__code';

    const actions = document.createElement('div');
    actions.className = 'glsl-editor__actions';

    const update = document.createElement('button');
    update.type = 'button';
    update.className = 'glsl-editor__button';
    update.textContent = 'Actualizar';

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'glsl-editor__button glsl-editor__button--primary';
    save.textContent = 'Guardar';

    header.append(title);
    actions.append(update, save);
    element.append(header, code, actions);

    editor = monaco.editor.create(code, {
      value: '',
      language: 'glsl',
      theme: CACABLU_CODE_THEME,
      automaticLayout: true,
      minimap: { enabled: false },
      fontFamily: '"JetBrains Mono", Consolas, monospace',
      fontSize: 11,
      lineHeight: 18,
      glyphMargin: false,
      folding: false,
      lineDecorationsWidth: 4,
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      renderLineHighlight: 'line',
      padding: { top: 8, bottom: 8 },
      scrollBeyondLastLine: false,
    });
    const editorModel = editor.getModel();
    if (editorModel) {
      monaco.editor.setModelLanguage(editorModel, 'glsl');
    }
    monaco.editor.setTheme(CACABLU_CODE_THEME);

    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      if (!update.disabled) {
        update.click();
      }
    });
    editor.onDidChangeModelContent(() => {
      syncSaveDisabled();
    });

    const loadCurrentSelection = (): void => {
      const session = sessionRef.current;
      if (!session) {
        setEmpty('Select a GLSL asset.');
        return;
      }

      const selection = state.getSnapshot().assetSelection;
      const targetFileId = fixedFileId ?? (selection.kind === 'file' ? selection.id : null);
      if (targetFileId === null) {
        setEmpty('Select a GLSL asset.');
        return;
      }

      const file = session.data.files.find((candidate) => candidate.id === targetFileId);
      if (!file || !file.name.toLowerCase().endsWith('.glsl')) {
        setEmpty('Select a GLSL asset.');
        return;
      }

      const path = findAssetPath(session.data, file.id);
      if (!path) {
        setEmpty('Could not resolve asset path.');
        return;
      }

      currentFileId = file.id;
      currentPath = `pool/${path}`;
      originalContent = decoder.decode(new Uint8Array(file.data));
      title.textContent = currentPath;
      editor?.setValue(originalContent);
      syncUpdateDisabled();
      syncSaveDisabled();
    };

    const unsubscribeState = state.subscribe(() => {
      syncUpdateDisabled();
      if (fixedFileId !== null) return;
      const selection = state.getSnapshot().assetSelection;
      const nextId = selection.kind === 'file' ? selection.id : null;
      if (nextId !== currentFileId) {
        loadCurrentSelection();
      }
    });
    const unsubscribeDb = dbState.subscribe(loadCurrentSelection);

    update.addEventListener('click', async () => {
      if (!editor || !currentPath) return;
      if (!connection.isConnected()) {
        state.addEvent({ severity: 'warning', source: 'GLSL editor', description: 'Phoenix is not connected, so the shader preview was not sent.' });
        return;
      }

      try {
        updateInFlight = true;
        syncUpdateDisabled();
        const result = await phoenixAssets.previewFile(currentPath, editor.getValue());
        addAssetImpactEvents(state, result, `Previewed ${currentPath}`);
      } catch (err) {
        state.addEvent({ severity: 'error', source: 'GLSL editor', description: err instanceof Error ? err.message : 'Could not preview GLSL asset.' });
      } finally {
        updateInFlight = false;
        syncUpdateDisabled();
      }
    });

    save.addEventListener('click', async () => {
      const session = sessionRef.current;
      if (!editor || !session || currentFileId === null || !currentPath) return;

      const content = editor.getValue();
      const bytes = encoder.encode(content);
      const fileName = currentPath.split('/').pop() ?? 'shader.glsl';

      try {
        save.disabled = true;
        session.updateResourceFileContent(currentFileId, {
          bytes: bytes.byteLength,
          type: 'text/plain',
          data: bytes,
          format: 'glsl',
        });
        originalContent = content;
        dbState.setDirty();
        syncSaveDisabled();

        if (connection.isConnected()) {
          addAssetImpactEvents(state, await writeAllowedAssetFile(phoenixAssets, currentPath, bytes), `Saved ${fileName}`);
        } else {
          state.addEvent({ severity: 'warning', source: 'GLSL editor', description: `Saved ${fileName} in the project DB, but Phoenix is not connected so its disk copy was not updated.` });
        }
      } catch (err) {
        state.addEvent({ severity: 'error', source: 'GLSL editor', description: err instanceof Error ? err.message : 'Could not save GLSL asset.' });
      } finally {
        save.disabled = false;
      }
    });

    loadCurrentSelection();

    return () => {
      unsubscribeState();
      unsubscribeDb();
      editor?.dispose();
      editor = null;
    };

    function setEmpty(message: string): void {
      currentFileId = null;
      currentPath = '';
      originalContent = '';
      title.textContent = message;
      editor?.setValue('');
      syncUpdateDisabled();
      syncSaveDisabled();
    }

    function syncUpdateDisabled(): void {
      update.disabled = updateInFlight || !currentPath || !connection.isConnected();
      update.title = connection.isConnected()
        ? 'Actualizar shader en Phoenix'
        : 'Phoenix is not connected';
    }

    function syncSaveDisabled(): void {
      save.disabled = !currentPath || !editor || editor.getValue() === originalContent;
    }
  });
}

function registerGlslLanguage(): void {
  if (!monaco.languages.getLanguages().some((language) => language.id === 'glsl')) {
    monaco.languages.register({
      id: 'glsl',
      extensions: ['.glsl', '.vert', '.frag', '.geom', '.tesc', '.tese', '.comp'],
      aliases: ['GLSL', 'glsl'],
      mimetypes: ['text/x-glsl'],
    });
  }

  monaco.languages.setLanguageConfiguration('glsl', {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    folding: {
      markers: {
        start: /^\s*#\s*pragma\s+region\b/,
        end: /^\s*#\s*pragma\s+endregion\b/,
      },
    },
  });

  monaco.languages.setMonarchTokensProvider('glsl', {
    defaultToken: '',
    tokenPostfix: '.glsl',
    keywords: [
      'attribute', 'break', 'buffer', 'case', 'centroid', 'coherent', 'const', 'continue', 'default',
      'discard', 'do', 'else', 'flat', 'for', 'highp', 'if', 'in', 'inout', 'invariant', 'layout',
      'lowp', 'mediump', 'noperspective', 'out', 'patch', 'precision', 'readonly', 'restrict', 'return',
      'sample', 'shared', 'smooth', 'struct', 'subroutine', 'switch', 'uniform', 'varying', 'volatile',
      'while', 'writeonly',
    ],
    types: [
      'bool', 'bvec2', 'bvec3', 'bvec4', 'dmat2', 'dmat2x2', 'dmat2x3', 'dmat2x4', 'dmat3',
      'dmat3x2', 'dmat3x3', 'dmat3x4', 'dmat4', 'dmat4x2', 'dmat4x3', 'dmat4x4', 'double',
      'dvec2', 'dvec3', 'dvec4', 'float', 'image1D', 'image1DArray', 'image2D', 'image2DArray',
      'image2DMS', 'image2DMSArray', 'image2DRect', 'image3D', 'imageBuffer', 'imageCube',
      'imageCubeArray', 'int', 'isampler1D', 'isampler1DArray', 'isampler2D', 'isampler2DArray',
      'isampler2DMS', 'isampler2DMSArray', 'isampler2DRect', 'isampler3D', 'isamplerBuffer',
      'isamplerCube', 'isamplerCubeArray', 'ivec2', 'ivec3', 'ivec4', 'mat2', 'mat2x2', 'mat2x3',
      'mat2x4', 'mat3', 'mat3x2', 'mat3x3', 'mat3x4', 'mat4', 'mat4x2', 'mat4x3', 'mat4x4',
      'sampler1D', 'sampler1DArray', 'sampler1DArrayShadow', 'sampler1DShadow', 'sampler2D',
      'sampler2DArray', 'sampler2DArrayShadow', 'sampler2DMS', 'sampler2DMSArray', 'sampler2DRect',
      'sampler2DRectShadow', 'sampler2DShadow', 'sampler3D', 'samplerBuffer', 'samplerCube',
      'samplerCubeArray', 'samplerCubeArrayShadow', 'samplerCubeShadow', 'uint', 'uimage1D',
      'uimage1DArray', 'uimage2D', 'uimage2DArray', 'uimage2DMS', 'uimage2DMSArray', 'uimage2DRect',
      'uimage3D', 'uimageBuffer', 'uimageCube', 'uimageCubeArray', 'usampler1D', 'usampler1DArray',
      'usampler2D', 'usampler2DArray', 'usampler2DMS', 'usampler2DMSArray', 'usampler2DRect',
      'usampler3D', 'usamplerBuffer', 'usamplerCube', 'usamplerCubeArray', 'uvec2', 'uvec3',
      'uvec4', 'vec2', 'vec3', 'vec4', 'void',
    ],
    constants: [
      'false', 'true', 'gl_BackColor', 'gl_BackLightModelProduct', 'gl_BackLightProduct',
      'gl_BackMaterial', 'gl_ClipDistance', 'gl_ClipPlane', 'gl_DepthRange', 'gl_DepthRangeParameters',
      'gl_FragColor', 'gl_FragCoord', 'gl_FragData', 'gl_FrontColor', 'gl_FrontFacing',
      'gl_FrontLightModelProduct', 'gl_FrontLightProduct', 'gl_FrontMaterial', 'gl_GlobalInvocationID',
      'gl_InstanceID', 'gl_InvocationID', 'gl_Layer', 'gl_LocalInvocationID', 'gl_LocalInvocationIndex',
      'gl_ModelViewMatrix', 'gl_ModelViewProjectionMatrix', 'gl_Normal', 'gl_NormalMatrix',
      'gl_NumSamples', 'gl_PatchVerticesIn', 'gl_PointCoord', 'gl_PointSize', 'gl_Position',
      'gl_PrimitiveID', 'gl_ProjectionMatrix', 'gl_SampleID', 'gl_SampleMask', 'gl_TexCoord',
      'gl_Vertex', 'gl_VertexID', 'gl_ViewID_OVR', 'gl_WorkGroupID', 'gl_WorkGroupSize',
    ],
    builtins: [
      'abs', 'acos', 'acosh', 'all', 'any', 'asin', 'asinh', 'atan', 'atanh', 'atomicAdd', 'atomicAnd',
      'atomicCompSwap', 'atomicCounter', 'atomicCounterDecrement', 'atomicCounterIncrement', 'atomicExchange',
      'atomicMax', 'atomicMin', 'atomicOr', 'atomicXor', 'barrier', 'bitCount', 'bitfieldExtract',
      'bitfieldInsert', 'bitfieldReverse', 'ceil', 'clamp', 'cos', 'cosh', 'cross', 'degrees',
      'determinant', 'dFdx', 'dFdxCoarse', 'dFdxFine', 'dFdy', 'dFdyCoarse', 'dFdyFine', 'distance',
      'dot', 'EmitStreamVertex', 'EmitVertex', 'EndPrimitive', 'EndStreamPrimitive', 'equal', 'exp',
      'exp2', 'faceforward', 'findLSB', 'findMSB', 'floatBitsToInt', 'floatBitsToUint', 'floor',
      'fma', 'fract', 'frexp', 'fwidth', 'fwidthCoarse', 'fwidthFine', 'greaterThan',
      'greaterThanEqual', 'groupMemoryBarrier', 'imageAtomicAdd', 'imageAtomicAnd', 'imageAtomicCompSwap',
      'imageAtomicExchange', 'imageAtomicMax', 'imageAtomicMin', 'imageAtomicOr', 'imageAtomicXor',
      'imageLoad', 'imageSize', 'imageStore', 'imulExtended', 'intBitsToFloat', 'interpolateAtCentroid',
      'interpolateAtOffset', 'interpolateAtSample', 'inverse', 'inversesqrt', 'isinf', 'isnan',
      'ldexp', 'length', 'lessThan', 'lessThanEqual', 'log', 'log2', 'matrixCompMult', 'max',
      'memoryBarrier', 'memoryBarrierAtomicCounter', 'memoryBarrierBuffer', 'memoryBarrierImage',
      'memoryBarrierShared', 'min', 'mix', 'mod', 'modf', 'normalize', 'not', 'notEqual',
      'outerProduct', 'packDouble2x32', 'packHalf2x16', 'packSnorm2x16', 'packSnorm4x8',
      'packUnorm2x16', 'packUnorm4x8', 'pow', 'radians', 'reflect', 'refract', 'round',
      'roundEven', 'sign', 'sin', 'sinh', 'smoothstep', 'sqrt', 'step', 'tan', 'tanh',
      'texelFetch', 'texelFetchOffset', 'texture', 'texture2D', 'texture2DLod', 'textureCube',
      'textureCubeLod', 'textureGather', 'textureGatherOffset', 'textureGrad', 'textureGradOffset',
      'textureLod', 'textureLodOffset', 'textureOffset', 'textureProj', 'textureProjGrad',
      'textureProjGradOffset', 'textureProjLod', 'textureProjLodOffset', 'textureProjOffset',
      'textureQueryLevels', 'textureQueryLod', 'textureSamples', 'textureSize', 'transpose',
      'trunc', 'uaddCarry', 'uintBitsToFloat', 'umulExtended', 'unpackDouble2x32', 'unpackHalf2x16',
      'unpackSnorm2x16', 'unpackSnorm4x8', 'unpackUnorm2x16', 'unpackUnorm4x8', 'usubBorrow',
    ],
    operators: [
      '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '&&', '||', '++', '--',
      '+', '-', '*', '/', '&', '|', '^', '%', '<<', '>>', '+=', '-=', '*=', '/=', '&=',
      '|=', '^=', '%=', '<<=', '>>=',
    ],
    symbols: /[=><!~?:&|+\-*/^%]+/,
    escapes: /\\(?:[btnfr\\"']|x[0-9A-Fa-f]+|u[0-9A-Fa-f]{4})/,
    tokenizer: {
      root: [
        [/^\s*#\s*(define|elif|else|endif|error|extension|if|ifdef|ifndef|include|line|pragma|undef|version)\b.*/, 'metatag'],
        [/\b(?:void|bool|int|uint|float|double|[biu]?vec[234]|dvec[234]|mat[234](?:x[234])?|dmat[234](?:x[234])?|sampler(?:1D|2D|3D|Cube|Buffer|2DRect)(?:Array)?(?:Shadow)?|[iu]?sampler(?:1D|2D|3D|Cube|Buffer|2DRect)(?:Array)?|image(?:1D|2D|3D|Cube|Buffer|2DRect)(?:Array)?|[iu]image(?:1D|2D|3D|Cube|Buffer|2DRect)(?:Array)?)\b/, 'type'],
        [/\b(?:gl_[A-Za-z_]\w*)\b/, 'constant'],
        [/\b(?:texture|texture2D|textureCube|textureLod|textureGrad|textureSize|texelFetch|mix|clamp|smoothstep|step|normalize|length|distance|dot|cross|reflect|refract|sin|cos|tan|asin|acos|atan|pow|exp|log|sqrt|inversesqrt|abs|sign|floor|ceil|fract|mod|min|max|dFdx|dFdy|fwidth)\b/, 'predefined'],
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@keywords': 'keyword',
            '@types': 'type',
            '@constants': 'constant',
            '@builtins': 'predefined',
            '@default': 'identifier',
          },
        }],
        [/[{}()[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
        [/\d*\.\d+([eE][-+]?\d+)?[fF]?/, 'number.float'],
        [/\d+\.\d*([eE][-+]?\d+)?[fF]?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+[uU]?/, 'number.hex'],
        [/\d+[uU]?/, 'number'],
        [/[;,.]/, 'delimiter'],
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/"/, 'string', '@string'],
        [/'[^\\']'/, 'string'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop'],
      ],
    },
  });

}

function getPanelFileId(params: { params?: unknown }): number | null {
  const rawParams = params.params;
  if (!rawParams || typeof rawParams !== 'object') return null;
  const fileId = (rawParams as Record<string, unknown>).fileId;
  return typeof fileId === 'number' && Number.isFinite(fileId) ? fileId : null;
}

function findAssetPath(db: Parameters<typeof buildResourceTree>[0], fileId: number): string | null {
  const roots = buildResourceTree(db);
  const visit = (node: ResourceTreeNode): string | null => {
    if (node.kind === 'file' && node.id === fileId) return node.path;
    if (node.kind === 'folder') {
      for (const child of node.children) {
        const found = visit(child);
        if (found) return found;
      }
    }
    return null;
  };

  for (const root of roots) {
    const found = visit(root);
    if (found) return found;
  }
  return null;
}
