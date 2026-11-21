import { before, describe, test } from 'node:test';
import assert from 'node:assert';
import type * as InboxFormattersModule from '@/components/inbox/inboxFormatters';

let formatConversationPreview: typeof InboxFormattersModule.formatConversationPreview;
let formatConversationTime: typeof InboxFormattersModule.formatConversationTime;

before(async () => {
  const mod = (await import(
    '../../components/inbox/inboxFormatters.ts' as any
  )) as typeof InboxFormattersModule;
  formatConversationPreview = mod.formatConversationPreview;
  formatConversationTime = mod.formatConversationTime;
});

describe('Inbox conversation formatters', () => {
  test('formats incoming text preview and collapses newlines/whitespace', () => {
    const preview = formatConversationPreview(
      {
        content: '  Hi there!\n  Is check-in available at 2pm?  ',
        sender_id: 'host-1',
        created_at: '2026-11-21T10:00:00.000Z',
        is_image: false,
      },
      'guest-1',
    );
    assert.strictEqual(preview, 'Hi there! Is check-in available at 2pm?');
  });

  test('prefixes own text message with "You: "', () => {
    const preview = formatConversationPreview(
      {
        content: 'Sounds great, see you then!',
        sender_id: 'guest-1',
        created_at: '2026-11-21T10:00:00.000Z',
        is_image: false,
      },
      'guest-1',
    );
    assert.strictEqual(preview, 'You: Sounds great, see you then!');
  });

  test('formats photo messages for both incoming and own messages', () => {
    assert.strictEqual(
      formatConversationPreview(
        {
          content: 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg',
          sender_id: 'host-1',
          created_at: '2026-11-21T10:00:00.000Z',
          is_image: true,
        },
        'guest-1',
      ),
      'Photo',
    );
    assert.strictEqual(
      formatConversationPreview(
        {
          content: 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg',
          sender_id: 'guest-1',
          created_at: '2026-11-21T10:00:00.000Z',
          is_image: true,
        },
        'guest-1',
      ),
      'You: Photo',
    );
  });

  test('handles empty conversation and blank content fallbacks', () => {
    assert.strictEqual(formatConversationPreview(null, 'guest-1'), 'No messages yet');
    assert.strictEqual(formatConversationPreview(undefined, 'guest-1'), 'No messages yet');
    assert.strictEqual(
      formatConversationPreview(
        {
          content: '   ',
          sender_id: 'host-1',
          created_at: '2026-11-21T10:00:00.000Z',
          is_image: false,
        },
        'guest-1',
      ),
      'Message',
    );
  });

  test('formats relative conversation timestamps cleanly', () => {
    const now = new Date('2026-11-21T12:00:00.000Z').getTime();
    assert.strictEqual(formatConversationTime(null, now), '');
    assert.strictEqual(formatConversationTime('not-a-date', now), '');
    assert.strictEqual(formatConversationTime('2026-11-21T11:59:40.000Z', now), 'now');
    assert.strictEqual(formatConversationTime('2026-11-21T11:45:00.000Z', now), '15m');
    assert.strictEqual(formatConversationTime('2026-11-21T09:00:00.000Z', now), '3h');
    assert.strictEqual(formatConversationTime('2026-11-18T12:00:00.000Z', now), '3d');
    assert.strictEqual(formatConversationTime('2026-11-05T12:00:00.000Z', now), '5/11');
  });
});
