export function getBoxBottomPoints(matrix, initPoint) {
    const row = matrix.length;
    const col = matrix[0].length
    const points = []
    for (let j = 0; j < col; j++) {
        const x = j
        const y = row - 1 + initPoint.y
        points.push({ x, y })
    }
    return points
}