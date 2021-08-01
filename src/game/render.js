import { gameRow, gameCol } from './config'
// 方块渲染
export function render(box, map) {
    // 把之前的清理掉
    reset(map)
    _render(box, map)
}

function _render(box, map) {
    const row = box.shape.length;
    const col = box.shape[0].length;
    for (let i = 0; i < row; i++) {
        for (let j = 0; j < col; j++) {
            const x = box.x + j;
            const y = box.y + i;
            map[y][x] = box.shape[i][j]
        }
    }
}

function reset(map) {
    for (let i = 0; i < gameRow; i++) {
        map[i] = []
        for (let j = 0; j < gameCol; j++) {
            // if (map[i][j] > 0) {
            map[i][j] = 0
            // }
        }
    }
}