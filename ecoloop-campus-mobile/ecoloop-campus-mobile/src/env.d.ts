declare namespace NodeJS {
  type ProcessEnv = Record<string, string | undefined>;
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
