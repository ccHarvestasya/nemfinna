import { WsBase } from './WsBase.js'

export interface WsCosignature extends WsBase {
  data: {
    version: string
    signerPublicKey: string
    signature: string
    parentHash: string
  }
}
