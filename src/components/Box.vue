<template>
  <div class="box"></div>
</template>

<script setup>
import { computed } from "vue";
const props = defineProps(["type"]);
const typeColor = {
  [0]: "#dee1e6",
  [1]: "pink",
};
const color = computed(() => typeColor[props.type]);
</script>

<style scoped>
.box {
  width: 20px;
  height: 20px;
  background-color: v-bind(color);
  margin-bottom: 0.8px;
  margin-right: 0.8px;
  border-radius: 1px;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>