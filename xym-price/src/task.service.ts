import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { CoinPrice } from './CoinPrice.js'

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name)

  /**
   * コンストラクタ
   * @param config コンフィグ
   */
  constructor(private readonly config: ConfigService) {}

  /**
   * 価格取得後DB登録
   * 毎時15分起動
   */
  @Cron('0 15 * * * *')
  async handleInsertPrice() {
    this.logger.log('--- start handleInsertPrice ---')

    const cp = new CoinPrice(this.config)
    cp.checkTable()

    const symbols = (this.config.get('SYMBOLS') as string).split(' ')
    const currencies = (this.config.get('CURRENCIES') as string).split(' ')
    for (const symbol of symbols) {
      for (const currency of currencies) {
        await cp.insertCoinGeckoHourlyPrice(symbol, currency)
      }
    }

    this.logger.log('--- end handleInsertPrice ---')
  }

  /**
   * 日足DB登録
   * 00:17起動
   */
  @Cron('0 17 0 * * *')
  async handleDailySummaly() {
    this.logger.log('--- start handleDailySummaly ---')

    // 一日一回一日分を集計する
    const cp = new CoinPrice(this.config)
    await cp.insertDailyPrice()

    this.logger.log('--- end handleDailySummaly ---')
  }

  /**
   * 時足不要データ削除
   * 03:34起動
   */
  @Cron('0 34 3 * * *')
  handleDeleteRecord() {
    this.logger.log('--- start handleDeleteRecord ---')

    // 一日一回15ヶ月前のデータを削除する
    const cp = new CoinPrice(this.config)
    cp.deleteOldData(15)

    this.logger.log('--- end handleDeleteRecord ---')
  }
}
