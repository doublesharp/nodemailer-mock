import { strict as assert } from 'node:assert';
import { MockOAuth2, MockOAuthProvision, MockToken } from '../src/lib/oauth2';

describe('offline OAuth2 simulation', () => {
  it('uses supplied access tokens and skips non-OAuth authentication', async () => {
    const tokens: MockToken[] = [];
    const auth = new MockOAuth2((token) => tokens.push(token));
    assert.equal(await auth.authorize({ type: 'login' }), undefined);
    assert.equal((await auth.authorize({ type: 'OAuth2', user: 'a@test', accessToken: 'supplied' }))?.accessToken,
      'supplied');
    assert.deepEqual(tokens, []);
  });

  it('calls provision callbacks, caches expiring tokens, and renews once requested', async () => {
    const events: MockToken[] = [];
    const auth = new MockOAuth2((token) => events.push(token));
    const calls: boolean[] = [];
    const provision: MockOAuthProvision = (user, renew, done) => {
      assert.equal(user, 'a@test');
      calls.push(renew);
      done(null, renew ? 'renewed' : 'first', Date.now() + 60000);
    };
    const options = { type: 'OAuth2', user: 'a@test' };
    assert.equal((await auth.authorize(options, provision))?.accessToken, 'first');
    assert.equal((await auth.authorize(options, provision))?.accessToken, 'first');
    assert.equal((await auth.authorize(options, provision, true))?.accessToken, 'renewed');
    assert.deepEqual(calls, [false, true]);
    assert.deepEqual(events.map((token) => token.accessToken), ['first', 'renewed']);
    events[1].accessToken = 'mutated event';
    assert.equal((await auth.authorize(options, provision))?.accessToken, 'renewed');
  });

  it('does not cache tokens without expiry or expired tokens', async () => {
    const auth = new MockOAuth2(() => undefined);
    let calls = 0;
    const provision: MockOAuthProvision = (_user, _renew, done) => done(null, `${++calls}`,
      calls === 1 ? Date.now() - 1 : undefined);
    for (let i = 1; i <= 3; i++) {
      assert.equal((await auth.authorize({ type: 'OAuth2', user: 'a@test' }, provision))?.accessToken, `${i}`);
    }
  });

  it('generates deterministic offline refresh and service-account tokens', async () => {
    const events: MockToken[] = [];
    const auth = new MockOAuth2((token) => events.push(token));
    const options = { type: 'OAuth2', user: 'a@test', refreshToken: 'refresh',
      clientId: 'client', clientSecret: 'secret', accessToken: 'expired', expires: 1 };
    assert.equal((await auth.authorize(options))?.accessToken, 'nodemailer-mock-token-1');
    assert.equal((await auth.authorize(options, undefined, true))?.accessToken, 'nodemailer-mock-token-2');
    auth.reset();
    const service = { type: 'OAuth2', user: 'b@test', serviceClient: 'client', privateKey: 'offline-key' };
    assert.equal((await auth.authorize(service))?.accessToken, 'nodemailer-mock-token-1');
    assert.equal(events.length, 3);
  });

  it('preserves provider errors and rejects missing credentials or invalid tokens', async () => {
    const auth = new MockOAuth2(() => undefined);
    const error = new Error('provider failed');
    await assert.rejects(auth.authorize({ type: 'OAuth2', user: 'a@test' }, (_user, _renew, done) => done(error)),
      (received) => received === error);
    await assert.rejects(auth.authorize({ type: 'OAuth2', user: 'a@test' }), { code: 'EAUTH' });
    await assert.rejects(auth.authorize({ type: 'OAuth2', accessToken: 'token' }), { code: 'EAUTH' });
    await assert.rejects(auth.authorize({ type: 'OAuth2', user: 'a@test' }, (_user, _renew, done) => done(null, '')),
      { code: 'EAUTH' });
  });

  it('does not emit or cache an old provision result after reset', async () => {
    const events: MockToken[] = [];
    const auth = new MockOAuth2((token) => events.push(token));
    let resume!: () => void;
    const pending = auth.authorize({ type: 'OAuth2', user: 'a@test' }, (_user, _renew, done) => {
      resume = () => done(null, 'old', Date.now() + 60000);
    });
    auth.reset();
    resume();
    assert.equal((await pending)?.accessToken, 'old');
    assert.deepEqual(events, []);
    await assert.rejects(auth.authorize({ type: 'OAuth2', user: 'a@test' }), { code: 'EAUTH' });
  });
  it('keeps renewed tokens ahead of rejected supplied tokens and separates credential identities', async () => {
    const auth = new MockOAuth2(() => undefined);
    const options = { type: 'OAuth2', user: 'a@test', accessToken: 'original' };
    const provider: MockOAuthProvision = (_user, _renew, done) => done(null, 'renewed', Date.now() + 60000);
    await auth.authorize(options, provider);
    await auth.authorize(options, provider, true);
    assert.equal((await auth.authorize(options, provider))?.accessToken, 'renewed');
    let calls = 0;
    const other: MockOAuthProvision = (_user, _renew, done) => { calls++; done(null, 'other', Date.now() + 60000); };
    assert.equal((await auth.authorize({ type: 'OAuth2', user: 'a@test', clientId: 'changed' }, other))?.accessToken,
      'other');
    assert.equal(calls, 1);
  });

});
