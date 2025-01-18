import { Controller, Get, Header, Query } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { parse } from 'date-fns'
import { AppService } from './app.service.js'
import { CoinPrice } from './CoinPrice.js'

@Controller()
export class AppController {
  /**
   * コンストラクタ
   * @param appService
   * @param config
   */
  constructor(
    private readonly appService: AppService,
    private readonly config: ConfigService
  ) {}

  @Get('/nodehost')
  @Header('Content-Type', 'application/json')
  async getNodeHost(): Promise<string> {
    return await this.appService.getNodeHost()
  }

  @Get('/price')
  @Header('Content-Type', 'application/json')
  getPrice(
    @Query('symbol') symbol: string = 'symbol',
    @Query('currency') currency: string = 'jpy',
    @Query('from') from?: string,
    @Query('to') to?: string
  ): string {
    let fromDt = new Date()
    if (from) {
      fromDt = parse(from, 'yyyyMMdd', new Date())
    } else {
      fromDt.setDate(fromDt.getDate() - 270)
      fromDt.setHours(0)
      fromDt.setMinutes(0)
      fromDt.setSeconds(0)
      fromDt.setMilliseconds(0)
    }

    let toDt = new Date()
    if (to) {
      toDt = parse(to, 'yyyyMMdd', new Date())
    } else {
      toDt.setDate(toDt.getDate() - 1)
      toDt.setHours(23)
      toDt.setMinutes(59)
      toDt.setSeconds(59)
      toDt.setMilliseconds(999)
    }

    return this.appService.getPrice(symbol, currency, fromDt, toDt)
  }

  @Get('/register')
  async register(): Promise<string> {
    const cp = new CoinPrice(this.config)
    cp.checkTable()
    const symbols = (this.config.get('SYMBOLS') as string).split(' ')
    const currencies = (this.config.get('CURRENCIES') as string).split(' ')
    for (const symbol of symbols) {
      for (const currency of currencies) {
        await cp.insertCoinGeckoHourlyPrice(symbol, currency)
      }
    }
    return 'OK'
  }

  @Get('/summary')
  summary(): string {
    const cp = new CoinPrice(this.config)
    cp.insertDailyPrice()
    return 'OK'
  }
}
