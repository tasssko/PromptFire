export class ProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderNotConfiguredError';
  }
}

export class UpstreamRewriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamRewriteError';
  }
}
