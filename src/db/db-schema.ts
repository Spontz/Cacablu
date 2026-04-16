export interface DbBar {
  id: number;
  type: string;
  layer: number;
  startTime: number;
  endTime: number;
  enabled: boolean;
  selected: boolean;
  script: string;
  srcBlending: string;
  dstBlending: string;
  blendingEQ: string;
  srcAlpha: string;
  dstAlpha: string;
}

export interface DbFbo {
  id: number;
  ratio: number;
  width: number;
  height: number;
  format: string;
  colorAttachments: number;
  filter: string;
}

export interface DbFile {
  id: number;
  name: string;
  parent: number;
  bytes: number;
  type: string;
  data: Uint8Array;
  format: string;
  enabled: boolean;
}

export interface DbFolder {
  id: number;
  name: string;
  parent: number;
  enabled: boolean;
}

export interface ProjectDatabase {
  variables: Map<string, string>;
  bars: DbBar[];
  fbos: DbFbo[];
  files: DbFile[];
  folders: DbFolder[];
}
