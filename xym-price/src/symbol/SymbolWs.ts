import { Logger } from '@nestjs/common'
import axios from 'axios'
import { WebSocket } from 'ws'
import { WsBase } from './types/websocket/WsBase.js'
import { WsBlock } from './types/websocket/WsBlock.js'
import { Network, SymbolFacade } from 'symbol-sdk/symbol'

export class SymbolWs {
  private readonly logger = new Logger('SymbolWs')

  randomSymbolWebSocketUrl = async () => {
    const response = await axios.get('https://testnet.symbol.services/nodes?ssl=true&limit=1&order=random')
    const symbolWebSocketUrl = response.data[0]?.apiStatus?.webSocket?.url
    if (!symbolWebSocketUrl) throw Error('WebSocket URLの取得に失敗しました')
    this.logger.debug('symbolWebSocketUrl:', symbolWebSocketUrl)
    return symbolWebSocketUrl
  }

  connectWebSocket = async (url?: string) => {
    // WebSocket接続
    const wsUrl = url ?? (await this.randomSymbolWebSocketUrl())
    const ws = new WebSocket(wsUrl)

    // WebSocket接続時の処理
    ws.on('open', () => {
      this.logger.debug('WebSocket Open:', wsUrl)
    })

    // メッセージ受信時の処理
    ws.on('message', (data: string) => {
      const wsBaseJson = JSON.parse(data) as WsBase
      if (!wsBaseJson.topic) {
        this.logger.debug(JSON.stringify(wsBaseJson, null, 2))
        const msg = `{"uid": "${wsBaseJson.uid}", "subscribe": "block"}`
        ws.send(msg)
        this.logger.debug(msg)
      } else if (wsBaseJson.topic === 'block') {
        const blockJson = wsBaseJson as WsBlock
        const facade = new SymbolFacade(Network.TESTNET)
        const tms = facade.network.datetimeConverter.toDatetime(Number(blockJson.data.block.timestamp))
        this.logger.debug(tms)
        // this.logger.debug(JSON.stringify(blockJson.data, null, 2))
      }
    })

    // WebSocket切断時の処理
    ws.on('close', async () => {
      this.connectWebSocket()
      this.logger.debug(new Date().toLocaleString(), 'WebSocket Close:', wsUrl)
    })
  }
}
