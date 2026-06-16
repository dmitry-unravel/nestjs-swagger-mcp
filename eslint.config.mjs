// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'generated', 'dist', 'node_modules', 'test', 'src/shopify/graphql/types'],
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
    plugins: {
      import: importPlugin,
    },

    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: {
          extensions: ['.ts', '.js', '.mjs'],
        },
      },
    },

    rules: {
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 170, skipBlankLines: true, skipComments: true, IIFEs: true }],
      'max-params': ['error', { max: 8,  }],
      'complexity': ['warn', { max: 20 }],
      'max-depth': ['warn', { max: 4 }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unused-vars': 'error',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
      'import/no-unresolved': ['warn', { commonjs: true, amd: true }],
      'import/newline-after-import': ['error', { count: 1 }],
      'import/named': 'warn',
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        },
      ],
    },
  },
  {
    files: ["**/*.ts"],
    rules: {
      "import/extensions": ["error", "never"]
    }
  },
  {
    files: ["**/*.spec.ts", "**/*.e2e-spec.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
    }
  }
);