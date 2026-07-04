import { describe, expect, it } from 'vitest';

import { graphicsConfigFromProject, toProjectFbos } from '../../src/services/graphics-config';
import type { ProjectDatabase } from '../../src/db/db-schema';

describe('graphicsConfigFromProject', () => {
  it('maps database FBO ids to Phoenix indexes without losing DB values', () => {
    const db: Pick<ProjectDatabase, 'variables' | 'fbos'> = {
      variables: new Map([
        ['fullScreen', '0'],
        ['screenWidth', '640'],
        ['screenHeight', '400'],
        ['vsync', '1'],
      ]),
      fbos: [
        { id: 1, ratio: 1, width: 0, height: 0, format: 'RGB', colorAttachments: 2, filter: 'Bilinear' },
        { id: 2, ratio: 4, width: 0, height: 0, format: 'RGB', colorAttachments: 2, filter: 'No' },
        { id: 3, ratio: 1, width: 0, height: 0, format: 'RGBA_16F', colorAttachments: 2, filter: 'Bilinear' },
        { id: 21, ratio: 0, width: 4096, height: 4096, format: 'RGB', colorAttachments: 1, filter: 'Bilinear' },
      ],
    };

    const config = graphicsConfigFromProject(db);

    expect(config.context).toMatchObject({
      width: 640,
      height: 400,
      fullscreen: false,
      vsync: true,
    });
    expect(config.fbos[0]).toMatchObject({ dbId: 1, index: 0, ratio: 1, format: 'RGB', attachments: 2, filter: 'bilinear' });
    expect(config.fbos[1]).toMatchObject({ dbId: 2, index: 1, ratio: 4, filter: 'none' });
    expect(config.fbos[2]).toMatchObject({ dbId: 3, index: 2, format: 'RGBA_16F' });
    expect(config.fbos[20]).toMatchObject({ dbId: 21, index: 20, ratio: null, width: 4096, height: 4096 });

    const projectFbos = toProjectFbos(config);
    expect(projectFbos[1]).toMatchObject({ id: 2, ratio: 4, filter: 'No' });
    expect(projectFbos[20]).toMatchObject({ id: 21, width: 4096, height: 4096, filter: 'Bilinear' });
  });
});
