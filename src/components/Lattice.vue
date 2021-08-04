<template>
  <i class="lattice"></i>
</template>

<script setup>
import { computed } from "vue";
import { mapColor, blockColor, blockSize } from "./../game/config";
const props = defineProps(["type"]);
const bgColorType = {
  [0]: mapColor,
  [1]: blockColor,
  [-1]: blockColor,
};
const bgColor = computed(() => bgColorType[props.type]);
const bSize = computed(() => `${blockSize}px`);
</script>

<style scoped>
.lattice {
  width: v-bind(bSize);
  height: v-bind(bSize);
  background-color: v-bind(bgColor);
  margin: 0 1px 1px 0;
  border-radius: 2px;
  transition: all 0.1s;
}
</style>
