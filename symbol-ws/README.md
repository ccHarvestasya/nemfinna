# symbol-ws

```typescript
import { SymbolWs } from './src/SymbolWs'
import { WsBlock } from './src/types/WsBlock'

const sws = new SymbolWs('mainnet')
await sws.connect()

sws.on('open', (wsUrl) => {
  console.log('WebSocket接続:', wsUrl)
  console.log(sws.subscribe('block'))
})

sws.on('block', (blcok: WsBlock) => {
  console.log(blcok.data.block.height, blcok.data.meta.hash)
})

sws.on('reconnect', (code: number, reason: string) => {
  console.log('reConnect:', code, reason.toString())
})

console.log('websocketUrl:', await sws.websocketUrl)
```
