export * from './config'
import { initMap } from './map'
import { render } from './render'
import { addTicker } from './ticker'
import { intervalTimer } from './utils'

export function startGame(map) {
    initMap(map)
    const box = {
        x: 0,
        y: 0,
        shape: [
            [1, 1],
            [1, 1],
        ]
    }


    const isDownMown = intervalTimer()
    function handleTicker(n) {
        if (isDownMown(n, 1000)) {
            box.y++
        }
        render(box, map)
    }

    window.addEventListener('keydown', e => {
        if (e.code === 'ArrowDown') {
            box.y++
        }
    })
    addTicker(handleTicker)
}

