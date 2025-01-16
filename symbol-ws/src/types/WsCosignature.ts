import { WsBase } from './WsBase'

export interface WsCosignature extends WsBase {
  data: {
    version: string
    signerPublicKey: string
    signature: string
    parentHash: string
  }
}
