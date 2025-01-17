import { WsBase } from './WsBase.js'

export interface WsUnconfirmedRemoved extends WsBase {
  data: {
    meta: {
      hash: string
    }
  }
}
