import createClient, { Client } from 'openapi-fetch'
import type { components, paths } from 'schema'

export class SssFetch {
  private readonly MAINNET_SSS_URL = 'https://symbol.services'
  private readonly TESTNET_SSS_URL = 'https://testnet.symbol.services'

  private client: Client<paths, `${string}/${string}`>

  private apiNodesCache: components['schemas']['NodeInfo'][] = []

  /**
   * constructor
   * @param networkType mainnet or testnet
   */
  constructor(networkType = 'mainnet') {
    const nt = networkType.toLowerCase()

    if (!(nt === 'mainnet' || nt === 'testnet'))
      throw Error('unknown network type.')

    this.client = createClient<paths>({
      baseUrl: nt === 'mainnet' ? this.MAINNET_SSS_URL : this.TESTNET_SSS_URL,
    })
  }

  /**
   * try refresh nodes cache
   */
  tryRefreshApiNodesCache = async (): Promise<void> => {
    const { data } = await this.client.GET('/nodes')
    if (data && data.length !== 0) {
      const apiNodes = data.filter((val) => (val.roles & 2) === 2)
      this.apiNodesCache = apiNodes
    }
  }

  randomRestGatewayUrl = (ssl = false): string => {
    return this.randomApiNode(ssl).apiStatus!.restGatewayUrl
  }

  randomRestGatewayUrls = (ssl = false, maxCount = 1): string[] => {
    let urls: string[] = []
    for (const apiNode of this.randomApiNodes(ssl, maxCount)) {
      urls.push(apiNode.apiStatus!.restGatewayUrl)
    }
    return urls
  }

  randomWebSocketUrl = (ssl = false): string => {
    return this.randomApiNode(ssl).apiStatus!.webSocket!.url!
  }

  randomWebSocketUrls = (ssl = false, maxCount = 1): string[] => {
    let urls: string[] = []
    for (const apiNode of this.randomApiNodes(ssl, maxCount)) {
      urls.push(apiNode.apiStatus!.webSocket!.url!)
    }
    return urls
  }

  randomApiNode = (ssl = false): components['schemas']['NodeInfo'] => {
    return this.randomApiNodes(ssl)[0]!
  }

  randomApiNodes = (
    ssl = false,
    maxCount = 1,
  ): components['schemas']['NodeInfo'][] => {
    if (this.apiNodesCache.length === 0)
      throw new Error('api nodes cache empty!! call tryRefreshApiNodesCache')
    if (maxCount <= 0)
      throw new Error('count must be greater than or equal to 1')

    const targetApiNodes = ssl
      ? this.apiNodesCache.filter(
          (val) => val.apiStatus?.isAvailable && val.apiStatus?.isHttpsEnabled,
        )
      : this.apiNodesCache.filter((val) => val.apiStatus?.isAvailable)

    return this.shuffle(targetApiNodes).slice(0, maxCount)
  }

  /**
   * shuffle arrays
   * @param array
   * @returns shuffled array
   */
  private shuffle = (array: any[]): any[] => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }
}
