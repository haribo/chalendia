<template>
  <h1 class="title">
    <slot />
  </h1>
</template>

<style scoped>
.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 600;
  text-wrap: balance;
}
</style>
