declare module 'node:test' {
  const test: any;
  export { test };
  export default test;
  export const describe: any;
  export const it: any;
  export const before: any;
  export const after: any;
  export const beforeEach: any;
  export const afterEach: any;
}

declare module 'node:assert' {
  const assert: any;
  export default assert;
}

declare module 'node:fs' {
  const fs: any;
  export default fs;
}

declare module 'node:path' {
  const path: any;
  export default path;
}
