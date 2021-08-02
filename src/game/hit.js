import { gameRow } from './config'
import { getBoxBottomPoints } from './matrix'
export function hitBorder({ box, points, offsetY=1 }) {
    for (let i = 0; i < points.length; i++) {
        const point = points[i]
        const y = point.y + box.y + offsetY
        if (y >= gameRow) {
            return true
        }
    }
    return false
}

export function hitBottomBorder(box) {
    const points = getBoxBottomPoints(box.shape)
    return hitBorder({ box, points, offsetY:1 })
}

export function hitBox({ box, map, offsetY, points }) {
    for (let i = 0; i < points.length; i++){
        const point = points[i]
        const y = point.y + box.y+offsetY
        const x = point.x + box.x
        
        if (map[y][x]<0) {
            return true
        }
    }
  return false  
}

export function hitBottomBox(box, map) {
    const points = getBoxBottomPoints(box.shape)
    return hitBox({box,map,points,offsetY:1})
}