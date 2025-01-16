import { WsBase } from './WsBase'

export interface WsUnconfirmedRemoved extends WsBase {
  data: {
    meta: {
      hash: string
    }
  }
}
