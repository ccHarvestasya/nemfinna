import { EventEmitter } from 'events'
import { SssFetch } from 'sss-fetch'
import { WsBlock } from 'types/WsBlock'
import { WsConfirmedAdded } from 'types/WsConfirmedAdded'
import { WsCosignature } from 'types/WsCosignature'
import { WsFinalizedBlock } from 'types/WsFinalizedBlock'
import { WsPartialAdded } from 'types/WsPartialAdded'
import { WsPartialRemoved } from 'types/WsPartialRemoved'
import { WsStatus } from 'types/WsStatus'
import { WsUnconfirmedAdded } from 'types/WsUnconfirmedAdded'
import { WsUnconfirmedRemoved } from 'types/WsUnconfirmedRemoved'
import { WebSocket } from 'ws'
import { WsBase } from './types/WsBase'

export class SymbolWs extends EventEmitter {
  private sssFetch: SssFetch
  private ws: WebSocket | null = null
  private uid: string | null
  private timerId: NodeJS.Timeout | null = null
  private isAlways: boolean

  on(event: 'open' | 'reconnect', listener: () => void): this
  on(event: 'close', listener: (code: number, reason: Buffer) => void): this
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

  constructor(networkType: 'mainnet' | 'testnet' = 'mainnet') {
    super()

    const nt = networkType.toLowerCase()
    if (!(nt === 'mainnet' || nt === 'testnet')) throw Error('unknown network type.')
    this.sssFetch = new SssFetch(nt)
    this.isAlways = true
    this.uid = null
  }

  init = async () => {
    await this.sssFetch.tryRefreshApiNodesCache()
  }

  connect = async () => {
    // WebSocket接続
    const wsUrl = this.sssFetch.randomWebSocketUrl(true)
    this.ws = new WebSocket(wsUrl)

    // WebSocket接続時の処理
    this.ws.on('open', () => {
      this.reSetTimer()
    })

    // メッセージ受信時の処理
    this.ws.on('message', (data: string) => {
      this.reSetTimer()
      const receiveJson = JSON.parse(data) as WsBase

      if (receiveJson.uid) {
        this.uid = receiveJson.uid
        this.emit('open')
        return
      }

      this.emit(receiveJson.topic!, receiveJson)
    })

    this.ws.on('error', (err: Error) => {
      this.emit('error', err)
    })

    // WebSocket切断時の処理
    this.ws.on('close', async (code: number, reason: Buffer) => {
      this.uid = null
      if (this.isAlways) this.reConnect()
      else this.emit('close', code, reason)
    })
  }

  close = () => {
    if (this.ws) {
      this.isAlways = false
      this.ws.close()
    }
  }

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

  private reConnect = () => {
    this.connect()
    this.emit('reconnect')
  }

  private reSetTimer = () => {
    if (this.timerId) clearTimeout(this.timerId)
    this.timerId = setTimeout(() => this.ws!.close(), 90000)
  }
}
