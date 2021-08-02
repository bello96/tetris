<template>
  <i class="lattice"></i>
</template>

<script setup>
import { computed } from "vue";
const props = defineProps(["type"]);
const bgColorType = {
  [0]: "#DEE1E6",
  [1]: "#2C313C",
  [-1]: "#2C313C",
};
const bgColor = computed(() => bgColorType[props.type]);
</script>

<style scoped>
.lattice {
  width: 20px;
  height: 20px;
  background-color: v-bind(bgColor);
  margin: 0 1px 1px 0;
  border-radius: 2px;
  transition: all 0.1s;
}
</style>
