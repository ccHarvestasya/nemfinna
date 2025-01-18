import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { DatabaseSync } from 'node:sqlite'
import { roundTo } from 'round-to'

const CREATE_HOURLY_PRICE_TABLE_SQL = `
CREATE TABLE hourly_price( 
    created_at text NOT NULL DEFAULT (datetime('now', 'localtime'))
  , updated_at text NOT NULL DEFAULT (datetime('now', 'localtime'))
  , service_name text NOT NULL
  , symbol text NOT NULL
  , datetime text NOT NULL
  , currency text NOT NULL
  , price REAL
  , is_summary BOOL DEFAULT FALSE
  , PRIMARY KEY (service_name, symbol, datetime, currency)
)
`
const CREATE_DAILY_PRICE_TABLE_SQL = `
CREATE TABLE daily_price( 
    created_at text NOT NULL DEFAULT (datetime('now', 'localtime'))
  , updated_at text NOT NULL DEFAULT (datetime('now', 'localtime'))
  , symbol text NOT NULL
  , datetime text NOT NULL
  , currency text NOT NULL
  , price REAL
  , PRIMARY KEY (symbol, datetime, currency)
)
`

type PriceInfos = {
  unixTime: number
  symbol: string
  currency: string
  price: number
}[]

export class CoinPrice {
  private readonly logger = new Logger(this.className)

  private db: DatabaseSync

  /**
   * コンストラクタ
   * @param config コンフィグ
   */
  constructor(private readonly config: ConfigService) {
    this.db = new DatabaseSync(this.config.get('DB_PATH'))
  }

  /**
   * CoinGecko価格時足登録
   * @param symbol
   * @param currency
   */
  async insertCoinGeckoHourlyPrice(symbol: string, currency: string) {
    const serviceName = 'coinGecko'

    // ////////
    // const data = readFileSync(
    //   `./${serviceName}.${symbol}.${currency}.testdata.json`,
    //   'utf-8'
    // )
    // const dataJson = JSON.parse(data)
    // ////////

    const url = `https://api.coingecko.com/api/v3/coins/${symbol}/market_chart?vs_currency=${currency}&days=90`
    this.logger.log(`URL: ${url}`)
    const response = await axios.get(url, {
      headers: {
        accept: 'application/json',
        'x-cg-demo-api-key': 'CG-KDjwrXf4DHhw6F7TcQ1oA8cW',
      },
    })
    const dataJson = response.data

    for (const priceData of dataJson.prices) {
      const date = new Date(priceData[0] as number)
      const price = priceData[1] as number

      const sql = this.db.prepare(
        `INSERT INTO hourly_price(service_name, symbol, datetime, currency, price) VALUES (?, ?, ?, ?, ?)`
      )
      try {
        sql.run(serviceName, symbol, date.getTime().toString(), currency, price)
        this.logger.debug(sql.expandedSQL)
      } catch (e) {
        if (e.errcode !== 1555) {
          this.logger.error(sql)
          this.logger.error(e)
        }
      }
    }
  }

  /**
   * 日足インサート
   * (時足サマリー)
   */
  async insertDailyPrice() {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(23)
    yesterday.setMinutes(59)
    yesterday.setSeconds(59)
    yesterday.setMilliseconds(999)

    // 登録対象を検索
    const sqlPrepare = this.db.prepare(`
      SELECT service_name, symbol, datetime, currency, price 
        FROM hourly_price 
        WHERE is_summary = FALSE AND datetime <= ? 
        ORDER BY datetime
      `)
    const results = sqlPrepare.all(yesterday.getTime())
    this.logger.debug(sqlPrepare.expandedSQL)

    // 日毎、トークン、通貨で集計
    const avgMap = new Map<string, number>()
    for (const res of results) {
      const key = `${new Date(Number(res['datetime'])).toLocaleDateString()},${res['symbol']},${res['currency']}`
      let price = Number(res['price'])
      if (avgMap.has(key)) {
        price += avgMap.get(key)
        price /= 2
      }
      avgMap.set(key, price)
    }

    // メッセージ作成
    for (const [key, val] of avgMap.entries()) {
      const keys = key.split(',')
      const unixTime = new Date(keys[0]).getTime()
      const symbol = keys[1]
      const currency = keys[2]

      const insertSql = this.db.prepare(
        `INSERT INTO daily_price(symbol, datetime, currency, price) VALUES (?, ?, ?, ?)`
      )
      try {
        // 日足インサート
        insertSql.run(symbol, unixTime, currency, val)
        this.logger.debug(insertSql.expandedSQL)
        // サマリーフラグ立てる
        const startUnixTime = unixTime
        const endTimeDate = new Date(unixTime)
        endTimeDate.setHours(23)
        endTimeDate.setMinutes(59)
        endTimeDate.setSeconds(59)
        endTimeDate.setMilliseconds(999)
        const endUnixTime = endTimeDate.getTime()
        const updateSqlPrepare = this.db.prepare(`
          UPDATE hourly_price set is_summary = TRUE 
          WHERE ? <= datetime AND datetime <= ?
        `)
        updateSqlPrepare.run(startUnixTime, endUnixTime)
        this.logger.debug(updateSqlPrepare.expandedSQL)
      } catch (e) {
        if (e.errcode !== 1555) {
          this.logger.error(insertSql)
          this.logger.error(e)
        }
      }
    }
  }

  /**
   * 過去の価格情報取得
   * @param symbol
   * @param currency
   * @param fromDate
   * @param toDate
   * @returns
   */
  getHistoricalPrice(
    symbol: string,
    currency: string,
    fromDate: Date,
    toDate: Date
  ): string {
    const sqlPrepare = this.db.prepare(`
        SELECT
              symbol
            , datetime
            , currency
            , price 
          FROM
            daily_price 
          WHERE
            symbol = ? 
            AND currency = ? 
            AND ? <= datetime 
            AND datetime < ?
      `)
    const results = sqlPrepare.all(
      symbol,
      currency,
      fromDate.getTime(),
      toDate.getTime()
    )

    const priceInfoJson: PriceInfos = []
    for (const result of results) {
      priceInfoJson.push({
        unixTime: Number(result['datetime']),
        symbol: result['symbol'],
        currency: result['currency'],
        price: roundTo(result['price'], 6),
      })
    }

    return JSON.stringify(priceInfoJson)
  }

  /**
   * 不要な時足レコード削除
   */
  deleteOldData(olderMonth: number) {
    const dt = new Date()
    dt.setMonth(dt.getMonth() - olderMonth)
    dt.setHours(23)
    dt.setMinutes(59)
    dt.setSeconds(59)
    dt.setMilliseconds(999)

    const sql = this.db.prepare(
      `DELETE FROM hourly_price WHERE is_summary = TRUE AND updated_at <= ?`
    )
    try {
      sql.run(olderMonth)
      this.logger.debug(sql.expandedSQL)
    } catch (e) {
      this.logger.error(sql.expandedSQL)
      this.logger.error(e)
    }
  }

  /**
   * テーブル無ければ作る
   */
  checkTable() {
    this.createPriceTable()
    this.createDailyPriceTable()
  }

  /**
   * 時足価格テーブル無ければ作る
   */
  private createPriceTable() {
    const result = this.db.prepare(`PRAGMA table_info(hourly_price)`)
    if (result.all().length === 0) {
      const sql = CREATE_HOURLY_PRICE_TABLE_SQL
      this.db.exec(sql)
    }
  }

  /**
   * 日足価格テーブル無ければ作る
   */
  private createDailyPriceTable() {
    const result = this.db.prepare(`PRAGMA table_info(daily_price)`)
    if (result.all().length === 0) {
      const sql = CREATE_DAILY_PRICE_TABLE_SQL
      this.db.exec(sql)
    }
  }

  /**
   * クラス名取得
   */
  private get className() {
    return this.constructor.name
  }
}
