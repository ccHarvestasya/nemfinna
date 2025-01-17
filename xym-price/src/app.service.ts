import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { SymbolWs } from './symbol/SymbolWs.js'

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name)

  onApplicationBootstrap() {
    this.logger.log(`The module has been initialized.`)
    const symbolWs = new SymbolWs()
    symbolWs.connectWebSocket('wss://sakia.harvestasya.com:3001/ws')
  }

  getHello(): string {
    return 'Hello World!'
  }
}
