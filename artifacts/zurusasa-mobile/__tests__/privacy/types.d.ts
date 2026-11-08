declare module 'node:crypto' {
  const crypto: any;
  export default crypto;
  export const randomBytes: any;
  export const randomUUID: any;
  export const createHash: any;
  export const timingSafeEqual: any;
}

declare const Buffer: any;
