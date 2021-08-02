let startTime = Date.now()
function handleTicker() {
    tickers.forEach(ticker => {
        ticker(Date.now() - startTime)
    })
    startTime = Date.now()
    requestAnimationFrame(handleTicker)
}
requestAnimationFrame(handleTicker)
const tickers = []
export function addTicker(ticker) {
    tickers.push(ticker)
}
