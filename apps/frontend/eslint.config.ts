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
    // Surfaces compose shared components; they do not rebuild affordances.
    // See docs/frontend/adr/0003-shared-components-and-surfaces.md.
    name: 'chalendia/surfaces-compose',
    files: ['src/surfaces/**/*.vue'],
    rules: {
      'vue/no-restricted-html-elements': [
        'error',
        {
          element: 'select',
          message: 'Use SelectField from shared/ui — see frontend ADR 0003.',
        },
        {
          element: 'button',
          message: 'Add a shared Button to shared/ui rather than a local one — see frontend ADR 0003.',
        },
        {
          element: 'input',
          message: 'Add a shared field to shared/ui rather than a local one — see frontend ADR 0003.',
        },
        {
          element: 'textarea',
          message: 'Add a shared field to shared/ui rather than a local one — see frontend ADR 0003.',
        },
        {
          element: 'dialog',
          message: 'Add a shared dialog to shared/ui rather than a local one — see frontend ADR 0003.',
        },
      ],

      // A ban reading tag names alone waves through the hand-rolled equivalent:
      // `<div role="button" tabindex="0" @click @keydown.enter>` satisfies every
      // accessibility rule and still bypasses the design system.
      'vue/no-restricted-static-attribute': [
        'error',
        ...['button', 'dialog', 'checkbox', 'radio', 'menu', 'menuitem', 'tab'].map((role) => ({
          key: 'role',
          value: role,
          message: `Use the shared component for this affordance rather than role="${role}" — see frontend ADR 0003.`,
        })),
        {
          key: 'contenteditable',
          message: 'Add a shared editor to shared/ui rather than a local one — see frontend ADR 0003.',
        },
      ],
    },
  },

  {
    // Every call goes through the generated client, which is the only thing
    // making a backend rename visible at build time. See backend ADR 0002.
    name: 'chalendia/typed-api-only',
    files: ['src/**/*.ts', 'src/**/*.vue'],
    ignores: ['src/shared/api/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Use the typed client from shared/api — see backend ADR 0002.',
        },
        {
          name: 'XMLHttpRequest',
          message: 'Use the typed client from shared/api — see backend ADR 0002.',
        },
      ],
    },
  },

  {
    name: 'chalendia/rules',
    rules: {
      // The plugin's default demands the control be *both* nested in its label
      // and associated by id. A floating label is drawn over the field, so it
      // cannot wrap the control — and `for`/`id` is a complete association on
      // its own. Requiring one of the two keeps the guarantee without banning
      // the pattern.
      'vuejs-accessibility/label-has-for': [
        'error',
        { required: { some: ['nesting', 'id'] } },
      ],
      // Every user-facing string goes through i18n; a literal in a template is
      // a string no translator will ever see.
      'vue/no-bare-strings-in-template': 'error',
      'vue/multi-word-component-names': 'off',
    },
  },

  {
    // The gallery never reaches a user: it is compiled out of the production
    // build, and its readers are the people who build the screens.
    // Translating it would put eighty keys nobody reads into the resources a
    // translator works through — the cost of the rule without its benefit.
    name: 'chalendia/gallery-speaks-to-us',
    files: ['src/surfaces/dev/**/*.vue'],
    rules: {
      'vue/no-bare-strings-in-template': 'off',
    },
  },
)
