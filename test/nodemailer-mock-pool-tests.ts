'use strict';

import { strict as assert } from 'node:assert';
import { mock as nodeMock } from 'node:test';
import { MockPool } from '../src/lib/pool';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

function disconnect() {
  return Object.assign(new Error('Disconnected before sending'), { code: 'ECONNECTION', command: 'CONN' });
}

describe('offline delivery pool', () => {
  afterEach(() => nodeMock.timers.reset());

  it('starts idle and reserves a bounded number of FIFO slots', async () => {
    const starts: number[] = [];
    const gates = [deferred<number>(), deferred<number>(), deferred<number>()];
    const pool = new MockPool({ maxConnections: 2 }, () => {});
    assert.equal(pool.isIdle(), true);
    const jobs = gates.map((gate, index) => pool.run(() => { starts.push(index); return gate.promise; }));
    assert.equal(pool.isIdle(), false);
    await flush();
    assert.deepEqual(starts, [0, 1]);
    gates[1].resolve(1);
    await flush();
    assert.deepEqual(starts, [0, 1, 2]);
    gates[0].resolve(0);
    gates[2].resolve(2);
    assert.deepEqual(await Promise.all(jobs), [0, 1, 2]);
    assert.equal(pool.isIdle(), true);
  });

  it('emits idle asynchronously only after capacity returns, allowing pull loops', async () => {
    const gate = deferred();
    const events: string[] = [];
    let second: Promise<number> | undefined;
    const pool = new MockPool({ maxConnections: 1 }, (event) => {
      events.push(event);
      if (event === 'idle' && !second) second = pool.run(async () => 2);
    });
    const first = pool.run(() => gate.promise);
    assert.deepEqual(events, []);
    gate.resolve();
    await first;
    await flush();
    assert.equal(await second, 2);
    assert.deepEqual(events, ['idle', 'idle']);
  });

  it('closes queued and future jobs while allowing active work to finish before clear', async () => {
    const events: string[] = [];
    const gate = deferred<number>();
    const pool = new MockPool({ maxConnections: 1 }, (event) => events.push(event));
    const first = pool.run(() => gate.promise);
    const waiting = pool.run(async () => 2);
    const rejected = assert.rejects(waiting, { message: 'Connection pool was closed', code: 'EPOOLCLOSED' });
    pool.close();
    await rejected;
    await assert.rejects(pool.run(async () => 3), { code: 'EPOOLCLOSED' });
    assert.equal(pool.isIdle(), false);
    assert.deepEqual(events, []);
    gate.resolve(1);
    assert.equal(await first, 1);
    await flush();
    assert.deepEqual(events, ['clear']);
    pool.close();
    await flush();
    assert.deepEqual(events, ['clear']);
  });

  it('clears an empty pool once on close', async () => {
    const events: string[] = [];
    const pool = new MockPool({}, (event) => events.push(event));
    pool.close();
    pool.close();
    await flush();
    assert.deepEqual(events, ['clear']);
  });

  it('requeues only explicit pre-send disconnects to the back of the queue', async () => {
    const starts: string[] = [];
    let attempts = 0;
    const pool = new MockPool({ maxConnections: 1, maxRequeues: 2 }, () => {});
    const retrying = pool.run(async () => {
      starts.push('retry');
      if (++attempts <= 2) throw disconnect();
      return 10;
    });
    const other = pool.run(async () => { starts.push('other'); return 20; });
    assert.deepEqual(await Promise.all([retrying, other]), [10, 20]);
    assert.deepEqual(starts, ['retry', 'other', 'retry', 'retry']);
    let failures = 0;
    const error = Object.assign(new Error('Send failed'), { code: 'ECONNECTION', command: 'DATA' });
    await assert.rejects(pool.run(async () => { failures++; throw error; }), (failure) => failure === error);
    assert.equal(failures, 1);
  });

  it('limits pre-send retries and supports the explicit unlimited setting', async () => {
    let attempts = 0;
    const pool = new MockPool({ maxRequeues: 1 }, () => {});
    await assert.rejects(pool.run(async () => { attempts++; throw disconnect(); }), { code: 'ECONNECTION' });
    assert.equal(attempts, 2);
    let unlimitedAttempts = 0;
    const unlimited = new MockPool({ maxRequeues: -1 }, () => {});
    assert.equal(await unlimited.run(async () => {
      if (++unlimitedAttempts < 8) throw disconnect();
      return unlimitedAttempts;
    }), 8);
  });

  it('throttles all connections within one shared rate window', async () => {
    nodeMock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
    const starts: number[] = [];
    const pool = new MockPool({ maxConnections: 3, rateLimit: 2, rateDelta: 100 }, () => {});
    const jobs = [0, 1, 2, 3, 4].map((index) => pool.run(async () => { starts.push(index); return index; }));
    await flush();
    assert.deepEqual(starts, [0, 1]);
    nodeMock.timers.tick(99);
    await flush();
    assert.deepEqual(starts, [0, 1]);
    nodeMock.timers.tick(1);
    await flush();
    assert.deepEqual(starts, [0, 1, 2, 3]);
    nodeMock.timers.tick(100);
    await flush();
    assert.deepEqual(await Promise.all(jobs), [0, 1, 2, 3, 4]);
    pool.reset();
  });

  it('regains idle when a rate window expires even when no job is queued', async () => {
    nodeMock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
    const events: string[] = [];
    const pool = new MockPool({ rateLimit: 1, rateDelta: 100 }, (event) => events.push(event));
    await pool.run(async () => 1);
    assert.equal(pool.isIdle(), false);
    assert.deepEqual(events, []);
    nodeMock.timers.tick(100);
    await flush();
    assert.equal(pool.isIdle(), true);
    assert.deepEqual(events, ['idle']);
  });

  it('renews logical connections at maxMessages without dropping queued messages', async () => {
    const pool = new MockPool({ maxConnections: 1, maxMessages: 1 }, () => {});
    assert.deepEqual(await Promise.all([1, 2, 3].map((value) => pool.run(async () => value))), [1, 2, 3]);
  });

  it('clears logical connections after idleTimeout and cancels stale idle timers on new work', async () => {
    nodeMock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
    const events: string[] = [];
    const pool = new MockPool({ idleTimeout: 100 }, (event) => events.push(event));
    await pool.run(async () => 1);
    await flush();
    nodeMock.timers.tick(50);
    const gate = deferred();
    const active = pool.run(() => gate.promise);
    await flush();
    nodeMock.timers.tick(100);
    assert.equal(events.includes('clear'), false);
    gate.resolve();
    await active;
    await flush();
    nodeMock.timers.tick(100);
    assert.equal(events.filter((event) => event === 'clear').length, 1);
    assert.equal(pool.isIdle(), true);
    nodeMock.timers.tick(1000);
    assert.equal(events.filter((event) => event === 'clear').length, 1);
  });

  it('reset rejects queued jobs and prevents old active work from changing new capacity or events', async () => {
    const events: string[] = [];
    const oldGate = deferred<number>();
    const newGate = deferred<number>();
    const pool = new MockPool({ maxConnections: 1 }, (event) => events.push(event));
    const old = pool.run(() => oldGate.promise);
    const queued = pool.run(async () => 2);
    const rejection = assert.rejects(queued, { code: 'ERESET' });
    await flush();
    pool.reset();
    await rejection;
    assert.equal(pool.isIdle(), true);
    const current = pool.run(() => newGate.promise);
    oldGate.resolve(1);
    assert.equal(await old, 1);
    await flush();
    assert.equal(pool.isIdle(), false);
    assert.deepEqual(events, []);
    newGate.resolve(3);
    assert.equal(await current, 3);
    await flush();
    assert.deepEqual(events, ['idle']);
  });

  it('preserves an old active failure after reset without releasing a new job slot', async () => {
    const events: string[] = [];
    const oldGate = deferred<number>();
    const newGate = deferred<number>();
    const pool = new MockPool({ maxConnections: 1 }, (event) => events.push(event));
    const error = new Error('old active send failed');
    const old = assert.rejects(pool.run(() => oldGate.promise), (received) => received === error);
    await flush();
    pool.reset();
    const current = pool.run(() => newGate.promise);
    oldGate.reject(error);
    await old;
    await flush();
    assert.equal(pool.isIdle(), false);
    assert.deepEqual(events, []);
    newGate.resolve(2);
    assert.equal(await current, 2);
    await flush();
    assert.deepEqual(events, ['idle']);
    pool.close();
  });

  it('ignores stale rate callbacks without replacing a new rate-window timer', async () => {
    const timers = nodeMock.method(global, 'setTimeout');
    const events: string[] = [];
    const pool = new MockPool({ rateLimit: 1, rateDelta: 60000 }, (event) => events.push(event));
    try {
      await pool.run(async () => 1);
      const stale = timers.mock.calls[0].arguments[0];
      assert.equal(typeof stale, 'function');
      pool.reset();
      await pool.run(async () => 2);
      const scheduled = timers.mock.callCount();
      // Deliver a captured old notification after reset, as a scheduler double may do.
      stale();
      await flush();
      assert.equal(timers.mock.callCount(), scheduled);
      assert.equal(pool.isIdle(), false);
      assert.deepEqual(events, []);
    } finally {
      pool.reset();
      timers.mock.restore();
    }
  });

  it('ignores stale idle callbacks without clearing new logical connections', async () => {
    const timers = nodeMock.method(global, 'setTimeout');
    const events: string[] = [];
    const pool = new MockPool({ idleTimeout: 60000 }, (event) => events.push(event));
    try {
      await pool.run(async () => 1);
      const stale = timers.mock.calls[0].arguments[0];
      assert.equal(typeof stale, 'function');
      pool.reset();
      await pool.run(async () => 2);
      const scheduled = timers.mock.callCount();
      stale();
      await flush();
      assert.equal(timers.mock.callCount(), scheduled);
      assert.deepEqual(events, []);
      assert.equal(pool.isIdle(), true);
    } finally {
      pool.reset();
      timers.mock.restore();
    }
  });

  it('ignores stale retry callbacks without dispatching a new generation early', async () => {
    const immediates = nodeMock.method(global, 'setImmediate');
    const pool = new MockPool({ maxConnections: 1, maxRequeues: -1 }, () => {});
    try {
      const old = assert.rejects(pool.run(async () => { throw disconnect(); }), { code: 'ERESET' });
      await flush();
      const stale = immediates.mock.calls[0].arguments[0];
      assert.equal(typeof stale, 'function');
      pool.reset();
      await old;
      let attempts = 0;
      const current = assert.rejects(pool.run(async () => { attempts++; throw disconnect(); }), { code: 'ERESET' });
      await flush();
      assert.equal(attempts, 1);
      const scheduled = immediates.mock.callCount();
      stale();
      await flush();
      assert.equal(attempts, 1);
      assert.equal(immediates.mock.callCount(), scheduled);
      pool.reset();
      await current;
      assert.equal(pool.isIdle(), true);
    } finally {
      pool.reset();
      immediates.mock.restore();
    }
  });

  it('clears only once when promise resolution closes the pool reentrantly', async () => {
    const events: string[] = [];
    const pool = new MockPool({ maxConnections: 1 }, (event) => events.push(event));
    const value = {
      message: 'result',
      // Promise resolution inspects then synchronously, including at job settlement.
      get then() {
        if (pool.isIdle()) pool.close();
        return undefined;
      },
    };
    assert.equal(await pool.run(async () => value), value);
    await flush();
    assert.deepEqual(events, ['clear']);
    assert.equal(pool.isIdle(), false);
    await assert.rejects(pool.run(async () => 2), { code: 'EPOOLCLOSED' });
  });

  it('reset cancels rate and idle timers and reopens a closed pool', async () => {
    nodeMock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
    const events: string[] = [];
    const pool = new MockPool({ rateLimit: 1, rateDelta: 100, idleTimeout: 50 }, (event) => events.push(event));
    await pool.run(async () => 1);
    pool.reset();
    nodeMock.timers.tick(1000);
    await flush();
    assert.deepEqual(events, []);
    pool.close();
    pool.reset();
    assert.equal(await pool.run(async () => 2), 2);
    pool.reset();
    nodeMock.timers.tick(1000);
    await flush();
    assert.deepEqual(events, []);
  });

  it('sanitizes invalid numeric limits so tasks cannot become stuck', async () => {
    const pool = new MockPool({
      maxConnections: Number.NaN, maxMessages: -2, rateLimit: -1,
      rateDelta: Number.POSITIVE_INFINITY, idleTimeout: -5, maxRequeues: Number.NaN,
    }, () => {});
    assert.equal(await pool.run(async () => 1), 1);
    assert.equal(pool.isIdle(), true);
    pool.reset();
    const zero = new MockPool({ maxConnections: 0, rateLimit: 0, rateDelta: 0 }, () => {});
    assert.equal(await zero.run(async () => 2), 2);
  });
});
