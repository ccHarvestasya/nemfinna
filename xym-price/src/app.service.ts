import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { SymbolWs, WsBlock } from 'symbol-ws'

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name)
  private symbolWs: SymbolWs

  async onApplicationBootstrap() {
    this.logger.log(`The module has been initialized.`)

    this.symbolWs = new SymbolWs('testnet')
    await this.symbolWs.connect()

    this.symbolWs.on('open', (wsUrl) => {
      this.logger.debug('WebSocket接続:', wsUrl)
      this.logger.debug(this.symbolWs.subscribe('block'))
    })

    this.symbolWs.on('block', (blcok: WsBlock) => {
      this.logger.debug(blcok.data.block.height, blcok.data.meta.hash)
    })

    this.symbolWs.on('reconnect', (code: number, reason: string) => {
      this.logger.debug('reConnect:', code, reason.toString())
    })

    this.logger.debug('websocketUrl:', await this.symbolWs.websocketUrl)
  }

  getHello(): string {
    return 'Hello World!'
  }
}
