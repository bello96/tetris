<template>
  <div class="btns">
    <button @click="startTetris">开始</button>
    <button @click="resetTetris">重置</button>
  </div>
  <Game />
</template>

<script setup>
import Game from "./components/Game.vue";
import { startGame } from "./game";
function startTetris() {
  startGame();
}
function resetTetris() {
  location.reload();
}
</script>

<style>
#app {
  margin: 0 auto;
  width: 600px;
}
.btns {
  width: 100%;
  margin-bottom: 10px;
}
.btns button {
  margin-right: 10px;
}
</style>
