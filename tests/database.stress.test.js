import assert from 'node:assert/strict'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { app } from 'electron'

app.disableHardwareAcceleration()

const testDataPath = process.env.STOK_TEST_USER_DATA
if (!testDataPath) throw new Error('STOK_TEST_USER_DATA test ortamı tarafından ayarlanmalıdır.')
app.setPath('userData', testDataPath)

const legacyPath = join(testDataPath, 'stok-takip.db')
const legacyDb = new Database(legacyPath)
legacyDb.exec(`
  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    color TEXT,
    barcode TEXT UNIQUE,
    sku TEXT UNIQUE,
    current_quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER NOT NULL DEFAULT 0,
    purchase_price INTEGER NOT NULL DEFAULT 0,
    retail_price INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
  CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    total_price INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TL',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
  CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TL',
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );
`)
legacyDb.prepare(`INSERT INTO products
  (name, current_quantity, min_quantity, purchase_price, retail_price)
  VALUES ('İşlem Legacy Ürünü', 5, 1, 100, 200)`).run()
legacyDb.prepare("INSERT INTO customers (name) VALUES ('Legacy Müşteri')").run()
legacyDb.prepare(`INSERT INTO sales (customer_id, product_id, quantity, unit_price, total_price, currency)
  VALUES (1, 1, 2, 500, 1000, 'TL')`).run()
legacyDb.prepare(`INSERT INTO payments (customer_id, amount, currency, note)
  VALUES (1, 500, 'TL', 'Eski tahsilat')`).run()
legacyDb.close()

let database
let passed = 0

function check(name, fn) {
  fn()
  passed += 1
  console.log(`✓ ${name}`)
}

try {
  const api = await import('../electron/database.js')
  database = api.getDatabase()

  check('eski veritabanı şeması kayıplı veri dönüşümü olmadan yükseliyor', () => {
    const legacyProduct = api.getProducts().find((product) => product.id === 1)
    assert.equal(legacyProduct.name, 'İşlem Legacy Ürünü')
    assert.equal(legacyProduct.wholesalePrice, 0)
    assert.ok(legacyProduct.updatedAt)

    const legacyCustomer = api.getCustomers().find((customer) => customer.id === 1)
    assert.equal(legacyCustomer.totalSalesTL, 1000)
    assert.equal(legacyCustomer.totalPaidTL, 500)
    assert.equal(legacyCustomer.totalSalesUSD, 0)
    assert.equal(database.prepare('SELECT is_deleted FROM customers WHERE id = ?').get(1).is_deleted, 0)
    assert.equal(database.prepare("SELECT cost_is_estimated FROM activity_history WHERE source_key = 'sale:1'").get().cost_is_estimated, 1)
  })

  let customerId
  let productId
  check('ürün ve müşteri kayıtları oluşturuluyor, başlangıç stoku hareketiyle eşleşiyor', () => {
    customerId = api.addCustomer({ name: 'Test Cari', phone: '05550000001' }).id
    productId = api.addProduct({
      name: 'Test Ürün',
      currentQuantity: 20,
      minQuantity: 2,
      purchasePrice: 1000,
      retailPrice: 2500,
      wholesalePrice: 1800
    }).id

    const product = api.getProducts().find((item) => item.id === productId)
    assert.equal(product.currentQuantity, 20)
    assert.equal(product.retailPrice, 2500)
    assert.ok(api.getProducts({ page: 1, pageSize: 50 }).items.some((item) => item.id === productId))
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM stock_movements WHERE product_id = ?').get(productId).count, 1)
  })

  check('satış stok, cari borç ve stok hareketini tek işlemde güncelliyor', () => {
    api.makeSale({ customerId, productId, quantity: 3, unitPrice: 2500 })
    assert.equal(database.prepare('SELECT current_quantity FROM products WHERE id = ?').get(productId).current_quantity, 17)
    assert.equal(api.getCustomers().find((customer) => customer.id === customerId).totalSalesUSD, 7500)
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM stock_movements WHERE product_id = ? AND movement_type = 'STOCK_OUT'").get(productId).count, 1)
    assert.equal(api.getDashboardStats().salesStats[0]?.totalRevenue, 7500)
    assert.equal(api.getDashboardStats().salesStats[0]?.totalProfit, 4500)
    assert.equal(api.getDashboardStats().salesStats[0]?.missingCostSalesCount, 0)
    assert.equal(api.getDashboardStats().outstandingBalance.amount, 7500)
    assert.equal(api.getDashboardStats().allTimeStats.totalStockExpenses, 20000)
    assert.equal(api.getDashboardStats().todaySalesList[0]?.totalPrice, 7500)

    const today = database.prepare("SELECT date('now', 'localtime') AS date").get().date
    const finance = api.getDashboardStats({ paymentRangeStart: today, paymentRangeEnd: today, paymentGrouping: 'day' })
    assert.equal(finance.financialSummary.netSales, 7500)
    assert.equal(finance.financialSummary.cogs, 3000)
    assert.equal(finance.financialSummary.unverifiedCostSales, 0)
    assert.equal(finance.financialSummary.grossProfit, 4500)
    assert.equal(finance.financialSummary.grossMargin, 60)
    assert.equal(finance.financialSummary.stockPurchases, 20000)
    assert.ok(finance.financialTrendStats.some((row) => row.netSales === 7500 && row.cogs === 3000))
    const weeklyFinance = api.getDashboardStats({ paymentRangeStart: today, paymentRangeEnd: today, paymentGrouping: 'week' })
    assert.equal(weeklyFinance.financialTrendStats[0]?.netSales, 7500)
    const yesterday = database.prepare("SELECT date('now', 'localtime', '-1 day') AS date").get().date
    const outsideRange = api.getDashboardStats({ paymentRangeStart: yesterday, paymentRangeEnd: yesterday, paymentGrouping: 'day' })
    assert.equal(outsideRange.financialSummary.netSales, 0)
    assert.equal(outsideRange.financialSummary.grossMargin, null)
  })

  check('stok yetersizliği ve hatalı fiyat satış kayıtlarını yarım bırakmıyor', () => {
    const before = database.prepare('SELECT current_quantity FROM products WHERE id = ?').get(productId).current_quantity
    const salesBefore = database.prepare('SELECT COUNT(*) AS count FROM sales WHERE customer_id = ?').get(customerId).count
    const movementsBefore = database.prepare('SELECT COUNT(*) AS count FROM stock_movements WHERE product_id = ?').get(productId).count
    assert.throws(() => api.makeSale({ customerId, productId, quantity: 100, unitPrice: 2500 }), /Yetersiz stok/)
    assert.throws(() => api.makeSale({ customerId, productId, quantity: 1, unitPrice: Number.NaN }), /fiyat/i)
    assert.equal(database.prepare('SELECT current_quantity FROM products WHERE id = ?').get(productId).current_quantity, before)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM sales WHERE customer_id = ?').get(customerId).count, salesBefore)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM stock_movements WHERE product_id = ?').get(productId).count, movementsBefore)
  })

  check('tahsilat borç sınırında çalışıyor, fazla ve geçersiz tutarı reddediyor', () => {
    const saleRowsBeforePayment = database.prepare("SELECT COUNT(*) AS count FROM activity_history WHERE event_type = 'SALE'").get().count
    const saleProfitBeforePayment = api.getDashboardStats().salesStats[0]?.totalProfit
    api.addPayment({ customerId, amount: 5000, note: 'Test ödeme' })
    assert.equal(api.getDashboardStats().paymentsStats[0]?.totalPaid, 5000)
    assert.equal(api.getDashboardStats().outstandingBalance.amount, 2500)
    assert.throws(() => api.addPayment({ customerId, amount: 2501 }), /kalan borçtan/)
    assert.throws(() => api.addPayment({ customerId, amount: 1.5 }), /Geçerli bir ödeme/)
    assert.equal(api.getCustomers().find((customer) => customer.id === customerId).totalPaidUSD, 5000)
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM activity_history WHERE event_type = 'SALE'").get().count, saleRowsBeforePayment)
    assert.equal(api.getDashboardStats().salesStats[0]?.totalProfit, saleProfitBeforePayment)
    const today = database.prepare("SELECT date('now', 'localtime') AS date").get().date
    const finance = api.getDashboardStats({ paymentRangeStart: today, paymentRangeEnd: today, paymentGrouping: 'day', financePageSize: 2 })
    assert.equal(finance.financialSummary.collections, 5000)
    assert.equal(finance.financialTrendStats[0]?.netSales, 7500)
    assert.equal(finance.financialOtherCurrencies.some((row) => row.currency === 'TL'), true)
    assert.equal(finance.financeTransactionCount, 3)
    assert.equal(finance.financeTransactions.length, 2)
    assert.equal(api.getProductCatalog('').colors.includes('Siyah'), true)
    assert.equal(api.getProductCatalog('').colors.includes('Şeffaf'), true)
  })

  check('işlem geçmişi bulunan müşteri ve ürünler silinmeye karşı korunuyor', () => {
    assert.throws(() => api.deleteCustomer(customerId), /ödenmemiş borcu bulunduğu için silinemez/)
    api.deactivateProduct(productId)
    api.deleteProduct(productId)
    assert.equal(database.prepare('SELECT is_deleted FROM products WHERE id = ?').get(productId).is_deleted, 1)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM sales WHERE product_id = ?').get(productId).count, 1)
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM activity_history WHERE source_key LIKE 'sale:%' AND product_id = ?").get(productId).count, 1)
    assert.equal(api.getDashboardStats().salesStats[0]?.totalRevenue, 7500)
    assert.equal(api.getDashboardStats().allTimeStats.totalStockExpenses, 20000)
  })

  check('maliyeti tahmini olan satış ciroya dahil, kazanca hariç tutuluyor', () => {
    database.prepare(`
      INSERT INTO activity_history (
        source_key, event_type, product_name, quantity, amount, currency,
        total_cost, cost_is_estimated, note, created_at
      ) VALUES ('test:estimated-sale', 'SALE', 'Geçmiş ürün', 1, 5000, 'USD', 1200, 1, 'Maliyet doğrulama testi', CURRENT_TIMESTAMP)
    `).run()

    const sale = api.getDashboardStats().salesStats[0]
    assert.equal(sale.totalRevenue, 12500)
    assert.equal(sale.totalProfit, 4500)
    assert.equal(sale.missingCostSalesCount, 1)
  })

  check('dashboard envanter kategorilerini ve stok alarmı ürünlerini ayrı sayıyor', () => {
    const alarmProductId = api.addProduct({
      name: 'Alarm Ürünü', category: 'Kılıflar', currentQuantity: 1,
      minQuantity: 2, purchasePrice: 300, retailPrice: 500
    }).id
    const dashboard = api.getDashboardStats()
    const category = dashboard.categoryInventory.find((item) => item.category === 'Kılıflar')
    assert.equal(category.productCount, 1)
    assert.equal(category.unitCount, 1)
    assert.ok(dashboard.lowStockItems.some((item) => item.id === alarmProductId && item.currentQuantity === 1 && item.minQuantity === 2))
    assert.equal(dashboard.lowStockProducts, 1)
    api.deactivateProduct(alarmProductId)
    api.deleteProduct(alarmProductId)
  })

  check('stok sınırları, pasif ürün kuralı ve temiz ürün silme akışı çalışıyor', () => {
    assert.throws(() => api.updateStock({ productId, movementType: 'STOCK_IN', quantity: 1 }), /pasif/)
    const disposableId = api.addProduct({ name: 'Silinebilir Ürün', currentQuantity: 2, purchasePrice: 100 }).id
    api.deactivateProduct(disposableId)
    api.deleteProduct(disposableId)
    assert.equal(database.prepare('SELECT is_deleted FROM products WHERE id = ?').get(disposableId).is_deleted, 1)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM stock_movements WHERE product_id = ?').get(disposableId).count, 2)
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM activity_history WHERE source_key LIKE 'stock:%' AND product_id = ?").get(disposableId).count, 2)
  })

  let scenarioProductId
  let cashCustomerId
  let creditCustomerId
  let partialCustomerId
  check('satış anındaki stok partisi maliyeti sonraki alış maliyetlerinden etkilenmiyor', () => {
    scenarioProductId = api.addProduct({ name: 'Maliyet Koruma Ürünü', currentQuantity: 3, purchasePrice: 1000, retailPrice: 2500 }).id
    api.makeSale({ customerId, productId: scenarioProductId, quantity: 1, unitPrice: 2500 })
    const saleRecord = database.prepare("SELECT source_key AS sourceKey, total_cost AS totalCost FROM activity_history WHERE event_type = 'SALE' AND product_id = ? ORDER BY rowid DESC LIMIT 1").get(scenarioProductId)
    assert.equal(saleRecord.totalCost, 1000)

    api.updateStock({ productId: scenarioProductId, movementType: 'STOCK_IN', quantity: 2, unitPrice: 3000, note: 'Maliyet geçmişi testi' })
    assert.equal(database.prepare('SELECT total_cost FROM activity_history WHERE source_key = ?').get(saleRecord.sourceKey).total_cost, 1000)
    assert.equal(database.prepare('SELECT unit_cost FROM stock_batches WHERE product_id = ? ORDER BY id DESC LIMIT 1').get(scenarioProductId).unit_cost, 3000)
  })

  check('peşin, borçlu ve kısmi ödemeli satışlar; kapanış tahsilatı ve silinen cari geçmişi tutarlı', () => {
    cashCustomerId = api.addCustomer({ name: 'Akış Peşin Müşteri', phone: '05550000011' }).id
    creditCustomerId = api.addCustomer({ name: 'Akış Borç Müşteri', phone: '05550000012' }).id
    partialCustomerId = api.addCustomer({ name: 'Akış Kısmi Müşteri', phone: '05550000013' }).id
    const dashboardPaymentsBefore = Number(api.getDashboardStats().paymentsStats.find((row) => row.currency === 'USD')?.totalPaid || 0)
    const totalSalesBeforePayment = database.prepare("SELECT COUNT(*) AS count FROM activity_history WHERE event_type = 'SALE'").get().count

    api.makeSale({ customerId: cashCustomerId, productId: scenarioProductId, quantity: 1, unitPrice: 2500 })
    api.addPayment({ customerId: cashCustomerId, amount: 2500, note: 'Peşin satış ödemesi' })
    api.makeSale({ customerId: creditCustomerId, productId: scenarioProductId, quantity: 1, unitPrice: 2500 })
    api.makeSale({ customerId: partialCustomerId, productId: scenarioProductId, quantity: 1, unitPrice: 2500 })
    api.addPayment({ customerId: partialCustomerId, amount: 1000, note: 'Kısmi ödeme' })

    const customerRows = api.getCustomers()
    assert.equal(customerRows.find((row) => row.id === cashCustomerId).totalSalesUSD, 2500)
    assert.equal(customerRows.find((row) => row.id === cashCustomerId).totalPaidUSD, 2500)
    assert.equal(customerRows.find((row) => row.id === creditCustomerId).totalPaidUSD, 0)
    assert.equal(customerRows.find((row) => row.id === partialCustomerId).totalSalesUSD - customerRows.find((row) => row.id === partialCustomerId).totalPaidUSD, 1500)
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM activity_history WHERE event_type = 'SALE'").get().count - totalSalesBeforePayment, 3)
    assert.equal(Number(api.getDashboardStats().paymentsStats.find((row) => row.currency === 'USD')?.totalPaid || 0) - dashboardPaymentsBefore, 3500)
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM activity_history WHERE event_type = 'PAYMENT' AND customer_id IN (?, ?, ?)").get(cashCustomerId, creditCustomerId, partialCustomerId).count, 2)

    const salesCountBeforeOldDebtPayment = database.prepare("SELECT COUNT(*) AS count FROM activity_history WHERE event_type = 'SALE'").get().count
    api.addPayment({ customerId: creditCustomerId, amount: 2500, note: 'Eski borcun kapanışı' })
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM activity_history WHERE event_type = 'SALE'").get().count, salesCountBeforeOldDebtPayment)
    assert.equal(api.getCustomers().find((row) => row.id === creditCustomerId).totalSalesUSD, api.getCustomers().find((row) => row.id === creditCustomerId).totalPaidUSD)
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM activity_history WHERE event_type = 'DEBT_SETTLED' AND customer_id = ?").get(creditCustomerId).count, 1)
    assert.equal(database.prepare("SELECT amount FROM activity_history WHERE event_type = 'DEBT_SETTLED' AND customer_id = ?").get(creditCustomerId).amount, 0)

    const today = database.prepare("SELECT date('now', 'localtime') AS date").get().date
    const page = api.getActivityHistory({ page: 1, pageSize: 1, search: 'Akış Borç Müşteri', startDate: today, endDate: today })
    assert.ok(page.total >= 3)
    assert.equal(page.items.length, 1)
    assert.ok(page.pageCount >= 3)
    const customerPayments = api.getActivityHistory({ search: 'Akış Borç Müşteri', eventType: 'PAYMENT', startDate: today, endDate: today })
    assert.equal(customerPayments.length, 1)
    assert.ok(customerPayments[0].note.includes('Eski borcun'))
    assert.ok(api.getActivityHistory({ search: 'Tahsilat', eventType: 'PAYMENT' }).length >= 1)
    assert.throws(() => api.getActivityHistory({ startDate: '2026-02-30' }), /tarihi geçersiz/)

    check('işlem geçmişi eşleşen tüm hareketleri 50 kayıtlık sayfalara böler', () => {
      const addHistoryRows = database.prepare(`
        INSERT INTO activity_history (source_key, event_type, note, created_at)
        VALUES (?, 'STOCK_IN', 'sayfalama sınır kontrolü', datetime('now', 'localtime'))
      `)
      for (let index = 1; index <= 120; index += 1) addHistoryRows.run(`test:history-page-limit-${index}`)

      const firstPage = api.getActivityHistory({ page: 1, pageSize: 50, search: 'sayfalama sınır kontrolü', startDate: today, endDate: today })
      const secondPage = api.getActivityHistory({ page: 2, pageSize: 50, search: 'sayfalama sınır kontrolü', startDate: today, endDate: today })
      const thirdPage = api.getActivityHistory({ page: 3, pageSize: 50, search: 'sayfalama sınır kontrolü', startDate: today, endDate: today })
      assert.equal(firstPage.total, 120)
      assert.equal(firstPage.pageCount, 3)
      assert.equal(firstPage.items.length, 50)
      assert.equal(secondPage.items.length, 50)
      assert.equal(thirdPage.page, 3)
      assert.equal(thirdPage.items.length, 20)
    })

    const dashboardPaidBeforeDeletion = Number(api.getDashboardStats().paymentsStats.find((row) => row.currency === 'USD')?.totalPaid || 0)
    const customerPaidBeforeDeletion = api.getCustomers().reduce((sum, row) => sum + Number(row.totalPaidUSD || 0), 0)
    assert.equal(dashboardPaidBeforeDeletion, customerPaidBeforeDeletion)
    const retainedSaleCount = database.prepare('SELECT COUNT(*) AS count FROM sales WHERE customer_id = ?').get(creditCustomerId).count
    const retainedPaymentCount = database.prepare('SELECT COUNT(*) AS count FROM payments WHERE customer_id = ?').get(creditCustomerId).count
    const retainedHistoryCount = database.prepare('SELECT COUNT(*) AS count FROM activity_history WHERE customer_id = ?').get(creditCustomerId).count
    assert.equal(api.deleteCustomer(creditCustomerId).success, true)
    assert.equal(api.getCustomers().some((row) => row.id === creditCustomerId), false)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM sales WHERE customer_id = ?').get(creditCustomerId).count, retainedSaleCount)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM payments WHERE customer_id = ?').get(creditCustomerId).count, retainedPaymentCount)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM activity_history WHERE customer_id = ?').get(creditCustomerId).count, retainedHistoryCount)
    assert.ok(api.getActivityHistory({ search: 'Akış Borç Müşteri' }).length >= 3)
    assert.throws(() => api.makeSale({ customerId: creditCustomerId, productId: scenarioProductId, quantity: 1, unitPrice: 2500 }), /Aktif müşteri/)
    assert.throws(() => api.addPayment({ customerId: creditCustomerId, amount: 100 }), /Aktif müşteri/)

    const dashboardPaidAfterDeletion = Number(api.getDashboardStats().paymentsStats.find((row) => row.currency === 'USD')?.totalPaid || 0)
    assert.equal(dashboardPaidAfterDeletion, dashboardPaidBeforeDeletion)
    api.deactivateProduct(scenarioProductId)
    api.deleteProduct(scenarioProductId)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM sales WHERE product_id = ?').get(scenarioProductId).count, 4)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM activity_history WHERE product_id = ?').get(scenarioProductId).count, 7)
  })

  check('dashboard mal alımı dönemleri başlangıç stoğu ve sonraki alışları tarihe göre topluyor', () => {
    const dates = database.prepare(`
      SELECT date('now', 'localtime') AS today,
        date('now', 'localtime', 'weekday 0', '-6 days') AS weekStart,
        date('now', 'localtime', 'start of month') AS monthStart,
        date('now', 'localtime', '-40 days') AS olderDate
    `).get()
    const before = Object.fromEntries(['today', 'week', 'month', 'all'].map((period) => [
      period,
      api.getDashboardStats({ stockPurchasePeriod: period }).stockPurchaseTotal
    ]))
    const beforeCustomRange = database.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total FROM activity_history
      WHERE event_type IN ('INITIAL_STOCK', 'STOCK_IN') AND currency = 'USD'
        AND date(created_at, 'localtime') BETWEEN @startDate AND @endDate
    `).get({ startDate: dates.weekStart, endDate: dates.today }).total
    const fixtures = [
      { sourceKey: 'test:stock-filter-opening', eventType: 'INITIAL_STOCK', date: dates.today, amount: 110 },
      { sourceKey: 'test:stock-filter-purchase', eventType: 'STOCK_IN', date: dates.today, amount: 220 },
      { sourceKey: 'test:stock-filter-week', eventType: 'STOCK_IN', date: dates.weekStart, amount: 330 },
      { sourceKey: 'test:stock-filter-month', eventType: 'INITIAL_STOCK', date: dates.monthStart, amount: 440 },
      { sourceKey: 'test:stock-filter-older', eventType: 'STOCK_IN', date: dates.olderDate, amount: 550 }
    ]
    const insert = database.prepare(`
      INSERT INTO activity_history (source_key, event_type, amount, currency, created_at)
      VALUES (@sourceKey, @eventType, @amount, 'USD', datetime(@date, 'utc'))
    `)
    for (const fixture of fixtures) insert.run(fixture)

    const expectedFor = (period) => before[period] + fixtures
      .filter(({ date }) => period === 'all'
        || (period === 'today' && date === dates.today)
        || (period === 'week' && date >= dates.weekStart && date <= dates.today)
        || (period === 'month' && date >= dates.monthStart && date <= dates.today))
      .reduce((sum, fixture) => sum + fixture.amount, 0)

    for (const period of ['today', 'week', 'month', 'all']) {
      assert.equal(api.getDashboardStats({ stockPurchasePeriod: period }).stockPurchaseTotal, expectedFor(period), `${period} mal alımı toplamı`)
    }
    const expectedCustomRange = beforeCustomRange + fixtures
      .filter(({ date }) => date >= dates.weekStart && date <= dates.today)
      .reduce((sum, fixture) => sum + fixture.amount, 0)
    assert.equal(api.getDashboardStats({
      stockPurchasePeriod: 'custom',
      stockPurchaseStartDate: dates.weekStart,
      stockPurchaseEndDate: dates.today
    }).stockPurchaseTotal, expectedCustomRange, 'özel tarih aralığı mal alımı toplamı')
    assert.equal(api.getDashboardStats({ stockPurchasePeriod: 'invalid' }).stockPurchaseTotal, expectedFor('all'))
    const chartWithTodayStockFilter = api.getDashboardStats({ paymentRangeStart: dates.today, paymentRangeEnd: dates.today, paymentGrouping: 'day', stockPurchasePeriod: 'today' })
    const chartWithAllTimeStockFilter = api.getDashboardStats({ paymentRangeStart: dates.today, paymentRangeEnd: dates.today, paymentGrouping: 'day', stockPurchasePeriod: 'all' })
    assert.deepEqual(chartWithTodayStockFilter.financialTrendStats, chartWithAllTimeStockFilter.financialTrendStats)
  })

  const seedLargeInventory = database.transaction((count) => {
    const insert = database.prepare(`INSERT INTO products
      (name, category, current_quantity, min_quantity, purchase_price, retail_price, is_active)
      VALUES (?, 'Aksesuar', 1, 0, 100, 200, 1)`)
    for (let index = 1; index <= count; index += 1) {
      insert.run(`Stres Ürün ${String(index).padStart(5, '0')}`)
    }
  })

  const seedStart = performance.now()
  seedLargeInventory(100000)
  const seedMs = Math.round(performance.now() - seedStart)

  let listMs
  check('100.000 ürünlü envanterde sayfalama, Türkçe arama ve stok filtresi doğru sonuç veriyor', () => {
    const listStart = performance.now()
    const firstPage = api.getProducts({ page: 1, pageSize: 50 })
    listMs = Math.round(performance.now() - listStart)
    assert.equal(firstPage.items.length, 50)
    assert.equal(firstPage.total, 100001)
    assert.equal(firstPage.pageCount, 2001)

    const searchResult = api.getProducts({ page: 1, pageSize: 50, search: 'ÜRÜN 49999' })
    assert.equal(searchResult.total, 1)
    assert.equal(searchResult.items[0].name, 'Stres Ürün 49999')

    const saleOptions = api.getProducts({ page: 1, pageSize: 50, activeOnly: true, inStockOnly: true })
    assert.equal(saleOptions.total, 100001)
    assert.ok(saleOptions.items.every((product) => product.isActive === 1 && product.currentQuantity > 0))

    const clampedPage = api.getProducts({ page: 999999, pageSize: 50 })
    assert.equal(clampedPage.page, clampedPage.pageCount)
    assert.equal(clampedPage.items.length, 1)
  })

  check('veritabanı bütünlüğü ve foreign key ilişkileri temiz', () => {
    assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok')
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), [])
  })

  check('uygulama yeniden açıldığında 100.000 ürün kalıcı veritabanında duruyor', () => {
    database.close()
    database = null
    const reopened = new Database(legacyPath)
    assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM products').get().count, 100005)
    assert.equal(reopened.prepare('PRAGMA integrity_check').get().integrity_check, 'ok')
    reopened.close()
  })

  console.log(`\n${passed} kontrol geçti. 100.000 kayıt ekleme: ${seedMs} ms; 50 kayıt sayfası: ${listMs} ms.`)
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  database?.close()
  app.quit()
}
