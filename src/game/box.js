export class Box {
  constructor() {
    this.x = 0
    this.y = 0
    this.shape = [
      [0,0,0, 1],
      [1, 1,1,1]
    ]
  }
}

const boxInfors = {
  1: {
    shape: [
      [1, 1],
      [1,1]
    ]
  },
  2: {
    shape: [
      [0, 1, 1],
      [0, 1, 0],
      [1, 1, 0]
    ]
  },
  3: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0]
    ]
  }
}

export function createBox() {
  let box = new Box()
  const {shape} = getRandomBoxInfo()
  box.shape = shape
  return box
}

function getRandomBoxInfo() {
  const max = Object.keys(boxInfors).length
  const key = Math.floor(Math.random() * max) + 1
  return boxInfors[key]
}