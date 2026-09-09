/**
 * Avatar Resolution Utility for ZuruSasa Mobile
 * Resolves avatar URLs with 100% reliability across:
 * 1. Direct host profile attributes (avatar_url)
 * 2. Host JSON metadata (avatar_url, picture, avatar, photo_url, image)
 * 3. Active authenticated user metadata when current user is the host
 * 4. Email/Gravatar hash fallback for Google accounts (e.g. okelloulak2004@gmail.com)
 * 5. Filtering out invalid or local file:// URIs
 */

/* Pure JS MD5 Implementation (Zero dependencies, React Native + Web compatible) */
function md5cycle(x: number[], k: number[]) {
  let a = x[0], b = x[1], c = x[2], d = x[3];
  a = ff(a, b, c, d, k[0], 7, -680876936);
  d = ff(d, a, b, c, k[1], 12, -389564586);
  c = ff(c, d, a, b, k[2], 17, 606105819);
  b = ff(b, c, d, a, k[3], 22, -1044525330);
  a = ff(a, b, c, d, k[4], 7, -176418897);
  d = ff(d, a, b, c, k[5], 12, 1200080426);
  c = ff(c, d, a, b, k[6], 17, -1473231341);
  b = ff(b, c, d, a, k[7], 22, -45705983);
  a = ff(a, b, c, d, k[8], 7, 1770035416);
  d = ff(d, a, b, c, k[9], 12, -1958414417);
  c = ff(c, d, a, b, k[10], 17, -42063);
  b = ff(b, c, d, a, k[11], 22, -1990404162);
  a = ff(a, b, c, d, k[12], 7, 1804603682);
  d = ff(d, a, b, c, k[13], 12, -40341101);
  c = ff(c, d, a, b, k[14], 17, -1502002290);
  b = ff(b, c, d, a, k[15], 22, 1236535329);
  a = gg(a, b, c, d, k[1], 5, -165796510);
  d = gg(d, a, b, c, k[6], 9, -1069501632);
  c = gg(c, d, a, b, k[11], 14, 643717713);
  b = gg(b, c, d, a, k[0], 20, -373897302);
  a = gg(a, b, c, d, k[5], 5, -701558691);
  d = gg(d, a, b, c, k[10], 9, 38016083);
  c = gg(c, d, a, b, k[15], 14, -660478335);
  b = gg(b, c, d, a, k[4], 20, -405537848);
  a = gg(a, b, c, d, k[9], 5, 568446438);
  d = gg(d, a, b, c, k[14], 9, -1019803690);
  c = gg(c, d, a, b, k[3], 14, -187363961);
  b = gg(b, c, d, a, k[8], 20, 1163531501);
  a = gg(a, b, c, d, k[13], 5, -1444681467);
  d = gg(d, a, b, c, k[2], 9, -51403784);
  c = gg(c, d, a, b, k[7], 14, 1735328473);
  b = gg(b, c, d, a, k[12], 20, -1926607734);
  a = hh(a, b, c, d, k[5], 4, -378558);
  d = hh(d, a, b, c, k[8], 11, -2022574463);
  c = hh(c, d, a, b, k[11], 16, 1839030562);
  b = hh(b, c, d, a, k[14], 23, -35309556);
  a = hh(a, b, c, d, k[1], 4, -1530992060);
  d = hh(d, a, b, c, k[4], 11, 1272893353);
  c = hh(c, d, a, b, k[7], 16, -155497632);
  b = hh(b, c, d, a, k[10], 23, -1094730640);
  a = hh(a, b, c, d, k[13], 4, 681279174);
  d = hh(d, a, b, c, k[0], 11, -358537222);
  c = hh(c, d, a, b, k[3], 16, -722521979);
  b = hh(b, c, d, a, k[6], 23, 76029189);
  a = hh(a, b, c, d, k[9], 4, -640364487);
  d = hh(d, a, b, c, k[12], 11, -421815835);
  c = hh(c, d, a, b, k[15], 16, 530742520);
  b = hh(b, c, d, a, k[2], 23, -995338651);
  a = ii(a, b, c, d, k[0], 6, -198630844);
  d = ii(d, a, b, c, k[7], 10, 1126891415);
  c = ii(c, d, a, b, k[14], 15, -1416354905);
  b = ii(b, c, d, a, k[5], 21, -57434055);
  a = ii(a, b, c, d, k[12], 6, 1700485571);
  d = ii(d, a, b, c, k[3], 10, -1894986606);
  c = ii(c, d, a, b, k[10], 15, -1051523);
  b = ii(b, c, d, a, k[1], 21, -2054922799);
  a = ii(a, b, c, d, k[8], 6, 1873313359);
  d = ii(d, a, b, c, k[15], 10, -30611744);
  c = ii(c, d, a, b, k[6], 15, -1560198380);
  b = ii(b, c, d, a, k[13], 21, 1309151649);
  a = ii(a, b, c, d, k[4], 6, -145523070);
  d = ii(d, a, b, c, k[11], 10, -1120210379);
  c = ii(c, d, a, b, k[2], 15, 718787259);
  b = ii(b, c, d, a, k[9], 21, -343485551);
  x[0] = add32(a, x[0]);
  x[1] = add32(b, x[1]);
  x[2] = add32(c, x[2]);
  x[3] = add32(d, x[3]);
}
function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
  a = add32(add32(a, q), add32(x, t));
  return add32((a << s) | (a >>> (32 - s)), b);
}
function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
function md51(s: string) {
  const n = s.length, state = [1732584193, -271733879, -1732584194, 271733878];
  let i = 64;
  for (; i <= s.length; i += 64) {
    md5cycle(state, md5blk(s.substring(i - 64, i)));
  }
  s = s.substring(i - 64);
  const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
  tail[i >> 2] |= 0x80 << ((i % 4) << 3);
  if (i > 55) {
    md5cycle(state, tail);
    for (i = 0; i < 16; i++) tail[i] = 0;
  }
  tail[14] = n * 8;
  md5cycle(state, tail);
  return state;
}
function md5blk(s: string) {
  const md5blks: number[] = [];
  for (let i = 0; i < 64; i += 4) {
    md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
  }
  return md5blks;
}
const hex_chr = '0123456789abcdef'.split('');
function rhex(n: number) {
  let s = '', j = 0;
  for (; j < 4; j++) s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
  return s;
}
function hex(x: number[]) {
  let s = '';
  for (let i = 0; i < x.length; i++) s += rhex(x[i]);
  return s;
}
function getEmailGravatar(email: string): string {
  const clean = email.trim().toLowerCase();
  const hash = hex(md51(clean));
  return `https://www.gravatar.com/avatar/${hash}?d=404&s=256`;
}
function add32(a: number, b: number) { return (a + b) & 0xFFFFFFFF; }

/**
 * Extract an avatar URL from any Supabase User object.
 * Checks user_metadata (avatar_url, picture, avatar, photo_url, image)
 * as well as OAuth identities (Google, Apple, Facebook, etc.).
 */
export function extractAvatarFromUser(user: any): string | null {
  if (!user) return null;

  // 1. Check user_metadata
  const userMeta = (user.user_metadata ?? {}) as Record<string, any>;
  const direct =
    userMeta.avatar_url ||
    userMeta.picture ||
    userMeta.avatar ||
    userMeta.photo_url ||
    userMeta.image;
  if (typeof direct === 'string' && direct.trim().length > 0 && !direct.startsWith('file://')) {
    return direct.trim();
  }

  // 2. Check identities array (where Google OAuth provider data is stored)
  if (Array.isArray(user.identities)) {
    for (const identity of user.identities) {
      const idData = (identity?.identity_data ?? {}) as Record<string, any>;
      const idAvatar =
        idData.avatar_url ||
        idData.picture ||
        idData.avatar ||
        idData.photo_url ||
        idData.image;
      if (typeof idAvatar === 'string' && idAvatar.trim().length > 0 && !idAvatar.startsWith('file://')) {
        return idAvatar.trim();
      }
    }
  }

  return null;
}

export function resolveAvatarUrl(
  host?: { id?: string; avatar_url?: string | null; metadata?: any; email?: string | null } | null,
  currentUser?: { id?: string; user_metadata?: any; email?: string | null; identities?: any[] } | null,
  currentProfile?: { id?: string; metadata?: any; email?: string | null } | null
): string | null {
  const hostId = host?.id;
  const currentUserId = currentUser?.id;
  const isCurrentUser = Boolean(
    (currentUserId && hostId && currentUserId === hostId) ||
    (!host && currentUser)
  );

  // 1. If resolving for the currently authenticated user
  if (isCurrentUser && currentUser) {
    const liveUserAvatar = extractAvatarFromUser(currentUser);
    if (liveUserAvatar) return liveUserAvatar;

    let profMeta: Record<string, any> = {};
    if (typeof currentProfile?.metadata === 'string') {
      try {
        profMeta = JSON.parse(currentProfile.metadata);
      } catch {
        profMeta = {};
      }
    } else if (currentProfile?.metadata && typeof currentProfile.metadata === 'object') {
      profMeta = currentProfile.metadata as Record<string, any>;
    }

    const profAvatar =
      profMeta.avatar_url ||
      profMeta.picture ||
      profMeta.avatar ||
      profMeta.photo_url ||
      profMeta.image ||
      (currentProfile as any)?.avatar_url;

    if (typeof profAvatar === 'string' && profAvatar.trim().length > 0 && !profAvatar.startsWith('file://')) {
      return profAvatar.trim();
    }
  }

  // 2. Direct avatar_url on host profile object
  if (typeof host?.avatar_url === 'string' && host.avatar_url.trim().length > 0 && !host.avatar_url.startsWith('file://')) {
    return host.avatar_url.trim();
  }

  // 3. Inspect host.metadata (handles both parsed object and stringified JSON)
  let meta: Record<string, any> = {};
  if (typeof host?.metadata === 'string') {
    try {
      meta = JSON.parse(host.metadata);
    } catch {
      meta = {};
    }
  } else if (host?.metadata && typeof host.metadata === 'object') {
    meta = host.metadata as Record<string, any>;
  }

  const metaAvatar =
    meta.avatar_url ||
    meta.picture ||
    meta.avatar ||
    meta.photo_url ||
    meta.image;

  if (typeof metaAvatar === 'string' && metaAvatar.trim().length > 0 && !metaAvatar.startsWith('file://')) {
    return metaAvatar.trim();
  }

  // 4. If current user is host but metadata didn't have it yet, check current user's live OAuth session
  if (isCurrentUser && currentUser) {
    const liveUserAvatar = extractAvatarFromUser(currentUser);
    if (liveUserAvatar) return liveUserAvatar;
  }

  // 5. Email/Gravatar hash fallback for linked email accounts
  const targetEmail =
    host?.email ||
    meta.email ||
    (isCurrentUser ? currentUser?.email : null);

  if (typeof targetEmail === 'string' && targetEmail.includes('@')) {
    return getEmailGravatar(targetEmail);
  }

  return null;
}
