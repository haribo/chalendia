<template>
  <!-- The frame every surface hangs from: a bar, a body taking the remaining
       height, an optional footer. It places its children and paints nothing. -->
  <div class="shell">
    <slot name="bar" />
    <div class="body">
      <slot />
    </div>
    <slot name="footer" />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.body {
  display: flex;
  flex: 1;
  flex-direction: column;
}
</style>
