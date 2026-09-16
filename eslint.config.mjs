// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  // Les fichiers de test manipulent des mocks Jest, qui sont `any` par
  // construction : jest.fn() ne peut pas etre type sans annoter chaque mock a
  // la main. Les regles no-unsafe-* y produisent donc du bruit, pas du signal.
  // Elles restent ACTIVES sur src/ — contrairement a MS-User et MS-Auth, qui
  // les desactivent partout ou ne lintent pas leurs tests du tout.
  // unbound-method se declenche sur `expect(mock.method)`, qui est l'usage
  // normal de Jest. require-await vise des helpers de test async sans await.
  {
    files: ['**/*.spec.ts', '**/*-spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
);
