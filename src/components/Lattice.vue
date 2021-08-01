<template>
  <div class="lattice"></div>
</template>

<script setup>
import { computed } from "vue";
const props = defineProps(["type"]);
const bgColorType = {
  [0]: "#DEE1E6",
  [1]: "#1488F5",
};
const bgColor = computed(() => bgColorType[props.type]);
</script>

<style scoped>
.lattice {
  width: 20px;
  height: 20px;
  background-color: v-bind(bgColor);
  margin-bottom: 0.8px;
  margin-right: 0.8px;
  border-radius: 1.5px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.1s;
}
</style>