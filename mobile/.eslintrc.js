module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    // ---- Layer-boundary enforcement (IMPLEMENTATION-PLAN §3) ----
    // Dependency direction is strictly downward:
    //   config/types  <  storage  <  {capture, sync}  <  ui
    // capture ⟂ sync: they never import each other, only meet via storage.
    // A violating import fails lint, not just code review.
    {
      files: ['src/config/**', 'src/types/**'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [{
            group: ['**/storage/**', '**/capture/**', '**/sync/**', '**/ui/**'],
            message: 'config/types are leaves — they must not import from any layer.',
          }],
        }],
      },
    },
    {
      files: ['src/storage/**'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [{
            group: ['**/capture/**', '**/sync/**', '**/ui/**'],
            message: 'storage must not import upward (capture/sync/ui).',
          }],
        }],
      },
    },
    {
      files: ['src/capture/**'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [{
            group: ['**/sync/**', '**/ui/**'],
            message: 'capture must not import sync (⟂) or ui.',
          }],
        }],
      },
    },
    {
      files: ['src/sync/**'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [{
            group: ['**/capture/**', '**/ui/**'],
            message: 'sync must not import capture (⟂) or ui.',
          }],
        }],
      },
    },
  ],
};
