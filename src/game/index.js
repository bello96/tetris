export * from './config'
import { hitBottomBorder, hitBottomBox } from './hit'
import { initMap, addBoxToMap, eliminate } from './map'
import { render } from './render'
import { addTicker } from './ticker'
import { intervalTimer } from './utils'
import { createBox } from './box'
import { speed, gameRow, gameCol } from './config'

let _map = null;
export function initGame(map) {
    initMap(map),
    _map = map
}

export function startGame() {
    const isDownMown = intervalTimer()
    let activeBox = createBox()
    function handleTicker(n) {
        if (isDownMown(n, speed)) {
            if (hitBottomBorder(activeBox) || hitBottomBox(activeBox, _map)) {
                addBoxToMap(activeBox, _map)
                eliminate(_map)
                activeBox = createBox()
                return
            }
            activeBox.y++
        }
        render(activeBox, _map)
    }
    window.addEventListener('keydown', e => {
        switch (e.code) {
            case 'ArrowLeft':
                if (activeBox.x <= 0) return;
                activeBox.x--
                break;
            case 'ArrowRight':
                if (activeBox.x >= gameCol - activeBox.shape[0].length) return;
                activeBox.x++
                break;
            case 'ArrowDown':
                if (activeBox.y >= gameRow - activeBox.shape.length) return;
                activeBox.y++
                break;
            case 'Space':
                activeBox.rotate()
                break;
        }
    })
    addTicker(handleTicker)
}

