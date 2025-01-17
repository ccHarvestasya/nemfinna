import { WsBase } from './WsBase.js'

export interface WsFinalizedBlock extends WsBase {
  data: {
    finalizationEpoch: number
    finalizationPoint: number
    height: string
    hash: string
  }
}
