import type { ProjectDatabase } from '../db/db-schema';
import {
  GRAPHICS_FBO_FORMATS,
  type GraphicsConfig,
  type GraphicsFboFormat,
  type GraphicsFboRow,
} from '../phoenix/graphics-client';

const FBO_COUNT = 25;
const DEFAULT_FORMAT: GraphicsFboFormat = 'RGB';

export interface GraphicsValidationError {
  path: string;
  message: string;
}

export function graphicsConfigFromProject(db: Pick<ProjectDatabase, 'variables' | 'fbos'>): GraphicsConfig {
  const fbosById = new Map(db.fbos.map((fbo) => [fbo.id, fbo]));
  return {
    context: {
      colorDepth: readInteger(db.variables, 'colorDepth', 32),
      width: readInteger(db.variables, 'screenWidth', 640),
      height: readInteger(db.variables, 'screenHeight', 400),
      fullscreen: readBoolean(db.variables, 'fullScreen', false),
      vsync: readBoolean(db.variables, 'vsync', false),
      targetFps: readInteger(db.variables, 'targetFps', 60),
    },
    fbos: Array.from({ length: FBO_COUNT }, (_, index) => {
      const dbId = index + 1;
      const source = fbosById.get(dbId);
      const explicit = index >= 20;
      return {
        dbId,
        index,
        ratio: explicit ? null : positiveOrDefault(source?.ratio, 1),
        format: normalizeFormat(source?.format),
        width: explicit ? positiveOrDefault(source?.width, index === 20 ? 4096 : 256) : null,
        height: explicit ? positiveOrDefault(source?.height, index === 20 ? 4096 : 256) : null,
        attachments: positiveOrDefault(source?.colorAttachments, index < 4 ? 2 : 1),
        filter: normalizeFilter(source?.filter),
      };
    }),
  };
}

export function validateGraphicsConfig(config: GraphicsConfig): GraphicsValidationError[] {
  const errors: GraphicsValidationError[] = [];
  if (![16, 24, 32].includes(config.context.colorDepth)) {
    errors.push({ path: 'context.colorDepth', message: 'Color depth must be 16, 24, or 32.' });
  }
  if (!Number.isInteger(config.context.width) || config.context.width <= 0) {
    errors.push({ path: 'context.width', message: 'Width must be a positive integer.' });
  }
  if (!Number.isInteger(config.context.height) || config.context.height <= 0) {
    errors.push({ path: 'context.height', message: 'Height must be a positive integer.' });
  }
  if (config.fbos.length !== FBO_COUNT) {
    errors.push({ path: 'fbos', message: 'Graphics config must contain exactly 25 FBO rows.' });
  }

  config.fbos.forEach((fbo, rowIndex) => {
    const prefix = `fbos[${rowIndex}]`;
    if (fbo.index !== rowIndex) errors.push({ path: `${prefix}.index`, message: 'FBO rows must be ordered by index.' });
    if (!(GRAPHICS_FBO_FORMATS as readonly string[]).includes(fbo.format)) {
      errors.push({ path: `${prefix}.format`, message: 'Unsupported FBO format.' });
    }
    if (!Number.isInteger(fbo.attachments) || fbo.attachments <= 0) {
      errors.push({ path: `${prefix}.attachments`, message: 'Attachments must be positive.' });
    }
    if (fbo.filter !== 'bilinear' && fbo.filter !== 'none') {
      errors.push({ path: `${prefix}.filter`, message: 'Filter must be Bilinear or No.' });
    }
    if (rowIndex < 20) {
      if (!Number.isInteger(fbo.ratio) || (fbo.ratio ?? 0) <= 0) {
        errors.push({ path: `${prefix}.ratio`, message: 'Ratio must be positive.' });
      }
    } else {
      if (!Number.isInteger(fbo.width) || (fbo.width ?? 0) <= 0) {
        errors.push({ path: `${prefix}.width`, message: 'Width must be positive.' });
      }
      if (!Number.isInteger(fbo.height) || (fbo.height ?? 0) <= 0) {
        errors.push({ path: `${prefix}.height`, message: 'Height must be positive.' });
      }
    }
  });

  return errors;
}

export function toProjectFbos(config: GraphicsConfig) {
  return config.fbos.map((fbo) => ({
    id: fbo.dbId ?? fbo.index + 1,
    ratio: fbo.ratio ?? 0,
    width: fbo.width ?? 0,
    height: fbo.height ?? 0,
    format: fbo.format,
    colorAttachments: fbo.attachments,
    filter: fbo.filter === 'bilinear' ? 'Bilinear' : 'No',
  }));
}

export function cloneGraphicsConfig(config: GraphicsConfig): GraphicsConfig {
  return {
    context: { ...config.context },
    fbos: config.fbos.map((fbo): GraphicsFboRow => ({ ...fbo })),
  };
}

function readInteger(variables: ReadonlyMap<string, string>, key: string, fallback: number): number {
  const value = Number.parseInt(variables.get(key) ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

function readBoolean(variables: ReadonlyMap<string, string>, key: string, fallback: boolean): boolean {
  const raw = variables.get(key);
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

function positiveOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function normalizeFormat(value: unknown): GraphicsFboFormat {
  return typeof value === 'string' && (GRAPHICS_FBO_FORMATS as readonly string[]).includes(value)
    ? value as GraphicsFboFormat
    : DEFAULT_FORMAT;
}

function normalizeFilter(value: unknown): 'bilinear' | 'none' {
  return value === '0' || value === 0 || value === false || value === 'none' || value === 'No'
    ? 'none'
    : 'bilinear';
}
