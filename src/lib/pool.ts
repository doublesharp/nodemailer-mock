/** Options for the offline delivery scheduler. No sockets or SMTP sessions are opened. */
export interface MockPoolOptions {
  maxConnections?: number;
  maxMessages?: number;
  rateLimit?: number;
  rateDelta?: number;
  maxRequeues?: number;
  idleTimeout?: number;
}

interface Job {
  task: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  requeues: number;
}

interface Connection {
  busy: boolean;
  messages: number;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
}

function poolError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

/**
 * FIFO scheduling for mocked deliveries. Connections are logical slots only;
 * maxMessages renews a slot after successful deliveries, without network I/O.
 * Only ECONNECTION errors with command CONN explicitly mean a disconnect before
 * sending and may be retried. Other failures could have delivered and never retry.
 */
export class MockPool {
  private readonly maxConnections: number;
  private readonly maxMessages: number;
  private readonly rateLimit: number;
  private readonly rateDelta: number;
  private readonly maxRequeues: number;
  private readonly idleTimeout: number;
  private readonly emit: (event: 'idle' | 'clear') => void;
  private queue: Job[] = [];
  private connections: Connection[] = [];
  private active = 0;
  private closed = false;
  private cleared = false;
  private generation = 0;
  private idleState = true;
  private idleNotification = 0;
  private rateStarted: number | undefined;
  private rateCount = 0;
  private rateTimer?: ReturnType<typeof setTimeout>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private retryImmediate?: ReturnType<typeof setImmediate>;

  constructor(options: MockPoolOptions, emit: (event: 'idle' | 'clear') => void) {
    this.maxConnections = positiveInteger(options.maxConnections, 5);
    this.maxMessages = positiveInteger(options.maxMessages, 100);
    this.rateLimit = positiveInteger(options.rateLimit, 0);
    this.rateDelta = Math.min(positiveInteger(options.rateDelta, 1000), 2147483647);
    this.maxRequeues = options.maxRequeues === -1 ? -1 :
      typeof options.maxRequeues === 'number' && Number.isFinite(options.maxRequeues) && options.maxRequeues >= 0 ?
        Math.floor(options.maxRequeues) : 5;
    this.idleTimeout = Math.min(positiveInteger(options.idleTimeout, 0), 2147483647);
    this.emit = emit;
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    if (this.closed) return Promise.reject(poolError('Connection pool was closed', 'EPOOLCLOSED'));
    this.cancelIdleTimer();
    const promise = new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve: resolve as (value: unknown) => void, reject, requeues: 0 });
    });
    this.drain();
    return promise;
  }

  isIdle(): boolean {
    return !this.closed && this.active < this.maxConnections && this.queue.length === 0 && !this.rateBlocked();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.cancelTimers();
    for (const job of this.queue.splice(0)) job.reject(poolError('Connection pool was closed', 'EPOOLCLOSED'));
    this.updateIdle();
    if (!this.active) this.clearClosed();
  }

  reset(): void {
    this.generation++;
    this.cancelTimers();
    for (const job of this.queue.splice(0)) job.reject(poolError('Connection pool was reset', 'ERESET'));
    this.connections = [];
    this.active = 0;
    this.closed = false;
    this.cleared = false;
    this.idleState = true;
    this.idleNotification++;
    this.rateStarted = undefined;
    this.rateCount = 0;
  }

  private rateBlocked(): boolean {
    if (!this.rateLimit || this.rateStarted === undefined) return false;
    if (Date.now() - this.rateStarted >= this.rateDelta) return false;
    return this.rateCount >= this.rateLimit;
  }

  private drain(): void {
    if (this.retryImmediate) {
      this.updateIdle();
      return;
    }
    while (!this.closed && this.queue.length && this.active < this.maxConnections && !this.rateBlocked()) {
      const job = this.queue.shift()!;
      let connection = this.connections.find((candidate) => !candidate.busy);
      if (!connection) {
        connection = { busy: false, messages: 0 };
        this.connections.push(connection);
      }
      connection.busy = true;
      this.active++;
      if (this.rateLimit) {
        if (this.rateStarted === undefined || Date.now() - this.rateStarted >= this.rateDelta) {
          this.rateStarted = Date.now();
          this.rateCount = 0;
        }
        this.rateCount++;
      }
      const generation = this.generation;
      const slot = connection;
      Promise.resolve().then(job.task).then(
        (value) => this.complete(job, slot, generation, true, value),
        (error: unknown) => this.complete(job, slot, generation, false, error),
      );
    }
    if (!this.closed && this.rateBlocked() && !this.rateTimer) {
      const generation = this.generation;
      this.rateTimer = setTimeout(() => {
        if (generation !== this.generation) return;
        this.rateTimer = undefined;
        this.drain();
      }, Math.max(1, this.rateDelta - (Date.now() - this.rateStarted!)));
    }
    this.updateIdle();
    this.scheduleIdleClear();
  }

  private complete(job: Job, connection: Connection, generation: number, success: boolean, value: unknown): void {
    if (generation !== this.generation) {
      if (success) job.resolve(value);
      else job.reject(value);
      return;
    }
    this.active--;
    connection.busy = false;
    if (success) {
      connection.messages++;
      if (connection.messages >= this.maxMessages) {
        this.connections = this.connections.filter((candidate) => candidate !== connection);
      }
      job.resolve(value);
    } else {
      const error = value as { code?: string; command?: string } | null;
      if (!this.closed && error?.code === 'ECONNECTION' && error.command === 'CONN' &&
        (this.maxRequeues === -1 || job.requeues < this.maxRequeues)) {
        job.requeues++;
        this.queue.push(job);
        // Yield between disconnect retries so timers can close or reset the pool.
        if (!this.retryImmediate) {
          this.retryImmediate = setImmediate(() => {
            if (generation !== this.generation) return;
            this.retryImmediate = undefined;
            this.drain();
          });
        }
      } else {
        job.reject(value);
      }
    }
    if (this.closed) {
      if (!this.active) this.clearClosed();
    } else {
      this.drain();
    }
  }

  private updateIdle(): void {
    const idle = this.isIdle();
    if (idle === this.idleState) return;
    this.idleState = idle;
    const notification = ++this.idleNotification;
    if (!idle) return;
    const generation = this.generation;
    queueMicrotask(() => {
      if (generation === this.generation && notification === this.idleNotification && this.isIdle()) this.emit('idle');
    });
  }

  private scheduleIdleClear(): void {
    if (!this.idleTimeout || this.closed || this.active || this.queue.length ||
      !this.connections.length || this.idleTimer) return;
    const generation = this.generation;
    this.idleTimer = setTimeout(() => {
      if (generation !== this.generation) return;
      this.idleTimer = undefined;
      this.connections = [];
      this.emit('clear');
    }, this.idleTimeout);
  }

  private clearClosed(): void {
    if (this.cleared) return;
    this.cleared = true;
    this.connections = [];
    const generation = this.generation;
    queueMicrotask(() => { if (generation === this.generation) this.emit('clear'); });
  }

  private cancelIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }

  private cancelTimers(): void {
    this.cancelIdleTimer();
    if (this.rateTimer) clearTimeout(this.rateTimer);
    this.rateTimer = undefined;
    if (this.retryImmediate) clearImmediate(this.retryImmediate);
    this.retryImmediate = undefined;
  }
}
