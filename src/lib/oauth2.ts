export interface MockToken {
  user: string;
  accessToken: string;
  expires?: number;
}

export type MockOAuthProvision = (
  user: string,
  renew: boolean,
  callback: (error: Error | null, accessToken?: string, expires?: number) => void
) => void;

export interface MockOAuthOptions {
  type?: string;
  user?: string;
  accessToken?: string;
  expires?: number;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  serviceClient?: string;
  privateKey?: string;
  provisionCallback?: MockOAuthProvision;
}

const authError = (message: string) => Object.assign(new Error(message), { code: 'EAUTH', command: 'AUTH XOAUTH2' });

/** Offline token handling for explicitly simulated delivery. No token endpoints are contacted. */
export class MockOAuth2 {
  private cache = new Map<string, { identity: unknown[]; token: MockToken }>();
  private generation = 0;
  private sequence = 0;

  constructor(private readonly emit: (token: MockToken) => void) {}

  reset(): void {
    this.generation++;
    this.cache.clear();
    this.sequence = 0;
  }

  async authorize(
    auth: MockOAuthOptions | undefined,
    provision?: MockOAuthProvision,
    renew = false
  ): Promise<MockToken | undefined> {
    if (auth?.type?.toLowerCase() !== 'oauth2') return;
    const user = auth.user;
    if (!user) throw authError('Missing OAuth2 user');
    const generation = this.generation;
    const provider = provision ?? auth.provisionCallback;
    const identity = [provider, auth.accessToken, auth.expires, auth.refreshToken, auth.clientId,
      auth.clientSecret, auth.serviceClient, auth.privateKey];
    const cached = this.cache.get(user);
    if (!renew && cached && cached.identity.every((value, index) => value === identity[index]) &&
      cached.token.expires && cached.token.expires > Date.now()) return { ...cached.token };
    if (!renew && auth.accessToken && (!auth.expires || auth.expires > Date.now())) {
      return { user, accessToken: auth.accessToken, expires: auth.expires };
    }
    let token: MockToken;
    if (provider) {
      token = await new Promise<MockToken>((resolve, reject) => {
        provider(user, renew, (error, accessToken, expires) => {
          if (error) return reject(error);
          if (!accessToken) return reject(authError('OAuth2 provider returned an empty access token'));
          resolve({ user, accessToken, expires });
        });
      });
    } else if ((auth.refreshToken && auth.clientId && auth.clientSecret) || (auth.serviceClient && auth.privateKey)) {
      token = { user, accessToken: `nodemailer-mock-token-${++this.sequence}`, expires: Date.now() + 3600000 };
    } else {
      throw authError('No OAuth2 access token or offline token provider');
    }
    if (generation === this.generation) {
      if (token.expires && token.expires > Date.now()) this.cache.set(user, { identity, token: { ...token } });
      else this.cache.delete(user);
      this.emit({ ...token });
    }
    return { ...token };
  }
}
