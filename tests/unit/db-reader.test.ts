import { describe, expect, it } from 'vitest';

import { readDatabase } from '../../src/db/db-reader';
import type { SqlDatabase } from '../../src/db/sql-loader';

describe('readDatabase', () => {
  it('loads graphics variables from variables', () => {
    const db = {
      exec(sql: string) {
        if (sql === 'PRAGMA table_info("variables")') {
          return [{
            values: [
              [0, 'variable', 'TEXT', 0, null, 0],
              [1, 'value', 'TEXT', 0, null, 0],
            ],
          }];
        }

        if (sql === 'SELECT "variable", "value" FROM "variables"') {
          return [{
            values: [
              ['gl_fullscreen', '0'],
              ['gl_width', '640'],
              ['gl_height', '480'],
              ['gl_aspect', '1.7777'],
              ['gl_vsync', '1'],
            ],
          }];
        }

        return [{ values: [] }];
      },
    } as unknown as SqlDatabase;

    expect(readDatabase(db).variables).toEqual(new Map([
      ['gl_fullscreen', '0'],
      ['gl_width', '640'],
      ['gl_height', '480'],
      ['gl_aspect', '1.7777'],
      ['gl_vsync', '1'],
    ]));
  });

  it('loads graphics variables when the variable table uses id/value columns', () => {
    const db = {
      exec(sql: string) {
        if (sql === 'PRAGMA table_info("variables")') {
          return [{
            values: [
              [0, 'id', 'TEXT', 0, null, 0],
              [1, 'value', 'TEXT', 0, null, 0],
            ],
          }];
        }

        if (sql === 'SELECT "id", "value" FROM "variables"') {
          return [{
            values: [
              ['gl_fullscreen', 0],
              ['gl_width', 640],
              ['gl_height', 480],
              ['gl_aspect', 1.7777],
              ['gl_vsync', 1],
            ],
          }];
        }

        return [{ values: [] }];
      },
    } as unknown as SqlDatabase;

    expect(readDatabase(db).variables).toEqual(new Map([
      ['gl_fullscreen', '0'],
      ['gl_width', '640'],
      ['gl_height', '480'],
      ['gl_aspect', '1.7777'],
      ['gl_vsync', '1'],
    ]));
  });
});
