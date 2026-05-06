import { Config, UnitType } from '../game/GameConfig'

const ALL_TYPES: UnitType[] = ['scout', 'tank', 'bomber', 'drone']

export class AIPlayer {
  static buildArmy(credits: number): UnitType[] {
    const army: UnitType[] = []
    let remaining = credits

    while (remaining > 0) {
      const affordable = ALL_TYPES.filter(t => Config.UNITS[t].cost <= remaining)
      if (!affordable.length) break
      const pick = affordable[Math.floor(Math.random() * affordable.length)]
      army.push(pick)
      remaining -= Config.UNITS[pick].cost
    }

    return army
  }
}
