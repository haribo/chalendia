import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { initTheme } from './composables/useTheme'
import { i18n } from './i18n'
import { createAppRouter } from './router'
import './styles/tokens.css'
import './styles/base.css'

// Before the first paint: applying the stored theme afterwards shows the wrong
// one for a frame.
initTheme()
document.documentElement.setAttribute('lang', i18n.global.locale.value)

createApp(App)
  // Pinia first: the router guard reads the session store on every navigation.
  .use(createPinia())
  .use(i18n)
  .use(createAppRouter())
  .mount('#app')
