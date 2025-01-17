import { WsBase } from './WsBase.js'

export interface WsStatus extends WsBase {
  data: {
    hash: string
    code: string
    deadline: string
  }
}
