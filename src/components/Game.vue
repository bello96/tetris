<template>
  <div>
    <span class="row" v-for="(row, rIndex) in gameRow" :key="rIndex">
      <template v-for="(col, cIndex) in gameCol" :key="cIndex">
        <Lattice :type="map[rIndex][cIndex]"></Lattice>
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
