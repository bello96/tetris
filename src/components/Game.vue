<template>
  <div>
    <span class="row" v-for="i in gameRow" :key="i">
      <template v-for="j in gameCol" :key="j">
        <Lattice :type="map[i - 1][j - 1]" />
      </template>
    </span>
  </div>
</template>

<script setup>
import { reactive } from "vue";
import Lattice from "./Lattice.vue";
import { gameRow, gameCol, initGame } from "./../game";
const map = reactive([]);
initGame(map);
</script>

<style scoped>
.row {
  display: flex;
}
</style>
