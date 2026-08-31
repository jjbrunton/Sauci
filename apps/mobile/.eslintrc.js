// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*'],
  rules: {
    // eslint-config-expo (SDK 56) pulls eslint-plugin-react-hooks v7, whose
    // recommended config adds React Compiler era rules as errors. Existing
    // patterns this codebase relies on deliberately (the "latest value" ref
    // pattern, effect-driven setState, dynamically created inline
    // components, and manual memoization) trip these new rules throughout
    // the app. Adopting the stricter rules is a deliberate follow-up
    // refactor, not an SDK upgrade side effect, so they are downgraded to
    // warnings here.
    'react-hooks/refs': 'warn',
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/immutability': 'warn',
    'react-hooks/preserve-manual-memoization': 'warn',
    'react-hooks/static-components': 'warn',
  },
  overrides: [
    {
      files: ['plugins/**/*.js'],
      env: { node: true },
    },
  ],
};
