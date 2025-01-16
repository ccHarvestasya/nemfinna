import { Injectable, Logger } from '@nestjs/common'
import { SssFetch } from 'sss-fetch'

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name)

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log(`The module has been initialized.`)
    const sssFetch = new SssFetch('testnet')
    await sssFetch.tryRefreshApiNodesCache()
    const apiNodes = sssFetch.randomApiNodes(true, 5)
    console.log(apiNodes)
  }

  getHello(): string {
    return 'Hello World!'
  }
}
