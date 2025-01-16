import { WsBase } from './WsBase.js'

export interface WsBlock extends WsBase {
  data: {
    block: {
      signature: string
      signerPublicKey: string
      version: number
      network: number
      type: number
      height: string
      timestamp: string
      difficulty: string
      proofGamma: string
      proofVerificationHash: string
      proofScalar: string
      previousBlockHash: string
      transactionsHash: string
      receiptsHash: string
      stateHash: string
      beneficiaryAddress: string
      feeMultiplier: number
    }
    meta: {
      hash: string
      generationHash: string
    }
  }
}
