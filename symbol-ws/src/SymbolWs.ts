import { EventEmitter } from 'events'
import { SssFetch } from 'sss-fetch'
import { WsBase } from 'types/WsBase.js'
import { WsBlock } from 'types/WsBlock.js'
import { WsConfirmedAdded } from 'types/WsConfirmedAdded.js'
import { WsCosignature } from 'types/WsCosignature.js'
import { WsFinalizedBlock } from 'types/WsFinalizedBlock.js'
import { WsPartialAdded } from 'types/WsPartialAdded.js'
import { WsPartialRemoved } from 'types/WsPartialRemoved.js'
import { WsStatus } from 'types/WsStatus.js'
import { WsUnconfirmedAdded } from 'types/WsUnconfirmedAdded.js'
import { WsUnconfirmedRemoved } from 'types/WsUnconfirmedRemoved.js'
import { WebSocket } from 'ws'

export class SymbolWs extends EventEmitter {
  private readonly MAINNET_EPOCH = new Date(Date.UTC(2021, 2, 16, 0, 6, 25))
  private readonly TESTNET_EPOCH = new Date(Date.UTC(2022, 9, 31, 21, 7, 47))
  private readonly MAINNET_BLOCK_TIME_TOLERANCE = -3000
  private readonly TESTNET_BLOCK_TIME_TOLERANCE = 1000

  private readonly CLOSE_REASON = new Map<number, string>([
    [4000, 'close instruction'],
    [4001, 'response time out'],
    [4002, 'old block or slow node'],
  ])

  private sssFetch: SssFetch
  private ws: WebSocket | null = null
  private uid: string | null
  private timerId: NodeJS.Timeout | null = null
  private isAlways: boolean
  private blockTimeTolerance: number

  private webSocketUrl: string | null = null

  on(event: 'open', listener: (wsUrl: string) => void): this
  on(event: 'reconnect', listener: (code: number, reason: string) => void): this
  on(event: 'close', listener: (code: number, reason: string) => void): this
  on(event: 'error', listener: (err: Error) => void): this
  on(event: 'block', listener: (block: WsBlock) => void): this
  on(event: 'finalizedBlock', listener: (block: WsFinalizedBlock) => void): this
  on(event: 'confirmedAdded', listener: (block: WsConfirmedAdded) => void): this
  on(event: 'unconfirmedAdded', listener: (block: WsUnconfirmedAdded) => void): this
  on(event: 'unconfirmedRemoved', listener: (block: WsUnconfirmedRemoved) => void): this
  on(event: 'partialAdded', listener: (block: WsPartialAdded) => void): this
  on(event: 'partialRemoved', listener: (block: WsPartialRemoved) => void): this
  on(event: 'cosignature', listener: (block: WsCosignature) => void): this
  on(event: 'status', listener: (block: WsStatus) => void): this
  on(event: string, listener: (...args: any[]) => void) {
    return super.on(event, listener)
  }

  /**
   * コンストラクタ
   * @param networkType ネットワークタイプ
   * @param responseTimeout 応答タイムアウト(default:45000)
   */
  constructor(
    private networkType: 'mainnet' | 'testnet' = 'mainnet',
    private responseTimeout = 45000,
  ) {
    super()

    this.blockTimeTolerance =
      this.networkType === 'mainnet'
        ? this.MAINNET_BLOCK_TIME_TOLERANCE
        : this.TESTNET_BLOCK_TIME_TOLERANCE
    this.sssFetch = new SssFetch(this.networkType)
    this.isAlways = true
    this.uid = null
  }

  get websocketUrl(): Promise<string> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.webSocketUrl !== null) {
          clearInterval(interval) // タイマーを停止
          resolve(this.webSocketUrl) // 値を返す
        }
      }, 100) // 100msごとにチェック
    })
  }

  /**
   * WebSocket接続
   */
  connect = async () => {
    await this.sssFetch.tryRefreshApiNodesCache()
    await this.reConnect()
  }

  /**
   * WebSocket再接続
   */
  private reConnect = async () => {
    // WebSocket接続
    this.webSocketUrl = this.sssFetch.randomWebSocketUrl(true)
    this.ws = new WebSocket(this.webSocketUrl)

    // WebSocket接続時の処理
    this.ws.on('open', () => {
      this.reSetTimer()
    })

    // メッセージ受信時の処理
    this.ws.on('message', (data: string) => {
      this.reSetTimer()
      const receiveJson = JSON.parse(data) as WsBase

      // 初回接続時UID登録
      if (receiveJson.uid) {
        this.uid = receiveJson.uid
        this.emit('open', this.webSocketUrl)
        return // 終了
      }

      // ブロック生成通知時
      if (receiveJson.topic === 'block') {
        const blockData = receiveJson as WsBlock
        const epochTime = this.networkType === 'mainnet' ? this.MAINNET_EPOCH : this.TESTNET_EPOCH
        const blockDate = new Date(epochTime.getTime() + Number(blockData.data.block.timestamp))

        // 現在時間とブロック時間とのラグ
        const gap = new Date().getTime() - blockDate.getTime()
        if (this.blockTimeTolerance < gap) {
          const code = 4002
          this.ws!.close(code, this.CLOSE_REASON.get(code)) // 再接続
        }
      }

      // 発火
      this.emit(receiveJson.topic!, receiveJson)
    })

    // エラー時の処理
    this.ws.on('error', (err: Error) => {
      this.emit('error', err)
    })

    // WebSocket切断時の処理
    this.ws.on('close', async (code: number, reason: Buffer) => {
      this.uid = null
      this.webSocketUrl = null
      if (this.isAlways) {
        this.emit('reconnect', code, reason)
        this.reConnect()
      } else {
        this.emit('close', code, reason)
      }
    })
  }

  /**
   * WebSocketを永続的に閉じる
   */
  close = () => {
    if (this.ws) {
      this.isAlways = false
      const code = 4000
      this.ws.close(code, this.CLOSE_REASON.get(code))
    }
  }

  /**
   * サブスクライブ
   * @param topic トピック
   * @returns サブスクライブ送信メッセージ
   */
  subscribe(topic: 'block' | 'finalizedBlock'): string
  subscribe(
    topic:
      | 'confirmedAdded'
      | 'unconfirmedAdded'
      | 'unconfirmedRemoved'
      | 'partialAdded'
      | 'partialRemoved'
      | 'cosignature'
      | 'status',
    address?: string,
  ): string
  subscribe(topic: string, address?: string): string {
    if (!this.ws) throw new Error('not connected to websocket')
    const addr = address ? `/${address}` : ''
    const msg = `{"uid": "${this.uid}", "subscribe": "${topic}${addr}"}`
    this.ws.send(msg)
    return msg
  }

  /**
   * アンサブスクライブ
   * @param topic トピック
   * @returns アンサブスクライブ送信メッセージ
   */
  unSubscribe(topic: 'block' | 'finalizedBlock'): string
  unSubscribe(
    topic:
      | 'confirmedAdded'
      | 'unconfirmedAdded'
      | 'unconfirmedRemoved'
      | 'partialAdded'
      | 'partialRemoved'
      | 'cosignature'
      | 'status',
    address?: string,
  ): string
  unSubscribe(topic: string, address?: string): string {
    if (!this.ws) throw new Error('not connected to websocket')
    const addr = address ? `/${address}` : ''
    const msg = `{"uid": "${this.uid}", "unsubscribe": "${topic}${addr}"}`
    this.ws.send(msg)
    return msg
  }

  /**
   * 無応答タイマーをリセットする
   */
  private reSetTimer = () => {
    if (this.timerId) clearTimeout(this.timerId)
    this.timerId = setTimeout(() => {
      const code = 4001
      this.ws!.close(code, this.CLOSE_REASON.get(code)) // 再接続
    }, this.responseTimeout)
  }
}
