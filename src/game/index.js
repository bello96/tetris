export * from './config'
import { hitBottomBorder, hitBottomBox } from './hit'
import { initMap, addBoxToMap } from './map'
import { render } from './render'
import { addTicker } from './ticker'
import { intervalTimer } from './utils'
import { Box } from './box'

export function startGame(map) {
    initMap(map)
    const isDownMown = intervalTimer()
    let activeBox = new Box()
    function handleTicker(n) {
        if (isDownMown(n, 1000)) {
            if (hitBottomBorder(activeBox) || hitBottomBox(activeBox, map)) {
                addBoxToMap(activeBox, map)
                activeBox = new Box()
                return
            }
            activeBox.y++
        }
        render(activeBox, map)
    }
    window.addEventListener('keydown', e => {
        if (e.code === 'ArrowDown') {
            activeBox.y++
        }
    })
    addTicker(handleTicker)
}

