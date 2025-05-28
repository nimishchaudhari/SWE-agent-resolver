module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // Add custom rules here
    'no-unused-vars': 'off', // Prefer @typescript-eslint/no-unused-vars
    '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    // Add other rules as needed
  },
  env: {
    node: true,
    es2021: true,
    jest: true, // if using jest
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
};
