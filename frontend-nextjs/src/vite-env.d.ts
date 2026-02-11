/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HASURA_GRAPHQL_URL?: string;
  readonly VITE_GRAPHQL_URL?: string;
}

declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
