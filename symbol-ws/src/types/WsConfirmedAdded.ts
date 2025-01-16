import { WsBase } from './WsBase'

export interface WsConfirmedAdded extends WsBase {
  data: {
    transaction: {
      signature: string
      signerPublicKey: string
      version: number
      network: number
      type: number
      maxFee: string
      deadline: string
      recipientAddress: string
      mosaics: { id: string; amount: string }[]
      message: '00476F6F64204C75636B21'
    }
    meta: {
      hash: string
      merkleComponentHash: string
      height: string
    }
  }
}
