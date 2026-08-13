import js from '@eslint/js'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import { globalIgnores } from 'eslint/config'
import pluginVue from 'eslint-plugin-vue'
import pluginA11y from 'eslint-plugin-vuejs-accessibility'

export default defineConfigWithVueTs(
  globalIgnores(['dist/**', 'coverage/**', 'node_modules/**']),

  js.configs.recommended,
  pluginVue.configs['flat/recommended'],
  pluginA11y.configs['flat/recommended'],
  vueTsConfigs.recommended,

  {
    name: 'chalendia/node-scripts',
    files: ['scripts/**/*.mjs', '*.config.ts'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },

  {
    name: 'chalendia/rules',
    rules: {
      // Every user-facing string goes through i18n; a literal in a template is
      // a string no translator will ever see.
      'vue/no-bare-strings-in-template': 'error',
      'vue/multi-word-component-names': 'off',
    },
  },
)
