/// <reference lib="dom" />

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}

declare module 'https://esm.sh/*' {
  const content: any;
  export default content;
  export const createClient: any;
}

declare module 'https://*' {
  const content: any;
  export default content;
  export const createClient: any;
}

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    has(key: string): boolean;
  }

  export const env: Env;

  export function serve(
    handler: (request: Request) => Promise<Response> | Response
  ): void;

  export function serve(
    options: { port?: number; hostname?: string; onListen?: (params: { hostname: string; port: number }) => void },
    handler: (request: Request) => Promise<Response> | Response
  ): void;
}
