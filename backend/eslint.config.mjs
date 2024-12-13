// @ts-check

import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended, {
        ignores: [
            'node_modules',
            '.dist',
            'ws.ts'
        ],
    },
    prettierConfig, {
        rules: {
            indent: "error",
        },
    },
);