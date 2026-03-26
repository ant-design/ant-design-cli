declare module 'envinfo' {
  interface EnvInfoOptions {
    System?: string[];
    Binaries?: string[];
    Browsers?: string[];
    npmPackages?: string[];
    [key: string]: string[] | undefined;
  }

  interface EnvInfoConfig {
    json?: boolean;
    showNotFound?: boolean;
    [key: string]: unknown;
  }

  function run(options: EnvInfoOptions, config?: EnvInfoConfig): Promise<string>;

  const _default: { run: typeof run };
  export default _default;
}
