export * from './config'
import { hitBottomBorder, hitBottomBox } from './hit'
import { initMap, addBoxToMap,eliminate } from './map'
import { render } from './render'
import { addTicker } from './ticker'
import { intervalTimer } from './utils'
import { createBox } from './box'

export function startGame(map) {
    initMap(map)
    const isDownMown = intervalTimer()
    let activeBox = createBox()
    function handleTicker(n) {
        if (isDownMown(n, 1000)) {
            if (hitBottomBorder(activeBox) || hitBottomBox(activeBox, map)) {
                addBoxToMap(activeBox, map)
                eliminate(map)
                activeBox = createBox()
                return
            }
            activeBox.y++
        }
        render(activeBox, map)
    }
    window.addEventListener('keydown', e => {
        switch (e.code) {
            case 'ArrowLeft':
                activeBox.x--
                break;
            case 'ArrowRight':
                activeBox.x++
                break;
            case 'ArrowDown':
                activeBox.y++
                break;
        }
    })
    addTicker(handleTicker)
}

