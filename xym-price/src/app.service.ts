import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SymbolWs, WsBlock } from 'symbol-ws'

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name)
  private symbolWs: SymbolWs

  constructor(private readonly config: ConfigService) {}

  /**
   * すべてのモジュールが初期化された後
   */
  async onApplicationBootstrap() {
    this.logger.log('  _/_/_/_/_/_/_/_/_/_/_/')
    this.logger.log(` _/_/ ${process.env.NODE_ENV.toUpperCase().padStart(12, ' ')} _/_/`)
    this.logger.log('_/_/_/_/_/_/_/_/_/_/_/')

    this.symbolWs = new SymbolWs(this.config.get('NETWORK_TYPE'))
    await this.symbolWs.connect()

    this.symbolWs.on('open', (wsUrl) => {
      this.logger.debug(`WebSocket接続: ${wsUrl}`)
      this.logger.debug(this.symbolWs.subscribe('block'))
    })

    this.symbolWs.on('block', (blcok: WsBlock) => {
      this.logger.debug(`${blcok.data.block.height} ${blcok.data.meta.hash}`)
    })

    this.symbolWs.on('reconnect', (code: number, reason: string) => {
      this.logger.debug(`reConnect: ${code} ${reason.toString()}`)
    })

    const wsUrlPath = await this.symbolWs.websocketUrl
    const wsUrl = new URL(wsUrlPath)
    const host = wsUrl.hostname
    const port = wsUrl.port
    this.logger.debug(`websocketUrl  : ${wsUrlPath}`)
    this.logger.debug(`restGatewayUrl: https://${host}:${port}`)
  }

  getHello(): string {
    return 'Hello World!'
  }
}
