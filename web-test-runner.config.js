import { esbuildPlugin } from '@web/dev-server-esbuild';

export default {
  files: ['test/**/*.ts'],
  nodeResolve: true,
  plugins: [esbuildPlugin({ ts: true })],
  testFramework: {
    config: {
      ui: 'tdd',
      timeout: '2000',
    },
  },
};
