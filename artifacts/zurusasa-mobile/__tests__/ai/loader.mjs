import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import babel from '@babel/core';

const RN_MOCK_PATH = path.resolve(process.cwd(), '__tests__/ai/rn_mock.cjs');
const RN_MOCK_MJS_PATH = path.resolve(process.cwd(), '__tests__/ai/rn_mock.mjs');

// Provide global Deno mock if not present
if (typeof globalThis.Deno === 'undefined') {
  globalThis.Deno = {
    env: {
      get: (k) => process.env[k] || '',
      set: (k, v) => { process.env[k] = v; },
    },
    serve: () => {},
  };
}

const REDIRECTS = new Set([
  'react-native',
  'react-native/index.js',
  '@gorhom/bottom-sheet',
  'react-native-safe-area-context',
  'react-native-reanimated',
  '@expo/vector-icons',
  'expo-image',
  'expo-location',
  '@/components/map/SafeMapView',
]);

const MOCKS = {
  'react-native-url-polyfill/auto': `export default {};`,
  '@react-native-community/netinfo': `
    export const addEventListener = () => () => {};
    export const fetch = async () => ({ isConnected: true, isInternetReachable: true });
    export default { addEventListener, fetch };
  `,
  '@react-native-async-storage/async-storage': `
    const mem = new Map();
    export const getItem = async (k) => mem.get(k) ?? null;
    export const setItem = async (k, v) => { mem.set(k, String(v)); };
    export const removeItem = async (k) => { mem.delete(k); };
    export const clear = async () => { mem.clear(); };
    export default { getItem, setItem, removeItem, clear };
  `,
  'https://esm.sh/@supabase/supabase-js@2': `
    function createChain() {
      const chain = {
        select: () => chain,
        insert: () => chain,
        update: () => chain,
        upsert: () => chain,
        delete: () => chain,
        in: () => chain,
        not: () => chain,
        eq: () => chain,
        neq: () => chain,
        gte: () => chain,
        lte: () => chain,
        ilike: () => chain,
        or: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        then: (resolve) => resolve({ data: [], error: null }),
      };
      return chain;
    }
    export const createClient = () => ({
      from: () => createChain(),
      auth: {
        getUser: async () => ({ data: { user: null } }),
        getSession: async () => ({ data: { session: null } }),
      },
    });
  `,
  '@/lib/supabase': `
    function createChain() {
      const chain = {
        select: () => chain,
        insert: () => chain,
        update: () => chain,
        upsert: () => chain,
        delete: () => chain,
        in: () => chain,
        not: () => chain,
        eq: () => chain,
        neq: () => chain,
        gte: () => chain,
        lte: () => chain,
        ilike: () => chain,
        or: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        then: (resolve) => resolve({ data: [], error: null }),
      };
      return chain;
    }
    export const supabase = {
      from: () => createChain(),
      auth: {
        getUser: async () => ({ data: { user: null } }),
        getSession: async () => ({ data: { session: null } }),
      },
    };
    export default { supabase };
  `,
};

export async function resolve(specifier, context, nextResolve) {
  if (REDIRECTS.has(specifier)) {
    return {
      format: 'module',
      shortCircuit: true,
      url: pathToFileURL(RN_MOCK_MJS_PATH).href,
    };
  }
  if (MOCKS[specifier]) {
    return {
      format: 'module',
      shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent(MOCKS[specifier])}`,
    };
  }
  if (specifier.includes('rateLimiter')) {
    return {
      format: 'module',
      shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent('export const checkRateLimit = async () => ({ allowed: true });')}`,
    };
  }
  if (specifier.startsWith('https://')) {
    return {
      format: 'module',
      shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent('export default {};')}`,
    };
  }
  if (specifier.startsWith('@/')) {
    const relative = specifier.slice(2);
    const basePath = path.resolve(process.cwd(), relative);
    const candidates = [
      basePath,
      basePath + '.ts',
      basePath + '.tsx',
      basePath + '.js',
      path.join(basePath, 'index.ts'),
      path.join(basePath, 'index.tsx'),
      path.join(basePath, 'index.js'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c) && !fs.statSync(c).isDirectory()) {
        return nextResolve(pathToFileURL(c).href, context);
      }
    }
    return nextResolve(pathToFileURL(basePath + '.ts').href, context);
  }
  if (specifier.startsWith('.') && context.parentURL && context.parentURL.startsWith('file:')) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const basePath = path.resolve(parentDir, specifier);
    const candidates = [
      basePath,
      basePath + '.ts',
      basePath + '.tsx',
      basePath + '.js',
      path.join(basePath, 'index.ts'),
      path.join(basePath, 'index.tsx'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c) && !fs.statSync(c).isDirectory()) {
        return nextResolve(pathToFileURL(c).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.tsx')) {
    const filePath = fileURLToPath(url);
    const code = fs.readFileSync(filePath, 'utf8');
    const res = babel.transformSync(code, {
      filename: filePath,
      presets: ['babel-preset-expo'],
    });

    const normalizedMockPath = RN_MOCK_PATH.replace(/\\/g, '/');
    let transformed = (res?.code || '')
      .replace(/require\(['"]react-native['"]\)/g, `require('${normalizedMockPath}')`)
      .replace(/require\(['"]@gorhom\/bottom-sheet['"]\)/g, `require('${normalizedMockPath}')`)
      .replace(/require\(['"]react-native-safe-area-context['"]\)/g, `require('${normalizedMockPath}')`)
      .replace(/require\(['"]react-native-reanimated['"]\)/g, `require('${normalizedMockPath}')`)
      .replace(/require\(['"]@expo\/vector-icons['"]\)/g, `require('${normalizedMockPath}')`)
      .replace(/require\(['"]expo-image['"]\)/g, `require('${normalizedMockPath}')`)
      .replace(/require\(['"]expo-location['"]\)/g, `require('${normalizedMockPath}')`)
      .replace(/require\(['"]@\/components\/map\/SafeMapView['"]\)/g, `require('${normalizedMockPath}')`);

    // Rewrite require('@/...') to absolute paths with .ts extension
    transformed = transformed.replace(/require\(['"]@\/([^'"]+)['"]\)/g, (match, rel) => {
      const full = path.resolve(process.cwd(), rel).replace(/\\/g, '/');
      const candidates = [full, full + '.ts', full + '.tsx', full + '.js'];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          return `require('${c}')`;
        }
      }
      return `require('${full}.ts')`;
    });

    return {
      format: 'commonjs',
      shortCircuit: true,
      source: transformed,
    };
  }
  return nextLoad(url, context);
}
