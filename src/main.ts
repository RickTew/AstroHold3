import { Game } from './game/Game'

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const game = new Game(canvas)

game.init().then(() => game.start())

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose())
}
