import { WsBase } from './WsBase'

export interface WsStatus extends WsBase {
  data: {
    hash: string
    code: string
    deadline: string
  }
}
