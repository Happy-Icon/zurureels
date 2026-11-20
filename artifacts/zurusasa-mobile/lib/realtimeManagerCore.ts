export type PostgresChangeEvent = '*' | 'INSERT' | 'UPDATE' | 'DELETE';

export interface PostgresChangeBinding {
  event: PostgresChangeEvent;
  schema: string;
  table: string;
  filter?: string;
}

export type RealtimeChannelStatus =
  | 'SUBSCRIBED'
  | 'CHANNEL_ERROR'
  | 'TIMED_OUT'
  | 'CLOSED';

export type ManagedEntryState =
  | 'IDLE'
  | 'SUBSCRIBING'
  | RealtimeChannelStatus;

export interface PostgresChangePayload<T extends Record<string, any> = Record<string, any>> {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: Partial<T>;
  errors: string[] | null;
}

export interface ManagedSubscriptionSpec {
  /** Logical key shared across components observing the same stream (e.g. "inbox:<userId>") */
  key: string;
  /** Base topic prefix; a monotonic generation suffix is always appended for fresh channel lifecycles */
  topicPrefix: string;
  /** All postgres_changes bindings registered on the channel BEFORE subscribe() */
  bindings: readonly PostgresChangeBinding[];
}

export type RealtimeEventHandler = (
  payload: PostgresChangePayload,
  bindingIndex: number,
) => void;

export interface RealtimeSubscribeOptions {
  /** Called whenever the underlying channel reports a status transition */
  onStatus?: (status: RealtimeChannelStatus, err?: Error) => void;
  /** Called when a previously subscribed stream recovers and reaches SUBSCRIBED again */
  onReconnect?: () => void;
}

export interface RealtimeChannelLike {
  topic?: string;
  state?: string;
  on(
    type: 'postgres_changes',
    filter: {
      event: PostgresChangeEvent;
      schema: string;
      table?: string;
      filter?: string;
    },
    callback: (payload: PostgresChangePayload) => void,
  ): RealtimeChannelLike;
  subscribe(
    callback?: (status: RealtimeChannelStatus, err?: Error) => void,
    timeout?: number,
  ): RealtimeChannelLike;
}

export interface SupabaseRealtimeClientLike {
  channel(name: string, opts?: Record<string, unknown>): RealtimeChannelLike;
  removeChannel(channel: any): Promise<unknown>;
  getChannels?: () => RealtimeChannelLike[];
  realtime?: {
    setAuth?: (token?: string | null) => Promise<void> | void;
    isConnected?: () => boolean;
    connect?: () => void;
  };
}

export interface ActiveSubscriptionSnapshot {
  key: string;
  topic: string | null;
  state: ManagedEntryState;
  listenerCount: number;
  generation: number;
  retryCount: number;
  pendingRecovery: boolean;
}

export interface RealtimeManagerConfig {
  /** Backoff schedule in ms for automatic recovery after CHANNEL_ERROR / TIMED_OUT / unexpected CLOSED */
  retryDelaysMs?: readonly number[];
  /** Optional custom logger for diagnostics */
  logger?: {
    warn?: (message: string, ...args: unknown[]) => void;
    debug?: (message: string, ...args: unknown[]) => void;
  };
}

interface ListenerRecord {
  id: number;
  onEvent: RealtimeEventHandler;
  onStatus?: (status: RealtimeChannelStatus, err?: Error) => void;
  onReconnect?: () => void;
}

interface ManagedChannelEntry {
  key: string;
  topicPrefix: string;
  signature: string;
  bindings: readonly PostgresChangeBinding[];
  listeners: Map<number, ListenerRecord>;
  channel: RealtimeChannelLike | null;
  topic: string | null;
  generation: number;
  state: ManagedEntryState;
  hasSubscribedOnce: boolean;
  retryCount: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  pendingRecovery: boolean;
  disposed: boolean;
}

const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [1_000, 2_000, 5_000, 10_000, 20_000];

function serializeBindings(bindings: readonly PostgresChangeBinding[]): string {
  return bindings
    .map((b) => `${b.event}|${b.schema}|${b.table}|${b.filter ?? ''}`)
    .join(';');
}

function sanitizeTopicSegment(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9:_-]/g, '_');
}

function isUnderlyingChannelUnhealthy(channel: RealtimeChannelLike | null): boolean {
  if (!channel) return true;
  const state = channel.state;
  return state === 'closed' || state === 'errored' || state === 'leaving';
}

/**
 * Centralized, reference-counted Supabase Realtime subscription lifecycle manager.
 *
 * Guarantees:
 * 1. Every new channel lifecycle uses a fresh physical topic (`<prefix>_g<n>`) so
 *    `supabase.channel(...)` never returns an already-subscribed or still-leaving channel.
 * 2. All `.on('postgres_changes', ...)` listeners are registered synchronously BEFORE `.subscribe()`.
 * 3. Multiple components observing the same logical stream share ONE underlying channel via
 *    in-memory fan-out instead of opening duplicate channels or mutating a subscribed channel.
 * 4. Every channel explicitly handles SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, and CLOSED,
 *    recovering by cleanly removing the dead channel and creating a brand-new instance.
 * 5. Coordinates with network (NetInfo) and app lifecycle (AppState) transitions without leaks.
 */
export class RealtimeSubscriptionManager {
  private readonly client: SupabaseRealtimeClientLike;
  private readonly retryDelaysMs: readonly number[];
  private readonly warn: (message: string, ...args: unknown[]) => void;

  private readonly entries = new Map<string, ManagedChannelEntry>();
  private nextGeneration = 0;
  private nextListenerId = 0;
  private isOnline = true;
  private isForeground = true;

  constructor(client: SupabaseRealtimeClientLike, config?: RealtimeManagerConfig) {
    this.client = client;
    this.retryDelaysMs = config?.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.warn = config?.logger?.warn ?? ((msg, ...args) => console.warn(msg, ...args));
  }

  /**
   * Subscribe to a managed Realtime stream. Returns an idempotent unsubscribe function.
   */
  subscribe(
    spec: ManagedSubscriptionSpec,
    onEvent: RealtimeEventHandler,
    options?: RealtimeSubscribeOptions,
  ): () => void {
    const signature = serializeBindings(spec.bindings);
    let resolvedKey = spec.key;
    let entry = this.entries.get(resolvedKey);

    if (entry && entry.signature !== signature) {
      this.warn(
        `[RealtimeManager] Binding mismatch for logical key "${spec.key}". Isolating into distinct channel entry.`,
      );
      resolvedKey = `${spec.key}::${signature}`;
      entry = this.entries.get(resolvedKey);
    }

    const listenerId = ++this.nextListenerId;
    const listener: ListenerRecord = {
      id: listenerId,
      onEvent,
      onStatus: options?.onStatus,
      onReconnect: options?.onReconnect,
    };

    if (!entry) {
      entry = {
        key: resolvedKey,
        topicPrefix: sanitizeTopicSegment(spec.topicPrefix),
        signature,
        bindings: spec.bindings.map((b) => ({ ...b })),
        listeners: new Map([[listenerId, listener]]),
        channel: null,
        topic: null,
        generation: 0,
        state: 'IDLE',
        hasSubscribedOnce: false,
        retryCount: 0,
        retryTimer: null,
        pendingRecovery: false,
        disposed: false,
      };
      this.entries.set(resolvedKey, entry);
      this.openChannel(entry);
    } else {
      entry.listeners.set(listenerId, listener);

      if (entry.state === 'SUBSCRIBED' && !isUnderlyingChannelUnhealthy(entry.channel)) {
        try {
          listener.onStatus?.('SUBSCRIBED');
        } catch (err) {
          this.warn(`[RealtimeManager] onStatus callback error on ${entry.key}:`, err);
        }
      } else if (
        this.isOnline &&
        this.isForeground &&
        entry.state !== 'SUBSCRIBING' &&
        !entry.retryTimer
      ) {
        entry.retryCount = 0;
        this.openChannel(entry);
      }
    }

    let active = true;
    const targetEntry = entry;

    return () => {
      if (!active) return;
      active = false;
      this.removeListener(targetEntry, listenerId);
    };
  }

  /**
   * Notify manager of connectivity changes (e.g. from NetInfo).
   */
  setOnline(online: boolean): void {
    const wasOnline = this.isOnline;
    this.isOnline = online;

    if (!online) {
      for (const entry of this.entries.values()) {
        this.clearRetryTimer(entry);
        if (entry.state !== 'SUBSCRIBED') {
          entry.pendingRecovery = true;
        }
      }
      return;
    }

    if (!wasOnline && this.isForeground) {
      this.syncAuthSafely();
      this.recoverUnhealthyChannels(true);
    }
  }

  /**
   * Notify manager of foreground/background transitions (e.g. from AppState).
   */
  setForeground(foreground: boolean): void {
    const wasForeground = this.isForeground;
    this.isForeground = foreground;

    if (!foreground) {
      for (const entry of this.entries.values()) {
        this.clearRetryTimer(entry);
        if (entry.state !== 'SUBSCRIBED') {
          entry.pendingRecovery = true;
        }
      }
      return;
    }

    if (!wasForeground && this.isOnline) {
      this.syncAuthSafely();
      this.recoverUnhealthyChannels(true);
    }
  }

  /**
   * Force recovery check on any channels that errored, timed out, closed, or were deferred offline.
   */
  recoverUnhealthyChannels(resetBackoff = false): void {
    if (!this.isOnline || !this.isForeground) return;

    const socketConnected = this.client.realtime?.isConnected?.();
    if (socketConnected === false) {
      try {
        this.client.realtime?.connect?.();
      } catch (err) {
        this.warn('[RealtimeManager] Socket reconnect note:', err);
      }
    }

    for (const entry of Array.from(this.entries.values())) {
      if (entry.disposed || entry.listeners.size === 0) continue;

      const needsRecovery =
        entry.pendingRecovery ||
        entry.state === 'CHANNEL_ERROR' ||
        entry.state === 'TIMED_OUT' ||
        entry.state === 'CLOSED' ||
        entry.state === 'IDLE' ||
        (entry.state === 'SUBSCRIBED' && isUnderlyingChannelUnhealthy(entry.channel));

      if (!needsRecovery) continue;

      if (resetBackoff) {
        entry.retryCount = 0;
      }
      this.openChannel(entry);
    }
  }

  /**
   * Cleanly unsubscribe and remove all active managed channels (e.g. on sign-out).
   */
  async teardownAll(): Promise<void> {
    const removals: Promise<unknown>[] = [];
    const activeEntries = Array.from(this.entries.values());
    this.entries.clear();

    for (const entry of activeEntries) {
      entry.disposed = true;
      entry.generation = ++this.nextGeneration;
      this.clearRetryTimer(entry);
      entry.listeners.clear();
      const ch = entry.channel;
      entry.channel = null;
      entry.topic = null;
      entry.state = 'CLOSED';
      if (ch) {
        removals.push(this.safeRemoveChannel(ch));
      }
    }

    await Promise.allSettled(removals);
  }

  /**
   * Diagnostic snapshot of currently managed subscriptions (useful for tests & debugging).
   */
  getActiveSubscriptions(): ActiveSubscriptionSnapshot[] {
    return Array.from(this.entries.values()).map((entry) => ({
      key: entry.key,
      topic: entry.topic,
      state: entry.state,
      listenerCount: entry.listeners.size,
      generation: entry.generation,
      retryCount: entry.retryCount,
      pendingRecovery: entry.pendingRecovery,
    }));
  }

  private removeListener(entry: ManagedChannelEntry, listenerId: number): void {
    entry.listeners.delete(listenerId);
    if (entry.listeners.size > 0) return;

    entry.disposed = true;
    // Bump generation so any late CLOSED/error callback from the departing channel is ignored
    entry.generation = ++this.nextGeneration;
    this.clearRetryTimer(entry);

    if (this.entries.get(entry.key) === entry) {
      this.entries.delete(entry.key);
    }

    const ch = entry.channel;
    entry.channel = null;
    entry.topic = null;
    entry.state = 'CLOSED';

    if (ch) {
      void this.safeRemoveChannel(ch);
    }
  }

  private openChannel(entry: ManagedChannelEntry): void {
    if (entry.disposed || entry.listeners.size === 0) return;

    this.clearRetryTimer(entry);

    if (!this.isOnline || !this.isForeground) {
      entry.pendingRecovery = true;
      return;
    }

    entry.pendingRecovery = false;

    // Tear down any previous channel instance before creating a fresh one
    const previousChannel = entry.channel;
    entry.channel = null;
    entry.topic = null;

    // Allocate a strictly monotonic generation & physical topic BEFORE removing previous channel
    const generation = ++this.nextGeneration;
    entry.generation = generation;

    if (previousChannel) {
      void this.safeRemoveChannel(previousChannel);
    }

    const topic = `${entry.topicPrefix}_g${generation}`;
    entry.topic = topic;
    entry.state = 'SUBSCRIBING';

    let channel: RealtimeChannelLike;
    try {
      channel = this.client.channel(topic);

      // Register ALL postgres_changes bindings synchronously BEFORE calling .subscribe()
      entry.bindings.forEach((binding, bindingIndex) => {
        const filterConfig: {
          event: PostgresChangeEvent;
          schema: string;
          table: string;
          filter?: string;
        } = {
          event: binding.event,
          schema: binding.schema,
          table: binding.table,
        };
        if (binding.filter) {
          filterConfig.filter = binding.filter;
        }

        channel.on('postgres_changes', filterConfig, (payload) => {
          if (entry.disposed || entry.generation !== generation) return;
          for (const listener of Array.from(entry.listeners.values())) {
            try {
              listener.onEvent(payload, bindingIndex);
            } catch (err) {
              this.warn(`[RealtimeManager] Event listener error on ${entry.key}:`, err);
            }
          }
        });
      });

      entry.channel = channel;

      channel.subscribe((status, err) => {
        // Ignore stale lifecycle events from superseded or disposed channel generations
        if (entry.disposed || entry.generation !== generation) return;

        entry.state = status;

        for (const listener of Array.from(entry.listeners.values())) {
          try {
            listener.onStatus?.(status, err);
          } catch (cbErr) {
            this.warn(`[RealtimeManager] Status callback error on ${entry.key}:`, cbErr);
          }
        }

        if (status === 'SUBSCRIBED') {
          const isReconnect = entry.hasSubscribedOnce;
          entry.hasSubscribedOnce = true;
          entry.retryCount = 0;
          entry.pendingRecovery = false;
          this.clearRetryTimer(entry);

          if (isReconnect) {
            for (const listener of Array.from(entry.listeners.values())) {
              try {
                listener.onReconnect?.();
              } catch (recErr) {
                this.warn(`[RealtimeManager] Reconnect callback error on ${entry.key}:`, recErr);
              }
            }
          }
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (err) {
            this.warn(`[RealtimeManager] ${entry.key} (${topic}) -> ${status}:`, err.message || err);
          }
          this.scheduleReconnect(entry);
        }
      });
    } catch (err: any) {
      this.warn(`[RealtimeManager] Failed to initialize ${entry.key} (${topic}):`, err);
      entry.state = 'CHANNEL_ERROR';
      if (entry.channel) {
        const failed = entry.channel;
        entry.channel = null;
        void this.safeRemoveChannel(failed);
      }
      for (const listener of Array.from(entry.listeners.values())) {
        try {
          listener.onStatus?.('CHANNEL_ERROR', err instanceof Error ? err : new Error(String(err)));
        } catch {}
      }
      this.scheduleReconnect(entry);
    }
  }

  private scheduleReconnect(entry: ManagedChannelEntry): void {
    if (entry.disposed || entry.listeners.size === 0) return;

    this.clearRetryTimer(entry);

    if (!this.isOnline || !this.isForeground) {
      entry.pendingRecovery = true;
      return;
    }

    if (entry.retryCount >= this.retryDelaysMs.length) {
      // Stop tight retry loops; wait for next network/foreground event or new subscriber
      entry.pendingRecovery = true;
      return;
    }

    const delayMs = this.retryDelaysMs[entry.retryCount];
    entry.retryCount += 1;
    const expectedGeneration = entry.generation;

    entry.retryTimer = setTimeout(() => {
      entry.retryTimer = null;
      if (entry.disposed || entry.listeners.size === 0 || entry.generation !== expectedGeneration) {
        return;
      }
      if (!this.isOnline || !this.isForeground) {
        entry.pendingRecovery = true;
        return;
      }
      this.syncAuthSafely();
      this.openChannel(entry);
    }, delayMs);
  }

  private clearRetryTimer(entry: ManagedChannelEntry): void {
    if (entry.retryTimer !== null) {
      clearTimeout(entry.retryTimer);
      entry.retryTimer = null;
    }
  }

  private syncAuthSafely(): void {
    try {
      // Call setAuth() with NO arguments so SupabaseClient uses its accessToken callback
      // rather than locking RealtimeClient into manual-token mode.
      const res = this.client.realtime?.setAuth?.();
      if (res && typeof (res as Promise<void>).catch === 'function') {
        (res as Promise<void>).catch(() => {});
      }
    } catch {}
  }

  private async safeRemoveChannel(channel: RealtimeChannelLike): Promise<void> {
    try {
      await this.client.removeChannel(channel);
    } catch (err) {
      this.warn('[RealtimeManager] removeChannel note:', err);
    }
  }
}
