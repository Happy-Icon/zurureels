import { before, describe, test } from 'node:test';
import assert from 'node:assert';
import type {
  PostgresChangeEvent,
  PostgresChangePayload,
  RealtimeChannelLike,
  RealtimeChannelStatus,
  RealtimeSubscriptionManager as RealtimeSubscriptionManagerClass,
  SupabaseRealtimeClientLike,
} from '@/lib/realtimeManagerCore';

let RealtimeSubscriptionManager: typeof RealtimeSubscriptionManagerClass;

before(async () => {
  const mod = (await import('../../lib/realtimeManagerCore.ts' as any)) as typeof import('@/lib/realtimeManagerCore');
  RealtimeSubscriptionManager = mod.RealtimeSubscriptionManager;
});

interface FakeBinding {
  filter: {
    event: PostgresChangeEvent;
    schema: string;
    table?: string;
    filter?: string;
  };
  callback: (payload: PostgresChangePayload) => void;
}

/**
 * Faithful behavioral mock of @supabase/realtime-js v2.110.7:
 * - Caches channels by `realtime:${topic}` just like RealtimeClient.channel()
 * - Throws the exact error if `.on('postgres_changes', ...)` is called while `joining` or `joined`
 * - Keeps channels in `this.channels` in `leaving` state during async `removeChannel()` until acked
 */
class FakeRealtimeChannel implements RealtimeChannelLike {
  public readonly topic: string;
  public state: 'closed' | 'joining' | 'joined' | 'leaving' | 'errored' = 'closed';
  public readonly bindings: FakeBinding[] = [];
  public subscribeCalls = 0;
  private statusCallback?: (status: RealtimeChannelStatus, err?: Error) => void;
  private readonly onRemove: (ch: FakeRealtimeChannel) => void;

  constructor(topic: string, onRemove: (ch: FakeRealtimeChannel) => void) {
    this.topic = topic;
    this.onRemove = onRemove;
  }

  on(
    type: 'postgres_changes',
    filter: FakeBinding['filter'],
    callback: (payload: PostgresChangePayload) => void,
  ): RealtimeChannelLike {
    if (
      type === 'postgres_changes' &&
      (this.state === 'joined' || this.state === 'joining')
    ) {
      throw new Error(
        `cannot add \`${type}\` callbacks for ${this.topic} after \`subscribe()\`.`,
      );
    }
    this.bindings.push({ filter, callback });
    return this;
  }

  subscribe(callback?: (status: RealtimeChannelStatus, err?: Error) => void): RealtimeChannelLike {
    this.subscribeCalls += 1;
    this.statusCallback = callback;
    if (this.state === 'closed') {
      this.state = 'joining';
    }
    return this;
  }

  // Test helpers simulating server frames
  simulateSubscribed(): void {
    this.state = 'joined';
    this.statusCallback?.('SUBSCRIBED');
  }

  simulateError(message = 'network error'): void {
    this.state = 'errored';
    this.statusCallback?.('CHANNEL_ERROR', new Error(message));
  }

  simulateTimedOut(): void {
    this.state = 'errored';
    this.statusCallback?.('TIMED_OUT');
  }

  simulateUnexpectedClose(): void {
    this.state = 'closed';
    this.onRemove(this);
    this.statusCallback?.('CLOSED');
  }

  simulateSilentSocketDrop(): void {
    // Models mobile OS tearing down socket while suspended without delivering callback
    this.state = 'closed';
  }

  emitChange(bindingIndex: number, payload: Partial<PostgresChangePayload>): void {
    const binding = this.bindings[bindingIndex];
    if (!binding) {
      throw new Error(`No binding at index ${bindingIndex} on ${this.topic}`);
    }
    binding.callback({
      schema: binding.filter.schema,
      table: binding.filter.table ?? 'unknown',
      commit_timestamp: new Date().toISOString(),
      eventType: 'INSERT',
      new: {},
      old: {},
      errors: null,
      ...payload,
    });
  }

  beginLeave(delayMs: number): Promise<'ok'> {
    this.state = 'leaving';
    return new Promise((resolve) => {
      setTimeout(() => {
        this.state = 'closed';
        this.onRemove(this);
        this.statusCallback?.('CLOSED');
        resolve('ok');
      }, delayMs);
    });
  }
}

class FakeSupabaseClient implements SupabaseRealtimeClientLike {
  public channels: FakeRealtimeChannel[] = [];
  public createdChannels: FakeRealtimeChannel[] = [];
  public removedChannels: FakeRealtimeChannel[] = [];
  public setAuthCalls: Array<string | null | undefined> = [];
  public connectCalls = 0;
  public connected = true;
  public leaveDelayMs = 20;

  public realtime = {
    setAuth: async (token?: string | null) => {
      this.setAuthCalls.push(token);
    },
    isConnected: () => this.connected,
    connect: () => {
      this.connectCalls += 1;
      this.connected = true;
    },
  };

  channel(name: string): FakeRealtimeChannel {
    const realtimeTopic = `realtime:${name}`;
    const existing = this.channels.find((c) => c.topic === realtimeTopic);
    if (existing) {
      return existing;
    }
    const ch = new FakeRealtimeChannel(realtimeTopic, (target) => {
      this.channels = this.channels.filter((c) => c !== target);
    });
    this.channels.push(ch);
    this.createdChannels.push(ch);
    return ch;
  }

  async removeChannel(channel: FakeRealtimeChannel): Promise<'ok'> {
    this.removedChannels.push(channel);
    return channel.beginLeave(this.leaveDelayMs);
  }

  getChannels(): FakeRealtimeChannel[] {
    return this.channels;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('RealtimeSubscriptionManager Lifecycle Tests', () => {
  test('1. Repeated inbox open/close & rapid remount never throws after subscribe() even during async removeChannel', async () => {
    const client = new FakeSupabaseClient();
    client.leaveDelayMs = 30;
    const manager = new RealtimeSubscriptionManager(client, {
      retryDelaysMs: [15, 30],
      logger: { warn: () => {} },
    });

    const userId = '07150556-5c7e-4bdf-b146-4611ce8c9929';
    const inboxSpec = {
      key: `inbox:${userId}`,
      topicPrefix: `inbox_${userId}`,
      bindings: [{ event: '*' as const, schema: 'public', table: 'conversations' }],
    };

    let eventsReceived = 0;

    // Rapidly mount & unmount 20 times without waiting for phx_leave ack
    for (let i = 0; i < 20; i++) {
      const unsub = manager.subscribe(inboxSpec, () => {
        eventsReceived += 1;
      });
      const current = client.createdChannels[client.createdChannels.length - 1];
      current.simulateSubscribed();
      assert.strictEqual(current.bindings.length, 1);
      unsub();
    }

    // Re-open one final time while previous channels are still asynchronously leaving
    const finalUnsub = manager.subscribe(inboxSpec, () => {
      eventsReceived += 1;
    });
    const activeChannel = client.createdChannels[client.createdChannels.length - 1];
    activeChannel.simulateSubscribed();

    // Wait for all 20 async leaves to finish
    await wait(60);

    // Only the final active channel must remain in the client and receive live updates
    assert.strictEqual(client.channels.length, 1);
    assert.strictEqual(client.channels[0], activeChannel);
    assert.strictEqual(manager.getActiveSubscriptions().length, 1);
    assert.strictEqual(manager.getActiveSubscriptions()[0].state, 'SUBSCRIBED');

    activeChannel.emitChange(0, { eventType: 'UPDATE', new: { id: 'conv-1' } });
    assert.strictEqual(eventsReceived, 1);

    finalUnsub();
    await wait(50);
    assert.strictEqual(client.channels.length, 0);
    assert.strictEqual(manager.getActiveSubscriptions().length, 0);
  });

  test('2. Concurrent subscribers on same logical stream share ONE channel without mutating subscribed channel', async () => {
    const client = new FakeSupabaseClient();
    const manager = new RealtimeSubscriptionManager(client, { logger: { warn: () => {} } });

    const userId = 'user-123';
    const notifSpec = {
      key: `notifications:${userId}`,
      topicPrefix: `notifs_${userId}`,
      bindings: [
        {
          event: '*' as const,
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
      ],
    };

    const receivedGlobal: string[] = [];
    const receivedProfile: string[] = [];
    const receivedCenter: string[] = [];
    const centerStatuses: RealtimeChannelStatus[] = [];

    const unsubGlobal = manager.subscribe(notifSpec, (p) => receivedGlobal.push(p.new.id));
    const ch = client.createdChannels[0];
    ch.simulateSubscribed();

    // Two more components subscribe while channel is already SUBSCRIBED (must NOT call ch.on()!)
    const unsubProfile = manager.subscribe(notifSpec, (p) => receivedProfile.push(p.new.id));
    const unsubCenter = manager.subscribe(
      notifSpec,
      (p) => receivedCenter.push(p.new.id),
      { onStatus: (s) => centerStatuses.push(s) },
    );

    assert.strictEqual(client.createdChannels.length, 1);
    assert.strictEqual(ch.bindings.length, 1);
    assert.strictEqual(manager.getActiveSubscriptions()[0].listenerCount, 3);
    assert.deepStrictEqual(centerStatuses, ['SUBSCRIBED']);

    ch.emitChange(0, { eventType: 'INSERT', new: { id: 'n-1' } });
    assert.deepStrictEqual(receivedGlobal, ['n-1']);
    assert.deepStrictEqual(receivedProfile, ['n-1']);
    assert.deepStrictEqual(receivedCenter, ['n-1']);

    // Closing NotificationCenter & Profile keeps the shared channel alive for Global
    unsubCenter();
    unsubProfile();
    assert.strictEqual(client.removedChannels.length, 0);
    assert.strictEqual(manager.getActiveSubscriptions()[0].listenerCount, 1);

    ch.emitChange(0, { eventType: 'INSERT', new: { id: 'n-2' } });
    assert.deepStrictEqual(receivedGlobal, ['n-1', 'n-2']);
    assert.deepStrictEqual(receivedProfile, ['n-1']);

    // Closing the final subscriber removes the channel cleanly (double-unsub is idempotent)
    unsubGlobal();
    unsubGlobal();
    assert.strictEqual(client.removedChannels.length, 1);
    await wait(40);
    assert.strictEqual(client.channels.length, 0);
    assert.strictEqual(manager.getActiveSubscriptions().length, 0);
  });

  test('3. Switching between conversations cleans up old stream, ignores stale events, and receives live messages', async () => {
    const client = new FakeSupabaseClient();
    const manager = new RealtimeSubscriptionManager(client, { logger: { warn: () => {} } });

    const convAMessages: string[] = [];
    const convBMessages: string[] = [];

    const unsubA = manager.subscribe(
      {
        key: 'chat:conv-A',
        topicPrefix: 'conv_conv-A',
        bindings: [
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: 'conversation_id=eq.conv-A',
          },
        ],
      },
      (p) => convAMessages.push(`${p.eventType}:${p.new.id}`),
    );
    const chA = client.createdChannels[0];
    chA.simulateSubscribed();
    chA.emitChange(0, { eventType: 'INSERT', new: { id: 'm1' } });
    chA.emitChange(0, { eventType: 'UPDATE', new: { id: 'm1', is_read: true } });
    assert.deepStrictEqual(convAMessages, ['INSERT:m1', 'UPDATE:m1']);

    // Switch to conversation B
    unsubA();
    const unsubB = manager.subscribe(
      {
        key: 'chat:conv-B',
        topicPrefix: 'conv_conv-B',
        bindings: [
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: 'conversation_id=eq.conv-B',
          },
        ],
      },
      (p) => convBMessages.push(`${p.eventType}:${p.new.id}`),
    );
    const chB = client.createdChannels[1];
    chB.simulateSubscribed();

    // Late event on departing chA must be ignored
    chA.emitChange(0, { eventType: 'INSERT', new: { id: 'stale-m2' } });
    assert.deepStrictEqual(convAMessages, ['INSERT:m1', 'UPDATE:m1']);

    chB.emitChange(0, { eventType: 'INSERT', new: { id: 'm9' } });
    assert.deepStrictEqual(convBMessages, ['INSERT:m9']);

    // Switch right back to conv-A while old chA may still be leaving -> fresh topic generation
    unsubB();
    const unsubA2 = manager.subscribe(
      {
        key: 'chat:conv-A',
        topicPrefix: 'conv_conv-A',
        bindings: [
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: 'conversation_id=eq.conv-A',
          },
        ],
      },
      (p) => convAMessages.push(`${p.eventType}:${p.new.id}`),
    );
    const chA2 = client.createdChannels[2];
    assert.notStrictEqual(chA2.topic, chA.topic);
    chA2.simulateSubscribed();
    chA2.emitChange(0, { eventType: 'INSERT', new: { id: 'm3' } });
    assert.deepStrictEqual(convAMessages, ['INSERT:m1', 'UPDATE:m1', 'INSERT:m3']);

    unsubA2();
    await wait(40);
    assert.strictEqual(client.channels.length, 0);
  });

  test('4. Handles CHANNEL_ERROR, TIMED_OUT, and unexpected CLOSED by creating fresh channel instances without mutating old ones', async () => {
    const client = new FakeSupabaseClient();
    const manager = new RealtimeSubscriptionManager(client, {
      retryDelaysMs: [15, 20, 25],
      logger: { warn: () => {} },
    });

    const statuses: RealtimeChannelStatus[] = [];
    let reconnectCount = 0;

    const unsub = manager.subscribe(
      {
        key: 'inbox:u1',
        topicPrefix: 'inbox_u1',
        bindings: [{ event: '*', schema: 'public', table: 'conversations' }],
      },
      () => {},
      {
        onStatus: (s) => statuses.push(s),
        onReconnect: () => {
          reconnectCount += 1;
        },
      },
    );

    const ch1 = client.createdChannels[0];
    ch1.simulateSubscribed();
    assert.strictEqual(reconnectCount, 0); // Initial subscribe is NOT a reconnect

    // Trigger CHANNEL_ERROR -> must teardown ch1 and create fresh ch2
    ch1.simulateError('ws dropped');
    await wait(30);
    assert.strictEqual(client.createdChannels.length, 2);
    const ch2 = client.createdChannels[1];
    assert.notStrictEqual(ch2.topic, ch1.topic);
    assert.strictEqual(ch2.bindings.length, 1);
    ch2.simulateSubscribed();
    assert.strictEqual(reconnectCount, 1);

    // Trigger TIMED_OUT -> fresh ch3
    ch2.simulateTimedOut();
    await wait(30);
    assert.strictEqual(client.createdChannels.length, 3);
    const ch3 = client.createdChannels[2];
    ch3.simulateSubscribed();
    assert.strictEqual(reconnectCount, 2);

    // Trigger unexpected CLOSED -> fresh ch4
    ch3.simulateUnexpectedClose();
    await wait(30);
    assert.strictEqual(client.createdChannels.length, 4);
    const ch4 = client.createdChannels[3];
    ch4.simulateSubscribed();
    assert.strictEqual(reconnectCount, 3);

    // Ensure auth sync called with NO manual token (preserves Supabase auto token callback)
    assert.ok(client.setAuthCalls.length >= 3);
    assert.ok(client.setAuthCalls.every((arg) => arg === undefined));

    unsub();
    await wait(50);
    assert.strictEqual(client.channels.length, 0);
    assert.ok(statuses.includes('CHANNEL_ERROR'));
    assert.ok(statuses.includes('TIMED_OUT'));
    assert.ok(statuses.includes('CLOSED'));
  });

  test('5. Offline -> Online connectivity recovery recreates unhealthy channels and preserves healthy ones', async () => {
    const client = new FakeSupabaseClient();
    const manager = new RealtimeSubscriptionManager(client, {
      retryDelaysMs: [10, 10],
      logger: { warn: () => {} },
    });

    let inboxReconnects = 0;
    const unsubInbox = manager.subscribe(
      {
        key: 'inbox:u2',
        topicPrefix: 'inbox_u2',
        bindings: [{ event: '*', schema: 'public', table: 'conversations' }],
      },
      () => {},
      { onReconnect: () => { inboxReconnects += 1; } },
    );
    const chInbox1 = client.createdChannels[0];
    chInbox1.simulateSubscribed();

    // Disable internet connectivity
    manager.setOnline(false);
    client.connected = false;
    chInbox1.simulateError('offline');

    // Subscribe to a new chat screen while offline -> deferred until online
    const unsubChat = manager.subscribe(
      {
        key: 'chat:c9',
        topicPrefix: 'conv_c9',
        bindings: [{ event: '*', schema: 'public', table: 'messages', filter: 'conversation_id=eq.c9' }],
      },
      () => {},
    );

    await wait(35);
    // No retry churn while offline and deferred chat hasn't opened yet
    assert.strictEqual(client.createdChannels.length, 1);

    // Restore internet connectivity
    manager.setOnline(true);
    assert.strictEqual(client.connectCalls, 1);
    assert.strictEqual(client.createdChannels.length, 3); // chInbox2 + chChat1

    const chInbox2 = client.createdChannels[1];
    const chChat1 = client.createdChannels[2];
    chInbox2.simulateSubscribed();
    chChat1.simulateSubscribed();

    assert.strictEqual(inboxReconnects, 1);
    assert.strictEqual(manager.getActiveSubscriptions().length, 2);

    unsubInbox();
    unsubChat();
    await wait(40);
    assert.strictEqual(client.channels.length, 0);
  });

  test('6. Background -> Foreground recovers silently dropped channels without duplicating healthy channels', async () => {
    const client = new FakeSupabaseClient();
    const manager = new RealtimeSubscriptionManager(client, { logger: { warn: () => {} } });

    let droppedReconnects = 0;
    const unsub1 = manager.subscribe(
      {
        key: 'inbox:u3',
        topicPrefix: 'inbox_u3',
        bindings: [{ event: '*', schema: 'public', table: 'conversations' }],
      },
      () => {},
      { onReconnect: () => { droppedReconnects += 1; } },
    );
    const unsub2 = manager.subscribe(
      {
        key: 'notifications:u3',
        topicPrefix: 'notifs_u3',
        bindings: [{ event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.u3' }],
      },
      () => {},
    );

    const ch1 = client.createdChannels[0];
    const ch2 = client.createdChannels[1];
    ch1.simulateSubscribed();
    ch2.simulateSubscribed();

    // Background app; OS silently kills ch1 while ch2 stays joined
    manager.setForeground(false);
    ch1.simulateSilentSocketDrop();

    // Foreground app
    manager.setForeground(true);

    // Only ch1 should be recreated; ch2 must NOT be recreated unnecessarily
    assert.strictEqual(client.createdChannels.length, 3);
    const ch1Recovered = client.createdChannels[2];
    assert.match(ch1Recovered.topic, /^realtime:inbox_u3_g\d+$/);
    ch1Recovered.simulateSubscribed();
    assert.strictEqual(droppedReconnects, 1);

    // Teardown all (e.g. sign out)
    await manager.teardownAll();
    assert.strictEqual(client.channels.length, 0);
    assert.strictEqual(manager.getActiveSubscriptions().length, 0);

    // Stale unsubscribes after teardownAll are safe no-ops
    unsub1();
    unsub2();
  });
});
