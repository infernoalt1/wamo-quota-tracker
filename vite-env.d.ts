interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
