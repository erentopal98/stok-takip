import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import productCatalogSeed from './product-catalog-seed.json' with { type: 'json' }

let db = null

export function getDatabase() {
  if (db) {
    return db
  }

  const userDataPath = app.getPath('userData')

  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }

  const dbPath = join(userDataPath, 'stok-takip.db')

  db = new Database(dbPath)

  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  db.function('lower_tr', { deterministic: true }, (value) => String(value ?? '').toLocaleLowerCase('tr-TR'))

  createTables(db)

  console.log('SQLite veritabanı bağlandı:', dbPath)

  return db
}

// ... önceki kodlar aynı ...

function createTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      brand TEXT,
      compatible_model TEXT,
      color TEXT,
      barcode TEXT UNIQUE,
      sku TEXT UNIQUE,
      current_quantity INTEGER NOT NULL DEFAULT 0,
      min_quantity INTEGER NOT NULL DEFAULT 0,
      purchase_price INTEGER NOT NULL DEFAULT 0,
      retail_price INTEGER NOT NULL DEFAULT 0,
      wholesale_price INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
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

    /* --- YENİ EKLENEN TABLOLAR --- */
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      note TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      total_price INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS stock_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_key TEXT NOT NULL UNIQUE,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity_initial INTEGER NOT NULL,
      quantity_remaining INTEGER NOT NULL,
      unit_cost INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS product_brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 999
    );
    CREATE UNIQUE INDEX IF NOT EXISTS product_brands_name_unique
      ON product_brands(name COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS product_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (brand_id) REFERENCES product_brands(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS product_models_brand_name_unique
      ON product_models(brand_id, name COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 999
    );
    CREATE UNIQUE INDEX IF NOT EXISTS product_categories_name_unique
      ON product_categories(name COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS product_colors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 999
    );
    CREATE UNIQUE INDEX IF NOT EXISTS product_colors_name_unique
      ON product_colors(name COLLATE NOCASE);
  `)

  // Eski sürümlerde oluşturulan tabloları, içlerindeki kayıtları silmeden güncelle.
  const ensureColumn = (tableName, columnName, definition) => {
    const columns = database.prepare(`PRAGMA table_info(${tableName})`).all()
    if (!columns.some((column) => column.name === columnName)) {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
      return true
    }
    return false
  }

  ensureColumn('products', 'brand', 'TEXT')
  ensureColumn('products', 'compatible_model', 'TEXT')
  ensureColumn('products', 'wholesale_price', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('products', 'is_deleted', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('customers', 'is_deleted', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('products', 'updated_at', "TEXT NOT NULL DEFAULT ''")
  database.exec("UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE updated_at = ''")
  ensureColumn('sales', 'currency', "TEXT NOT NULL DEFAULT 'USD'")
  database.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
  `)
  ensureColumn('payments', 'currency', "TEXT NOT NULL DEFAULT 'USD'")

  database.exec(`
    CREATE TABLE IF NOT EXISTS activity_history (
      source_key TEXT PRIMARY KEY, event_type TEXT NOT NULL, product_id INTEGER, product_name TEXT,
      customer_id INTEGER, customer_name TEXT, quantity INTEGER NOT NULL DEFAULT 0,
      unit_price INTEGER NOT NULL DEFAULT 0, unit_cost INTEGER NOT NULL DEFAULT 0,
      total_cost INTEGER NOT NULL DEFAULT 0, cost_is_estimated INTEGER NOT NULL DEFAULT 0, amount INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD', previous_quantity INTEGER, new_quantity INTEGER,
      note TEXT, created_at TEXT NOT NULL
    )
  `)
  ensureColumn('activity_history', 'unit_cost', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('activity_history', 'total_cost', 'INTEGER NOT NULL DEFAULT 0')
  const addedCostEstimateMarker = ensureColumn('activity_history', 'cost_is_estimated', 'INTEGER NOT NULL DEFAULT 0')
  if (addedCostEstimateMarker) {
    database.prepare("UPDATE activity_history SET cost_is_estimated = 1 WHERE event_type = 'SALE'").run()
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS activity_history (
      source_key TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      product_id INTEGER,
      product_name TEXT,
      customer_id INTEGER,
      customer_name TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      unit_price INTEGER NOT NULL DEFAULT 0,
      unit_cost INTEGER NOT NULL DEFAULT 0,
      total_cost INTEGER NOT NULL DEFAULT 0,
      cost_is_estimated INTEGER NOT NULL DEFAULT 0,
      amount INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      previous_quantity INTEGER,
      new_quantity INTEGER,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS activity_history_financial_lookup
      ON activity_history(created_at, currency, event_type);

    INSERT OR IGNORE INTO activity_history (
      source_key, event_type, product_id, product_name, customer_id, customer_name,
      quantity, unit_price, unit_cost, total_cost, cost_is_estimated, amount, currency, note, created_at
    )
    SELECT
      'sale:' || s.id, 'SALE', s.product_id, p.name, s.customer_id, c.name,
      s.quantity, s.unit_price, COALESCE(p.purchase_price, 0),
      s.quantity * COALESCE(p.purchase_price, 0), 1, s.total_price, COALESCE(s.currency, 'USD'), 'Müşteriye satış', s.created_at
    FROM sales s
    LEFT JOIN products p ON p.id = s.product_id
    LEFT JOIN customers c ON c.id = s.customer_id;

    UPDATE activity_history
    SET total_cost = quantity * unit_cost
    WHERE event_type = 'SALE' AND total_cost = 0 AND unit_cost > 0;

    INSERT OR IGNORE INTO activity_history (
      source_key, event_type, customer_id, customer_name, amount, currency, note, created_at
    )
    SELECT
      'payment:' || p.id, 'PAYMENT', p.customer_id, c.name, p.amount,
      COALESCE(p.currency, 'USD'), COALESCE(p.note, 'Tahsilat'), p.created_at
    FROM payments p
    LEFT JOIN customers c ON c.id = p.customer_id;

    INSERT OR IGNORE INTO activity_history (
      source_key, event_type, product_id, product_name, quantity, unit_price, amount,
      currency, previous_quantity, new_quantity, note, created_at
    )
    SELECT
      'stock:' || sm.id,
      CASE sm.movement_type
        WHEN 'INITIAL_STOCK' THEN 'INITIAL_STOCK'
        WHEN 'STOCK_IN' THEN 'STOCK_IN'
        WHEN 'STOCK_OUT' THEN 'STOCK_OUT'
        WHEN 'PRODUCT_DEACTIVATED' THEN 'PRODUCT_DEACTIVATED'
        ELSE sm.movement_type
      END,
      sm.product_id, p.name, sm.quantity, sm.unit_price, ABS(sm.quantity) * sm.unit_price,
      'USD', sm.previous_quantity, sm.new_quantity, sm.note, sm.created_at
    FROM stock_movements sm
    LEFT JOIN products p ON p.id = sm.product_id
    WHERE NOT (sm.movement_type = 'STOCK_OUT' AND COALESCE(sm.note, '') LIKE 'Müşteriye Satış%');

    CREATE TRIGGER IF NOT EXISTS sales_to_activity_history
    AFTER INSERT ON sales
    BEGIN
      INSERT OR IGNORE INTO activity_history (
        source_key, event_type, product_id, product_name, customer_id, customer_name,
        quantity, unit_price, unit_cost, total_cost, cost_is_estimated, amount, currency, note, created_at
      ) VALUES (
        'sale:' || NEW.id, 'SALE', NEW.product_id,
        COALESCE((SELECT name FROM products WHERE id = NEW.product_id), 'Ürün kaydı bulunamadı'),
        NEW.customer_id,
        COALESCE((SELECT name FROM customers WHERE id = NEW.customer_id), 'Müşteri kaydı bulunamadı'),
        NEW.quantity, NEW.unit_price,
        COALESCE((SELECT purchase_price FROM products WHERE id = NEW.product_id), 0),
        NEW.quantity * COALESCE((SELECT purchase_price FROM products WHERE id = NEW.product_id), 0),
        1,
        NEW.total_price, COALESCE(NEW.currency, 'USD'),
        'Müşteriye satış', NEW.created_at
      );
    END;

    CREATE TRIGGER IF NOT EXISTS payments_to_activity_history
    AFTER INSERT ON payments
    BEGIN
      INSERT OR IGNORE INTO activity_history (
        source_key, event_type, customer_id, customer_name, amount, currency, note, created_at
      ) VALUES (
        'payment:' || NEW.id, 'PAYMENT', NEW.customer_id,
        COALESCE((SELECT name FROM customers WHERE id = NEW.customer_id), 'Müşteri kaydı bulunamadı'),
        NEW.amount, COALESCE(NEW.currency, 'USD'), COALESCE(NEW.note, 'Tahsilat'), NEW.created_at
      );
    END;

    CREATE TRIGGER IF NOT EXISTS stock_movements_to_activity_history
    AFTER INSERT ON stock_movements
    WHEN NOT (NEW.movement_type = 'STOCK_OUT' AND COALESCE(NEW.note, '') LIKE 'Müşteriye Satış%')
    BEGIN
      INSERT OR IGNORE INTO activity_history (
        source_key, event_type, product_id, product_name, quantity, unit_price, amount,
        currency, previous_quantity, new_quantity, note, created_at
      ) VALUES (
        'stock:' || NEW.id, NEW.movement_type, NEW.product_id,
        COALESCE((SELECT name FROM products WHERE id = NEW.product_id), 'Ürün kaydı bulunamadı'),
        NEW.quantity, NEW.unit_price, ABS(NEW.quantity) * NEW.unit_price, 'USD',
        NEW.previous_quantity, NEW.new_quantity, NEW.note, NEW.created_at
      );
    END;
  `)

  // Eski sürümlerde alışlar stock_movements tablosunda tutuluyordu. Bunları,
  // açılış stoğu özet kaydından daha ayrıntılıysa, gerçek alış partilerine dönüştür.
  const openingProducts = database.prepare(`
    SELECT id AS productId FROM products p
    WHERE EXISTS (
      SELECT 1 FROM stock_batches b WHERE b.product_id = p.id AND b.source_key LIKE 'opening:%'
    ) OR NOT EXISTS (
      SELECT 1 FROM stock_batches b WHERE b.product_id = p.id
    )
  `).all()
  const getProductForMigration = database.prepare(`
    SELECT name, current_quantity AS currentQuantity, purchase_price AS purchasePrice
    FROM products WHERE id = ?
  `)
  const getMovementsForMigration = database.prepare(`
    SELECT id, movement_type AS movementType, quantity, unit_price AS unitPrice, created_at AS createdAt
    FROM stock_movements WHERE product_id = ? ORDER BY id ASC
  `)
  const insertMigratedBatch = database.prepare(`
    INSERT OR IGNORE INTO stock_batches (
      source_key, product_id, product_name, quantity_initial, quantity_remaining, unit_cost, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const migrateOpeningBatches = database.transaction(() => {
    for (const { productId } of openingProducts) {
      const product = getProductForMigration.get(productId)
      if (!product) continue
      const movements = getMovementsForMigration.all(productId)
      const lots = []
      for (const movement of movements) {
        const delta = Number(movement.quantity)
        if (delta > 0 && ['INITIAL_STOCK', 'STOCK_IN'].includes(movement.movementType)) {
          lots.push({ sourceKey: `stock:${movement.id}`, quantity: delta, remaining: delta, cost: Number(movement.unitPrice), createdAt: movement.createdAt })
        } else if (delta < 0) {
          let toConsume = -delta
          for (const lot of lots) {
            const taken = Math.min(toConsume, lot.remaining)
            lot.remaining -= taken
            toConsume -= taken
            if (toConsume === 0) break
          }
        }
      }

      const targetQuantity = Number(product.currentQuantity)
      let reconstructedQuantity = lots.reduce((total, lot) => total + lot.remaining, 0)
      if (reconstructedQuantity > targetQuantity) {
        let toConsume = reconstructedQuantity - targetQuantity
        for (const lot of lots) {
          const taken = Math.min(toConsume, lot.remaining)
          lot.remaining -= taken
          toConsume -= taken
          if (toConsume === 0) break
        }
        reconstructedQuantity = targetQuantity
      }
      if (reconstructedQuantity < targetQuantity) {
        const remainder = targetQuantity - reconstructedQuantity
        lots.push({
          sourceKey: `opening:${productId}`, quantity: remainder, remaining: remainder,
          cost: Number(product.purchasePrice), createdAt: new Date().toISOString()
        })
      }

      database.prepare('DELETE FROM stock_batches WHERE product_id = ?').run(productId)
      for (const lot of lots) {
        if (lot.quantity <= 0) continue
        insertMigratedBatch.run(lot.sourceKey, productId, product.name, lot.quantity, lot.remaining, lot.cost, lot.createdAt)
      }
      const valuation = getStockBatchValuation(database, productId)
      database.prepare('UPDATE products SET purchase_price = ? WHERE id = ?').run(valuation.averageUnitCost, productId)
    }
  })
  migrateOpeningBatches()

  seedProductCatalog(database)
}

function getOrCreateCatalogBrand(database, name, sortOrder = 999) {
  const normalizedName = normalizeText(name)
  if (!normalizedName) return null
  const existing = database.prepare(
    'SELECT id FROM product_brands WHERE lower_tr(name) = lower_tr(?) ORDER BY id LIMIT 1'
  ).get(normalizedName)
  if (existing) return Number(existing.id)
  const result = database.prepare('INSERT INTO product_brands (name, sort_order) VALUES (?, ?)')
    .run(normalizedName, sortOrder)
  return Number(result.lastInsertRowid)
}

function rememberProductCatalog(database, brand, model) {
  const normalizedBrand = normalizeText(brand)
  const normalizedModel = normalizeText(model)
  if (!normalizedBrand) return
  const brandId = getOrCreateCatalogBrand(database, normalizedBrand)
  if (!normalizedModel) return
  const existing = database.prepare(
    'SELECT id FROM product_models WHERE brand_id = ? AND lower_tr(name) = lower_tr(?) LIMIT 1'
  ).get(brandId, normalizedModel)
  if (!existing) {
    database.prepare('INSERT INTO product_models (brand_id, name) VALUES (?, ?)').run(brandId, normalizedModel)
  }
}

const defaultProductCategories = [
  'Kılıflar', 'Ekran Koruyucu', 'Şarj Kablosu', 'Şarj Adaptörü', 'Kulaklık',
  'Powerbank', 'Araç İçi Aksesuar', 'Telefon Tutucu', 'Akıllı Saat',
  'Akıllı Saat Aksesuarı', 'Hoparlör', 'Masaüstü ve Çekim Aksesuarları',
  'Temizlik ve Bakım Ürünleri'
]
const defaultProductColors = [
  'Siyah', 'Beyaz', 'Şeffaf', 'Gri', 'Gümüş', 'Altın', 'Kırmızı', 'Mavi',
  'Lacivert', 'Yeşil', 'Sarı', 'Turuncu', 'Pembe', 'Mor', 'Kahverengi',
  'Bej', 'Titanyum', 'Çok Renkli'
]

function rememberProductCategory(database, name, sortOrder = 999) {
  const normalizedName = normalizeText(name)
  if (!normalizedName) return
  const exists = database.prepare('SELECT id FROM product_categories WHERE lower_tr(name) = lower_tr(?) LIMIT 1').get(normalizedName)
  if (!exists) database.prepare('INSERT INTO product_categories (name, sort_order) VALUES (?, ?)').run(normalizedName, sortOrder)
}

function rememberProductColor(database, name, sortOrder = 999) {
  const normalizedName = normalizeText(name)
  if (!normalizedName) return
  const exists = database.prepare('SELECT id FROM product_colors WHERE lower_tr(name) = lower_tr(?) LIMIT 1').get(normalizedName)
  if (!exists) database.prepare('INSERT INTO product_colors (name, sort_order) VALUES (?, ?)').run(normalizedName, sortOrder)
}

function seedProductCatalog(database) {
  const seedCatalog = database.transaction(() => {
    Object.entries(productCatalogSeed).forEach(([brand, models], sortOrder) => {
      getOrCreateCatalogBrand(database, brand, sortOrder)
      for (const model of models) rememberProductCatalog(database, brand, model)
    })

    defaultProductCategories.forEach((category, sortOrder) => rememberProductCategory(database, category, sortOrder))
    defaultProductColors.forEach((color, sortOrder) => rememberProductColor(database, color, sortOrder))

    const existingProducts = database.prepare(`
      SELECT DISTINCT brand, compatible_model AS model FROM products
      WHERE TRIM(COALESCE(brand, '')) <> ''
      ORDER BY brand, compatible_model
    `).all()
    for (const product of existingProducts) rememberProductCatalog(database, product.brand, product.model)
    const existingCategories = database.prepare("SELECT DISTINCT category FROM products WHERE TRIM(COALESCE(category, '')) <> ''").all()
    for (const product of existingCategories) rememberProductCategory(database, product.category)
    const existingColors = database.prepare("SELECT DISTINCT color FROM products WHERE TRIM(COALESCE(color, '')) <> ''").all()
    for (const product of existingColors) rememberProductColor(database, product.color)
  })
  seedCatalog()
}

export function getProductCatalog(brandName = '') {
  const database = getDatabase()
  const brands = database.prepare(`
    SELECT name FROM product_brands
    ORDER BY sort_order ASC, lower_tr(name) ASC, name ASC
  `).all().map((row) => row.name)
  const categories = database.prepare('SELECT name FROM product_categories ORDER BY sort_order ASC, lower_tr(name), name').all().map((row) => row.name)
  const colors = database.prepare('SELECT name FROM product_colors ORDER BY sort_order ASC, lower_tr(name), name').all().map((row) => row.name)
  const brand = normalizeText(brandName)
  if (!brand) return { brands, models: [], categories, colors }
  const models = database.prepare(`
    SELECT model.name FROM product_models model
    INNER JOIN product_brands brand ON brand.id = model.brand_id
    WHERE lower_tr(brand.name) = lower_tr(?)
    ORDER BY lower_tr(model.name), model.name
  `).all(brand).map((row) => row.name)
  return { brands, models, categories, colors }
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null
  }

  const text = String(value).trim()

  return text.length > 0 ? text : null
}

function normalizeNumber(value, defaultValue = 0) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return defaultValue
  }

  return numberValue
}

function normalizePositiveInteger(value, fieldName) {
  const numberValue = Number(value)

  if (!Number.isSafeInteger(numberValue)) {
    throw new Error(`${fieldName} tam sayı olmalıdır.`)
  }

  if (numberValue <= 0) {
    throw new Error(`${fieldName} 0'dan büyük olmalıdır.`)
  }

  return numberValue
}

function insertStockBatch(database, batch) {
  if (!batch.quantity || batch.quantity <= 0) return
  database.prepare(`
    INSERT INTO stock_batches (
      source_key, product_id, product_name, quantity_initial, quantity_remaining, unit_cost, created_at
    ) VALUES (
      @sourceKey, @productId, @productName, @quantity, @quantity, @unitCost, COALESCE(@createdAt, CURRENT_TIMESTAMP)
    )
  `).run({ ...batch, createdAt: batch.createdAt ?? null })
}

function consumeStockBatches(database, productId, quantity) {
  let remaining = quantity
  let totalCost = 0
  const batches = database.prepare(`
    SELECT id, quantity_remaining AS quantityRemaining, unit_cost AS unitCost
    FROM stock_batches
    WHERE product_id = ? AND quantity_remaining > 0
    ORDER BY created_at ASC, id ASC
  `).all(productId)

  for (const batch of batches) {
    if (remaining === 0) break
    const taken = Math.min(remaining, Number(batch.quantityRemaining))
    database.prepare('UPDATE stock_batches SET quantity_remaining = quantity_remaining - ? WHERE id = ?').run(taken, batch.id)
    totalCost += taken * Number(batch.unitCost)
    remaining -= taken
  }

  if (remaining > 0) {
    throw new Error('Stok maliyet partileri mevcut stokla eşleşmiyor. Stok sayımını kontrol edin.')
  }
  return { totalCost, unitCost: Math.round(totalCost / quantity) }
}

function getStockBatchValuation(database, productId) {
  const result = database.prepare(`
    SELECT
      COALESCE(SUM(quantity_remaining), 0) AS quantity,
      COALESCE(SUM(quantity_remaining * unit_cost), 0) AS value
    FROM stock_batches
    WHERE product_id = ? AND quantity_remaining > 0
  `).get(productId)
  return {
    quantity: Number(result.quantity),
    value: Number(result.value),
    averageUnitCost: Number(result.quantity) > 0 ? Math.round(Number(result.value) / Number(result.quantity)) : 0
  }
}

export function testDatabaseConnection() {
  const database = getDatabase()

  const result = database
    .prepare("SELECT datetime('now', 'localtime') AS currentTime")
    .get()

  return {
    success: true,
    message: 'SQLite bağlantısı başarılı',
    now: result.currentTime
  }
}

export function getProducts(options = null) {
  const database = getDatabase()
  const search = String(options?.search || '').trim().toLocaleLowerCase('tr-TR')
  const pageSize = Math.min(Math.max(Math.floor(Number(options?.pageSize) || 50), 1), 200)
  const requestedPage = Math.max(Math.floor(Number(options?.page) || 1), 1)
  const brand = String(options?.brand || '').trim()
  const category = String(options?.category || '').trim()
  const compatibleModel = String(options?.compatibleModel || '').trim()
  const sortColumns = {
    name: { column: 'name', expression: "lower_tr(COALESCE(name, ''))", text: true },
    brand: { column: 'brand', expression: "lower_tr(COALESCE(brand, ''))", text: true },
    category: { column: 'category', expression: "lower_tr(COALESCE(category, ''))", text: true },
    color: { column: 'color', expression: "lower_tr(COALESCE(color, ''))", text: true },
    stock: { expression: 'current_quantity', text: false },
    purchasePrice: { expression: 'purchase_price', text: false }
  }
  const sortKey = Object.hasOwn(sortColumns, options?.sortBy) ? options.sortBy : 'name'
  const selectedSort = sortColumns[sortKey]
  const sortDirection = String(options?.sortDirection).toLowerCase() === 'desc' ? 'DESC' : 'ASC'
  const productOrder = selectedSort.text
    ? `CASE WHEN TRIM(COALESCE(${selectedSort.column}, '')) = '' THEN 1 ELSE 0 END ASC, ${selectedSort.expression} ${sortDirection}, id DESC`
    : `${selectedSort.expression} ${sortDirection}, lower_tr(COALESCE(name, '')) ASC, id DESC`
  const where = options?.includeDeleted ? [] : ['is_deleted = 0']
  if (search) where.push(`(instr(lower_tr(COALESCE(name, '')), @search) > 0
        OR instr(lower_tr(COALESCE(category, '')), @search) > 0
        OR instr(lower_tr(COALESCE(brand, '')), @search) > 0
        OR instr(lower_tr(COALESCE(compatible_model, '')), @search) > 0)`)
  if (options?.activeOnly) where.push('is_active = 1')
  if (options?.inStockOnly) where.push('current_quantity > 0')
  if (brand) where.push('brand = @brand')
  if (category) where.push('category = @category')
  if (compatibleModel) where.push('compatible_model = @compatibleModel')
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const parameters = { ...(search ? { search } : {}), ...(brand ? { brand } : {}), ...(category ? { category } : {}), ...(compatibleModel ? { compatibleModel } : {}) }

  const columns = `
    id, name, category, brand, compatible_model AS compatibleModel, color, barcode, sku,
    purchase_price AS purchasePrice, retail_price AS retailPrice,
    wholesale_price AS wholesalePrice, current_quantity AS currentQuantity,
    min_quantity AS minQuantity, is_active AS isActive,
    created_at AS createdAt, updated_at AS updatedAt
  `

  if (!options) {
      return database.prepare(`SELECT ${columns} FROM products WHERE is_deleted = 0 ORDER BY created_at DESC, id DESC`).all()
  }

  const total = database.prepare(`SELECT COUNT(*) AS total FROM products ${whereClause}`).get(parameters).total
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, pageCount)
  const items = database.prepare(`
    SELECT ${columns}
    FROM products ${whereClause}
      ORDER BY ${productOrder}
    LIMIT @limit OFFSET @offset
  `).all({ ...parameters, limit: pageSize, offset: (page - 1) * pageSize })

  const brands = database.prepare(`
    SELECT DISTINCT TRIM(brand) AS value FROM products
    WHERE is_deleted = 0 AND brand IS NOT NULL AND TRIM(brand) <> ''
    ORDER BY lower_tr(TRIM(brand)), TRIM(brand)
  `).all().map((row) => row.value)
  const categories = database.prepare(`
    SELECT DISTINCT TRIM(category) AS value FROM products
    WHERE is_deleted = 0 AND category IS NOT NULL AND TRIM(category) <> ''
    ORDER BY lower_tr(TRIM(category)), TRIM(category)
  `).all().map((row) => row.value)
  const names = database.prepare(`
    SELECT DISTINCT TRIM(name) AS value FROM products
    WHERE is_deleted = 0 AND name IS NOT NULL AND TRIM(name) <> ''
    ORDER BY lower_tr(TRIM(name)), TRIM(name)
  `).all().map((row) => row.value)

  const models = database.prepare(`
    SELECT DISTINCT TRIM(compatible_model) AS value FROM products
    WHERE is_deleted = 0 AND compatible_model IS NOT NULL AND TRIM(compatible_model) <> ''
    ORDER BY lower_tr(TRIM(compatible_model)), TRIM(compatible_model)
  `).all().map((row) => row.value)

  const colors = database.prepare(`
    SELECT DISTINCT TRIM(color) AS value FROM products
    WHERE color IS NOT NULL AND TRIM(color) <> ''
    ORDER BY lower_tr(TRIM(color)), TRIM(color)
  `).all().map((row) => row.value)

  return { items, total, page, pageSize, pageCount, brands, categories, names, models, colors }
}

export function getProductStockBatches(productId) {
  const database = getDatabase()
  const id = Number(productId)
  const product = database.prepare(`
    SELECT id, current_quantity AS currentQuantity FROM products
    WHERE id = ? AND is_deleted = 0
  `).get(id)
  if (!product) throw new Error('Ürün bulunamadı.')

  const batches = database.prepare(`
    SELECT quantity_initial AS quantity, quantity_remaining AS remainingQuantity,
      unit_cost AS unitCost, created_at AS createdAt
    FROM stock_batches WHERE product_id = ? ORDER BY created_at ASC, id ASC
  `).all(id)
  const totalPurchasedQuantity = batches.reduce((total, batch) => total + Number(batch.quantity), 0)
  const totalPurchaseCost = batches.reduce((total, batch) => total + Number(batch.quantity) * Number(batch.unitCost), 0)
  const valuation = getStockBatchValuation(database, id)
  return {
    batches, totalPurchasedQuantity, totalPurchaseCost,
    currentQuantity: Number(product.currentQuantity),
    currentInventoryCost: valuation.value,
    averageUnitCost: valuation.averageUnitCost
  }
}

export function addProduct(product) {
  const database = getDatabase()

  const name = normalizeText(product.name)

  if (!name) {
    throw new Error('Ürün adı boş bırakılamaz.')
  }

  if (product.currentQuantity === undefined || product.currentQuantity === null || String(product.currentQuantity).trim() === '') {
    throw new Error('Başlangıç stoğu boş bırakılamaz.')
  }
  if (product.purchasePrice === undefined || product.purchasePrice === null || String(product.purchasePrice).trim() === '') {
    throw new Error('Alış fiyatı boş bırakılamaz.')
  }

  const brand = normalizeText(product.brand)
  const compatibleModel = normalizeText(product.compatibleModel)
  const color = normalizeText(product.color)
  const duplicate = database.prepare(`
    SELECT id FROM products
    WHERE is_active = 1 AND is_deleted = 0
      AND lower_tr(TRIM(name)) = lower_tr(?)
      AND lower_tr(TRIM(COALESCE(brand, ''))) = lower_tr(?)
      AND lower_tr(TRIM(COALESCE(compatible_model, ''))) = lower_tr(?)
      AND lower_tr(TRIM(COALESCE(color, ''))) = lower_tr(?)
    LIMIT 1
  `).get(name, brand || '', compatibleModel || '', color || '')
  if (duplicate) {
    throw new Error('Bu ürün zaten ekli. Mevcut ürün üzerinden stok güncelleyin.')
  }

  const currentQuantity = normalizeNumber(product.currentQuantity, 0)
  const minQuantity = normalizeNumber(product.minQuantity, 0)
  const purchasePrice = normalizeNumber(product.purchasePrice, 0)
  const retailPrice = normalizeNumber(product.retailPrice, 0)
  const wholesalePrice = normalizeNumber(product.wholesalePrice, 0)

  if (!Number.isSafeInteger(currentQuantity) || currentQuantity < 0) {
    throw new Error('Stok adedi negatif olamaz ve tam sayı olmalıdır.')
  }

  if (!Number.isSafeInteger(minQuantity) || minQuantity < 0) {
    throw new Error('Minimum stok negatif olamaz ve tam sayı olmalıdır.')
  }

  if (![purchasePrice, retailPrice, wholesalePrice].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error('Fiyat bilgileri kuruş cinsinden, negatif olmayan tam sayı olmalıdır.')
  }

  const insertProduct = database.prepare(`
    INSERT INTO products (
      name,
      category,
      brand,
      compatible_model,
      color,
      barcode,
      sku,
      current_quantity,
      min_quantity,
      purchase_price,
      retail_price,
      wholesale_price,
      updated_at
    )
    VALUES (
      @name,
      @category,
      @brand,
      @compatibleModel,
      @color,
      @barcode,
      @sku,
      @currentQuantity,
      @minQuantity,
      @purchasePrice,
      @retailPrice,
      @wholesalePrice,
      CURRENT_TIMESTAMP
    )
  `)

  const insertStockMovement = database.prepare(`
    INSERT INTO stock_movements (
      product_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      unit_price,
      note
    )
    VALUES (
      @productId,
      @movementType,
      @quantity,
      @previousQuantity,
      @newQuantity,
      @unitPrice,
      @note
    )
  `)

  const createProductTransaction = database.transaction(() => {
    rememberProductCatalog(database, brand, compatibleModel)
    rememberProductCategory(database, product.category)
    rememberProductColor(database, product.color)
    const result = insertProduct.run({
      name,
      category: normalizeText(product.category),
      brand,
      compatibleModel,
      color,
      barcode: normalizeText(product.barcode),
      sku: normalizeText(product.sku),
      currentQuantity,
      minQuantity,
      purchasePrice,
      retailPrice,
      wholesalePrice
    })

    const productId = Number(result.lastInsertRowid)

    if (currentQuantity > 0) {
      const movement = insertStockMovement.run({
        productId,
        movementType: 'INITIAL_STOCK',
        quantity: currentQuantity,
        previousQuantity: 0,
        newQuantity: currentQuantity,
        unitPrice: purchasePrice,
        note: 'İlk ürün kaydı sırasında oluşturulan başlangıç stoku'
      })
      insertStockBatch(database, {
        sourceKey: `stock:${movement.lastInsertRowid}`,
        productId,
        productName: name,
        quantity: currentQuantity,
        unitCost: purchasePrice
      })
    }

    return {
      success: true,
      id: productId
    }
  })

  try {
    return createProductTransaction()
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: products.barcode')) {
      throw new Error('Bu barkod başka bir üründe kullanılıyor.', { cause: error })
    }

    if (error.message.includes('UNIQUE constraint failed: products.sku')) {
      throw new Error('Bu stok kodu başka bir üründe kullanılıyor.', { cause: error })
    }

    throw error
  }
}

export function updateStock(payload) {
  const database = getDatabase()

  const productId = Number(payload.productId)
  const movementType = normalizeText(payload.movementType)
  const quantity = normalizePositiveInteger(payload.quantity, 'İşlem adedi')
  const unitPrice = normalizeNumber(payload.unitPrice, 0)
  const note = normalizeText(payload.note)

  if (!productId) {
    throw new Error('Ürün seçilmedi.')
  }

  if (!['STOCK_IN', 'STOCK_OUT'].includes(movementType)) {
    throw new Error('Geçersiz stok işlem türü.')
  }

  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) {
    throw new Error('Birim fiyat kuruş cinsinden, negatif olmayan tam sayı olmalıdır.')
  }

  const getProductStatement = database.prepare(`
    SELECT
      id,
      name,
      current_quantity AS currentQuantity
    FROM products
    WHERE id = ?
      AND is_active = 1
  `)

  const updateProductStatement = database.prepare(`
    UPDATE products
    SET
      current_quantity = @newQuantity,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @productId
  `)
  const updatePurchasePriceStatement = database.prepare(`
    UPDATE products SET purchase_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `)

  const insertMovementStatement = database.prepare(`
    INSERT INTO stock_movements (
      product_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      unit_price,
      note
    )
    VALUES (
      @productId,
      @movementType,
      @quantity,
      @previousQuantity,
      @newQuantity,
      @unitPrice,
      @note
    )
  `)

  const stockTransaction = database.transaction(() => {
    const product = getProductStatement.get(productId)

    if (!product) {
      throw new Error('Ürün bulunamadı veya pasif durumda.')
    }

    const previousQuantity = Number(product.currentQuantity)
    const signedQuantity = movementType === 'STOCK_IN' ? quantity : -quantity
    const newQuantity = previousQuantity + signedQuantity

    if (newQuantity < 0) {
      throw new Error(
        `Stok yetersiz. Mevcut stok: ${previousQuantity}, çıkış yapılmak istenen adet: ${quantity}`
      )
    }

    const actualUnitCost = movementType === 'STOCK_OUT'
      ? consumeStockBatches(database, productId, quantity).unitCost
      : unitPrice

    updateProductStatement.run({ productId, newQuantity })
    const movement = insertMovementStatement.run({
      productId,
      movementType,
      quantity: signedQuantity,
      previousQuantity,
      newQuantity,
      unitPrice: actualUnitCost,
      note
    })

    if (movementType === 'STOCK_IN') {
      insertStockBatch(database, {
        sourceKey: `stock:${movement.lastInsertRowid}`,
        productId,
        productName: product.name,
        quantity,
        unitCost: unitPrice
      })
    }

    const valuation = getStockBatchValuation(database, productId)
    updatePurchasePriceStatement.run(valuation.averageUnitCost, productId)

    return {
      success: true,
      productId,
      previousQuantity,
      newQuantity
    }
  })

  return stockTransaction()
}

export function deactivateProduct(productId) {
  const database = getDatabase()

  const id = Number(productId)

  if (!id) {
    throw new Error('Ürün seçilmedi.')
  }

  const getProductStatement = database.prepare(`
    SELECT
      id,
      name,
      current_quantity AS currentQuantity
    FROM products
    WHERE id = ?
      AND is_active = 1
  `)

  const deactivateStatement = database.prepare(`
    UPDATE products
    SET
      is_active = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

  const insertMovementStatement = database.prepare(`
    INSERT INTO stock_movements (
      product_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      unit_price,
      note
    )
    VALUES (
      @productId,
      @movementType,
      @quantity,
      @previousQuantity,
      @newQuantity,
      @unitPrice,
      @note
    )
  `)

  const deactivateTransaction = database.transaction(() => {
    const product = getProductStatement.get(id)

    if (!product) {
      throw new Error('Ürün bulunamadı veya zaten pasif.')
    }

    deactivateStatement.run(id)

    insertMovementStatement.run({
      productId: id,
      movementType: 'PRODUCT_DEACTIVATED',
      quantity: 0,
      previousQuantity: product.currentQuantity,
      newQuantity: product.currentQuantity,
      unitPrice: 0,
      note: 'Ürün pasife alındı'
    })

    return {
      success: true,
      id
    }
  })

  return deactivateTransaction()
}

export function deleteProduct(productId) {
  const database = getDatabase()
  const id = Number(productId)

  if (!id) {
    throw new Error('Ürün seçilmedi.')
  }

  const deleteTransaction = database.transaction(() => {
    const product = database.prepare('SELECT id, is_active AS isActive, is_deleted AS isDeleted FROM products WHERE id = ?').get(id)

    if (!product) {
      throw new Error('Ürün bulunamadı.')
    }

    if (product.isActive) {
      throw new Error('Bir ürünü kalıcı olarak silmeden önce pasife almalısınız.')
    }
    if (product.isDeleted) throw new Error('Ürün envanterden zaten kaldırılmış.')

    // Keep the product row and linked transactions to preserve balances and referential history.
    database.prepare(`
      UPDATE products SET is_deleted = 1, is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id)

    return { success: true, id }
  })

  return deleteTransaction()
}

// electron/database.js dosyasının EN ALTINA ekleyin

export function updateProduct(product) {
  const database = getDatabase()

  const id = Number(product.id)
  if (!id) throw new Error('Güncellenecek ürün seçilmedi.')

  const name = normalizeText(product.name)
  if (!name) throw new Error('Ürün adı boş bırakılamaz.')

  const minQuantity = normalizeNumber(product.minQuantity, 0)
  const purchasePrice = normalizeNumber(product.purchasePrice, 0)
  const retailPrice = normalizeNumber(product.retailPrice, 0)
  const wholesalePrice = normalizeNumber(product.wholesalePrice, 0)

  if (!Number.isSafeInteger(minQuantity) || minQuantity < 0) {
    throw new Error('Minimum stok negatif olamaz ve tam sayı olmalıdır.')
  }
  if (![purchasePrice, retailPrice, wholesalePrice].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error('Fiyat bilgileri kuruş cinsinden, negatif olmayan tam sayı olmalıdır.')
  }

  const updateStatement = database.prepare(`
    UPDATE products SET
      name = @name,
      category = @category,
      brand = @brand,
      compatible_model = @compatibleModel,
      color = @color,
      barcode = @barcode,
      sku = @sku,
      current_quantity = @currentQuantity,
      min_quantity = @minQuantity,
      purchase_price = @purchasePrice,
      retail_price = @retailPrice,
      wholesale_price = @wholesalePrice,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `)
  const getCurrentProduct = database.prepare(`
    SELECT name, current_quantity AS currentQuantity, is_active AS isActive, is_deleted AS isDeleted
    FROM products WHERE id = ?
  `)
  const insertAdjustmentMovement = database.prepare(`
    INSERT INTO stock_movements (
      product_id, movement_type, quantity, previous_quantity, new_quantity, unit_price, note
    ) VALUES (@productId, @movementType, @quantity, @previousQuantity, @newQuantity, @unitPrice, @note)
  `)

  try {
    const updateTransaction = database.transaction(() => {
      const existing = getCurrentProduct.get(id)
      if (!existing || !existing.isActive || existing.isDeleted) throw new Error('Aktif ürün bulunamadı.')
      rememberProductCatalog(database, product.brand, product.compatibleModel)
      rememberProductCategory(database, product.category)
      rememberProductColor(database, product.color)
      const currentQuantity = Number(existing.currentQuantity)
      const requestedQuantity = product.currentQuantity === undefined
        ? currentQuantity
        : Number(product.currentQuantity)
      if (!Number.isSafeInteger(requestedQuantity) || requestedQuantity < 0) {
        throw new Error('Stok adedi negatif olamaz ve tam sayı olmalıdır.')
      }

      const difference = requestedQuantity - currentQuantity
      let adjustmentUnitCost = purchasePrice
      if (difference < 0) {
      adjustmentUnitCost = consumeStockBatches(database, id, -difference).unitCost
      }

      updateStatement.run({
        id,
        name,
        category: normalizeText(product.category),
        brand: normalizeText(product.brand),
        compatibleModel: normalizeText(product.compatibleModel),
        color: normalizeText(product.color),
        barcode: normalizeText(product.barcode),
        sku: normalizeText(product.sku),
        currentQuantity: requestedQuantity,
        minQuantity,
        purchasePrice,
        retailPrice,
        wholesalePrice
      })

      if (difference !== 0) {
        const movement = insertAdjustmentMovement.run({
          productId: id,
          movementType: difference > 0 ? 'STOCK_IN' : 'STOCK_OUT',
          quantity: difference,
          previousQuantity: currentQuantity,
          newQuantity: requestedQuantity,
          unitPrice: adjustmentUnitCost,
          note: 'Ürün düzenlemesinden stok adedi düzeltmesi'
        })
        if (difference > 0) {
          insertStockBatch(database, {
            sourceKey: `stock:${movement.lastInsertRowid}`,
            productId: id,
            productName: name,
            quantity: difference,
            unitCost: purchasePrice
          })
        }
      }
      const valuation = getStockBatchValuation(database, id)
      database.prepare('UPDATE products SET purchase_price = ? WHERE id = ?').run(valuation.averageUnitCost, id)
    })

    updateTransaction()

    return { success: true, id }
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: products.barcode')) {
      throw new Error('Bu barkod başka bir üründe kullanılıyor.', { cause: error })
    }
    if (error.message.includes('UNIQUE constraint failed: products.sku')) {
      throw new Error('Bu stok kodu başka bir üründe kullanılıyor.', { cause: error })
    }
    throw error
  }
}

// --- MÜŞTERİ, SATIŞ VE ÖDEME FONKSİYONLARI ---

export function getCustomers() {
  const db = getDatabase();
  
  // Tablo yapıları
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, email TEXT, note TEXT, is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL, total_price INTEGER NOT NULL, currency TEXT DEFAULT 'USD', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES customers(id), FOREIGN KEY (product_id) REFERENCES products(id));
    CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, amount INTEGER NOT NULL, currency TEXT DEFAULT 'USD', note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES customers(id));
  `);

  return db.prepare(`
    SELECT 
      c.id, c.name, c.phone, c.email, c.note, c.created_at AS createdAt,
      IFNULL((SELECT SUM(total_price) FROM sales WHERE customer_id = c.id AND currency = 'USD'), 0) AS totalSalesUSD,
      IFNULL((SELECT SUM(amount) FROM payments WHERE customer_id = c.id AND currency = 'USD'), 0) AS totalPaidUSD,
      IFNULL((SELECT SUM(total_price) FROM sales WHERE customer_id = c.id AND currency = 'TL'), 0) AS totalSalesTL,
      IFNULL((SELECT SUM(amount) FROM payments WHERE customer_id = c.id AND currency = 'TL'), 0) AS totalPaidTL
    FROM customers c
    WHERE c.is_deleted = 0
    ORDER BY c.name ASC
  `).all();
}

export function addCustomer(customer) {
  const db = getDatabase();
  const name = customer.name ? customer.name.trim() : '';
  const phone = customer.phone ? customer.phone.trim() : '';
  if (!name) throw new Error("Müşteri adı boş olamaz.");
  if (!/^0\d{10}$/.test(phone)) throw new Error('Müşteri telefonu zorunludur ve 0 ile başlayan 11 haneli numara olmalıdır.');

  const result = db.prepare(`
    INSERT INTO customers (name, phone, email, note)
    VALUES (@name, @phone, @email, @note)
  `).run({
    name,
    phone,
    email: customer.email ? customer.email.trim() : '',
    note: customer.note ? customer.note.trim() : ''
  });
  return { success: true, id: result.lastInsertRowid };
}

export function makeSale(payload) {
  const db = getDatabase();
  const customerId = Number(payload.customerId);
  const productId = Number(payload.productId);
  const quantity = Number(payload.quantity);
  const unitPrice = Number(payload.unitPrice);
  const totalPrice = quantity * unitPrice;
  const currency = 'USD';

  if (!customerId) throw new Error('Müşteri seçilmedi.');
  if (!productId) throw new Error('Ürün seçilmedi.');
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Geçerli bir adet giriniz.');
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || !Number.isSafeInteger(totalPrice)) {
    throw new Error('Geçerli ve güvenli bir satış fiyatı giriniz.');
  }

  const getProduct = db.prepare('SELECT current_quantity FROM products WHERE id = ? AND is_active = 1 AND is_deleted = 0');
  const getCustomer = db.prepare('SELECT id FROM customers WHERE id = ? AND is_deleted = 0');
  const updateProduct = db.prepare('UPDATE products SET current_quantity = @newQuantity, updated_at = CURRENT_TIMESTAMP WHERE id = @id');
  
  const insertSale = db.prepare(`
    INSERT INTO sales (customer_id, product_id, quantity, unit_price, total_price, currency)
    VALUES (@customerId, @productId, @quantity, @unitPrice, @totalPrice, @currency)
  `);
  const updateSaleHistoryStock = db.prepare(`
    UPDATE activity_history
    SET previous_quantity = @previousQuantity, new_quantity = @newQuantity,
        unit_cost = @unitCost, total_cost = @totalCost, cost_is_estimated = 0
    WHERE source_key = @sourceKey
  `);
  
  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (product_id, movement_type, quantity, previous_quantity, new_quantity, unit_price, note)
    VALUES (@productId, 'STOCK_OUT', @quantity, @prevQty, @newQty, @unitPrice, @note)
  `);

  const saleTransaction = db.transaction(() => {
    if (!getCustomer.get(customerId)) throw new Error('Aktif müşteri bulunamadı.');
    const product = getProduct.get(productId);
    if (!product) throw new Error("Ürün bulunamadı.");
    const prevQty = Number(product.current_quantity);
    const newQty = prevQty - quantity;
    if (newQty < 0) throw new Error(`Yetersiz stok! Mevcut stok: ${prevQty}`);

    const { unitCost, totalCost } = consumeStockBatches(db, productId, quantity);
    const sale = insertSale.run({ customerId, productId, quantity, unitPrice, totalPrice, currency });
    updateProduct.run({ newQuantity: newQty, id: productId });
    const valuation = getStockBatchValuation(db, productId);
    db.prepare('UPDATE products SET purchase_price = ? WHERE id = ?').run(valuation.averageUnitCost, productId);
    updateSaleHistoryStock.run({
      sourceKey: `sale:${sale.lastInsertRowid}`,
      previousQuantity: prevQty,
      newQuantity: newQty,
      unitCost,
      totalCost
    });
    insertMovement.run({ productId, quantity: -quantity, prevQty, newQty, unitPrice, note: 'Müşteriye Satış (' + currency + ')' });
    return { success: true };
  });

  return saleTransaction();
}

export function getCustomerSales(customerId) {
  return getDatabase().prepare(`
    SELECT s.id, s.quantity, s.unit_price AS unitPrice, s.total_price AS totalPrice, s.created_at AS createdAt, s.currency,
           p.name AS productName, p.category, p.color
    FROM sales s
    INNER JOIN products p ON s.product_id = p.id
    WHERE s.customer_id = ?
    ORDER BY s.created_at DESC
  `).all(Number(customerId));
}

// Ödeme fonksiyonlarına Para Birimi (currency) eklendi
export function addPayment(payload) {
  const db = getDatabase();
  const customerId = Number(payload.customerId);
  const amount = Number(payload.amount);
  const currency = 'USD';
  
  if (!customerId) throw new Error('Müşteri seçilmedi.');
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Geçerli bir ödeme tutarı giriniz.');

  const addPaymentTransaction = db.transaction(() => {
    if (!db.prepare('SELECT id FROM customers WHERE id = ? AND is_deleted = 0').get(customerId)) {
      throw new Error('Aktif müşteri bulunamadı.');
    }
    const remaining = Number(db.prepare(`
      SELECT
      IFNULL((SELECT SUM(total_price) FROM sales WHERE customer_id = ? AND currency = 'USD'), 0)
      - IFNULL((SELECT SUM(amount) FROM payments WHERE customer_id = ? AND currency = 'USD'), 0) AS remaining
    `).get(customerId, customerId).remaining);

    if (amount > remaining) {
      throw new Error(`Tahsilat tutarı kalan borçtan (${(remaining / 100).toFixed(2)} $) fazla olamaz.`);
    }

    const result = db.prepare(`
    INSERT INTO payments (customer_id, amount, note, currency)
    VALUES (@customerId, @amount, @note, @currency)
    `).run({
      customerId,
      amount,
      currency,
      note: payload.note ? payload.note.trim() : 'Nakit Tahsilat'
    });

    if (amount === remaining) {
      const customer = db.prepare('SELECT name FROM customers WHERE id = ?').get(customerId);
      db.prepare(`
        INSERT OR IGNORE INTO activity_history (
          source_key, event_type, customer_id, customer_name, amount, currency, note, created_at
        ) VALUES (
          @sourceKey, 'DEBT_SETTLED', @customerId, @customerName, 0, @currency,
          'Müşterinin borcu tamamen kapandı', CURRENT_TIMESTAMP
        )
      `).run({
        sourceKey: `debt-settled:${result.lastInsertRowid}`,
        customerId,
        customerName: customer?.name || 'Müşteri kaydı bulunamadı',
        currency
      });
    }

    return { success: true, id: result.lastInsertRowid };
  });

  return addPaymentTransaction();
}

export function getCustomerPayments(customerId) {
  return getDatabase().prepare(`
    SELECT id, amount, note, created_at AS createdAt, currency
    FROM payments
    WHERE customer_id = ?
    ORDER BY created_at DESC
  `).all(Number(customerId));
}

export function getActivityHistory(options = {}) {
  const database = getDatabase()
  const clauses = []
  const parameters = {}
  const month = String(options.month || '')

  if (month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Geçerli bir ay ve yıl seçin.')
    const [year, monthNumber] = month.split('-').map(Number)
    const startDate = `${month}-01`
    const endDate = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10)
    clauses.push("date(created_at, 'localtime') >= @startDate AND date(created_at, 'localtime') < @endDate")
    parameters.startDate = startDate
    parameters.endDate = endDate
  }

  const validDate = (value) => {
    const text = String(value || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
    const date = new Date(`${text}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null
  }
  const startDate = options.startDate ? validDate(options.startDate) : null
  const endDate = options.endDate ? validDate(options.endDate) : null
  if (options.startDate && !startDate) throw new Error('Başlangıç tarihi geçersiz.')
  if (options.endDate && !endDate) throw new Error('Bitiş tarihi geçersiz.')
  if (startDate && endDate && startDate > endDate) throw new Error('Başlangıç tarihi bitiş tarihinden sonra olamaz.')
  if (startDate) {
    clauses.push("date(created_at, 'localtime') >= @startDate")
    parameters.startDate = startDate
  }
  if (endDate) {
    clauses.push("date(created_at, 'localtime') <= @endDate")
    parameters.endDate = endDate
  }

  const eventType = String(options.eventType || '').trim()
  const allowedTypes = new Set(['SALE', 'PAYMENT', 'DEBT_SETTLED', 'STOCK_IN', 'STOCK_OUT', 'INITIAL_STOCK', 'PRODUCT_DEACTIVATED'])
  if (eventType && eventType !== 'STOCK' && !allowedTypes.has(eventType)) throw new Error('Geçersiz işlem türü.')
  if (eventType === 'STOCK') clauses.push("event_type IN ('INITIAL_STOCK', 'STOCK_IN', 'STOCK_OUT', 'PRODUCT_DEACTIVATED')")
  else if (eventType) {
    clauses.push('event_type = @eventType')
    parameters.eventType = eventType
  }

  const search = String(options.search || '').trim().toLocaleLowerCase('tr-TR')
  if (search) {
    clauses.push(`(
      instr(lower_tr(COALESCE(customer_name, '')), @search) > 0
      OR instr(lower_tr(COALESCE(product_name, '')), @search) > 0
      OR instr(lower_tr(COALESCE(note, '')), @search) > 0
      OR instr(lower_tr(CASE event_type
        WHEN 'SALE' THEN 'Satış'
        WHEN 'PAYMENT' THEN 'Tahsilat'
        WHEN 'DEBT_SETTLED' THEN 'Borç Kapandı'
        WHEN 'STOCK_IN' THEN 'Stok Girişi'
        WHEN 'STOCK_OUT' THEN 'Stok Çıkışı'
        WHEN 'INITIAL_STOCK' THEN 'İlk Stok'
        WHEN 'PRODUCT_DEACTIVATED' THEN 'Ürün Pasife Alındı'
        ELSE event_type END), @search) > 0
    )`)
    parameters.search = search
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const paginated = options.page !== undefined
  const pageSize = Math.min(200, Math.max(1, Math.trunc(Number(options.pageSize) || 50)))
  const matchedTotal = paginated
    ? Number(database.prepare(`SELECT COUNT(*) AS total FROM activity_history ${whereClause}`).get(parameters).total)
    : null
  const total = paginated ? matchedTotal : null
  const pageCount = paginated ? Math.max(1, Math.ceil(total / pageSize)) : null
  const page = paginated ? Math.min(Math.max(1, Math.trunc(Number(options.page) || 1)), pageCount) : null
  const hasExplicitLimit = Number.isSafeInteger(Number(options.limit)) && Number(options.limit) > 0
  const limit = paginated ? pageSize : hasExplicitLimit ? Number(options.limit) : (month || options.allTime || startDate || endDate || search || eventType ? null : 50)
  const limitClause = limit ? `LIMIT @limit${paginated ? ' OFFSET @offset' : ''}` : ''

  const items = database.prepare(`
    SELECT
      rowid AS id,
      source_key AS sourceKey,
      event_type AS eventType,
      product_id AS productId,
      product_name AS productName,
      customer_id AS customerId,
      customer_name AS customerName,
      quantity,
      unit_price AS unitPrice,
      amount,
      currency,
      previous_quantity AS previousQuantity,
      new_quantity AS newQuantity,
      note,
      created_at AS createdAt
    FROM activity_history
    ${whereClause}
    ORDER BY created_at DESC, rowid DESC
    ${limitClause}
  `).all({ ...parameters, ...(limit ? { limit } : {}), ...(paginated ? { offset: (page - 1) * pageSize } : {}) })
  return paginated ? { items, total, page, pageSize, pageCount } : items
}

export function updateCustomer(customer) {
  const db = getDatabase();
  const name = customer.name ? customer.name.trim() : '';
  const phone = customer.phone ? customer.phone.trim() : '';
  if (!name) throw new Error("Müşteri adı boş olamaz.");
  if (!/^0\d{10}$/.test(phone)) throw new Error('Müşteri telefonu zorunludur ve 0 ile başlayan 11 haneli numara olmalıdır.');

  db.prepare(`
    UPDATE customers 
    SET name = @name, phone = @phone, email = @email, note = @note 
    WHERE id = @id
  `).run({
    id: customer.id,
    name,
    phone,
    email: customer.email ? customer.email.trim() : '',
    note: customer.note ? customer.note.trim() : ''
  });
  return { success: true };
}

export function deleteCustomer(id) {
  const db = getDatabase();
  const customerId = Number(id);
  if (!customerId) throw new Error('Müşteri seçilmedi.');

  const deleteTransaction = db.transaction(() => {
    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!customer) throw new Error('Müşteri bulunamadı.');

    const outstandingBalances = db.prepare(`
      SELECT currency, SUM(balance) AS balance
      FROM (
        SELECT COALESCE(currency, 'USD') AS currency, total_price AS balance
        FROM sales WHERE customer_id = ?
        UNION ALL
        SELECT COALESCE(currency, 'USD') AS currency, -amount AS balance
        FROM payments WHERE customer_id = ?
      )
      GROUP BY currency
    `).all(customerId, customerId);
    if (outstandingBalances.some((row) => Number(row.balance) > 0)) {
      throw new Error('Müşterinin ödenmemiş borcu bulunduğu için silinemez. Borcu kapattıktan sonra tekrar deneyin.');
    }

    db.prepare('UPDATE customers SET is_deleted = 1 WHERE id = ?').run(customerId);
    return { success: true, id: customerId };
  });

  return deleteTransaction();
}

// --- ÖZET EKRANI (DASHBOARD) ANALİZ FONKSİYONLARI ---
export function getDashboardStats(options = {}) {
  try {
    const db = getDatabase();
    
    const totalProducts = db.prepare("SELECT COUNT(*) as c FROM products WHERE is_active = 1 AND is_deleted = 0").get().c;
    const lowStockProducts = db.prepare("SELECT COUNT(*) as c FROM products WHERE is_active = 1 AND is_deleted = 0 AND current_quantity <= min_quantity").get().c;
    const categoryInventory = db.prepare(`
      SELECT COALESCE(NULLIF(TRIM(category), ''), 'Kategorisiz') AS category,
        COUNT(*) AS productCount, COALESCE(SUM(current_quantity), 0) AS unitCount
      FROM products
      WHERE is_active = 1 AND is_deleted = 0
      GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'Kategorisiz') COLLATE NOCASE
      ORDER BY productCount DESC, category COLLATE NOCASE
    `).all();
    const lowStockItems = db.prepare(`
      SELECT id, name, brand, category, color,
        current_quantity AS currentQuantity, min_quantity AS minQuantity
      FROM products
      WHERE is_active = 1 AND is_deleted = 0 AND current_quantity <= min_quantity
      ORDER BY current_quantity ASC, min_quantity DESC, name COLLATE NOCASE
      LIMIT 6
    `).all();
    const outOfStockProducts = db.prepare(`
      SELECT id, name, brand, category, color,
        current_quantity AS currentQuantity, min_quantity AS minQuantity
      FROM products
      WHERE is_active = 1 AND is_deleted = 0 AND current_quantity <= 0
      ORDER BY name COLLATE NOCASE
      LIMIT 6
    `).all();
    const negativeStockCount = Number(db.prepare(`
      SELECT COUNT(*) AS count FROM products
      WHERE is_active = 1 AND is_deleted = 0 AND current_quantity < 0
    `).get().count || 0);

    const salesStats = db.prepare(`
      SELECT
        currency,
        COUNT(*) AS salesCount,
        SUM(quantity) AS totalItemsSold,
        SUM(amount) AS totalRevenue,
        COALESCE(SUM(CASE
          WHEN cost_is_estimated = 0 AND total_cost > 0 THEN amount - total_cost
          ELSE 0
        END), 0) AS totalProfit,
        SUM(CASE WHEN cost_is_estimated = 1 OR total_cost <= 0 THEN 1 ELSE 0 END) AS missingCostSalesCount,
        COUNT(DISTINCT CASE WHEN cost_is_estimated = 1 OR total_cost <= 0 THEN product_id END) AS missingCostProductCount,
        SUM(CASE WHEN cost_is_estimated = 0 AND total_cost > 0 AND amount < total_cost THEN 1 ELSE 0 END) AS belowCostSalesCount,
        COALESCE(SUM(CASE WHEN cost_is_estimated = 0 AND total_cost > 0 AND amount < total_cost THEN total_cost - amount ELSE 0 END), 0) AS belowCostTotal
      FROM activity_history
      WHERE event_type = 'SALE'
        AND date(created_at, 'localtime') = date('now', 'localtime')
        AND currency = 'USD'
      GROUP BY currency
    `).all();

    const paymentsStats = db.prepare(`
      SELECT currency, SUM(amount) AS totalPaid
      FROM activity_history
      WHERE event_type = 'PAYMENT'
        AND date(created_at, 'localtime') = date('now', 'localtime')
        AND currency = 'USD'
      GROUP BY currency
    `).all();

    const outstandingBalance = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) AS amount, COUNT(*) AS customerCount
      FROM (
        SELECT c.id,
          COALESCE(SUM(s.total_price), 0) - COALESCE((
            SELECT SUM(p.amount) FROM payments p
            WHERE p.customer_id = c.id AND p.currency = 'USD'
          ), 0) AS balance
        FROM customers c
        LEFT JOIN sales s ON s.customer_id = c.id AND s.currency = 'USD'
        GROUP BY c.id
        HAVING balance > 0
      )
    `).get();

    const isValidIsoDate = (value) => {
      const text = String(value || '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
      const parsed = new Date(`${text}T00:00:00.000Z`)
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text
    }
    const legacyWeekStart = isValidIsoDate(options.weekStart) ? options.weekStart : null
    const paymentRangeStart = isValidIsoDate(options.paymentRangeStart)
      ? options.paymentRangeStart
      : legacyWeekStart || db.prepare("SELECT date('now', 'localtime', '-6 days') AS date").get().date
    const paymentRangeEnd = isValidIsoDate(options.paymentRangeEnd)
      ? options.paymentRangeEnd
      : legacyWeekStart
        ? db.prepare("SELECT date(?, '+6 days') AS date").get(legacyWeekStart).date
        : db.prepare("SELECT date('now', 'localtime') AS date").get().date
    const safeRangeEnd = paymentRangeEnd < paymentRangeStart ? paymentRangeStart : paymentRangeEnd
    const calculatedRangeBounds = db.prepare(`
      SELECT datetime(?, 'utc') AS startUtc, datetime(date(?, '+1 day'), 'utc') AS endUtc
    `).get(paymentRangeStart, safeRangeEnd)
    const financialRangeBounds = {
      rangeStartUtc: calculatedRangeBounds.startUtc,
      rangeEndUtc: calculatedRangeBounds.endUtc
    }
    const allowedGroupings = new Set(['day', 'week', 'month', 'year'])
    const paymentGrouping = allowedGroupings.has(options.paymentGrouping) ? options.paymentGrouping : 'day'
    const paymentPeriodExpression = {
      day: "date(created_at, 'localtime')",
      week: "date(created_at, 'localtime', 'weekday 0', '-6 days')",
      month: "strftime('%Y-%m', created_at, 'localtime')",
      year: "strftime('%Y', created_at, 'localtime')"
    }[paymentGrouping]
    const financialTrendStats = db.prepare(`
      SELECT ${paymentPeriodExpression} AS period,
        COALESCE(SUM(CASE WHEN event_type = 'SALE' THEN amount ELSE 0 END), 0) AS netSales,
        COALESCE(SUM(CASE WHEN event_type = 'SALE' AND cost_is_estimated = 0 THEN total_cost ELSE 0 END), 0) AS cogs,
        COALESCE(SUM(CASE WHEN event_type = 'PAYMENT' THEN amount ELSE 0 END), 0) AS collections,
        COALESCE(SUM(CASE WHEN event_type IN ('INITIAL_STOCK', 'STOCK_IN') THEN amount ELSE 0 END), 0) AS stockPurchases
      FROM activity_history
      WHERE event_type IN ('SALE', 'PAYMENT', 'INITIAL_STOCK', 'STOCK_IN')
        AND currency = 'USD'
        AND created_at >= @rangeStartUtc AND created_at < @rangeEndUtc
      GROUP BY ${paymentPeriodExpression}
      ORDER BY period
    `).all({ ...financialRangeBounds });

    const financialSummary = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN event_type = 'SALE' THEN amount ELSE 0 END), 0) AS netSales,
        COALESCE(SUM(CASE WHEN event_type = 'SALE' AND cost_is_estimated = 0 AND total_cost > 0 THEN amount ELSE 0 END), 0) AS verifiedSalesRevenue,
        COALESCE(SUM(CASE WHEN event_type = 'SALE' AND cost_is_estimated = 0 THEN total_cost ELSE 0 END), 0) AS cogs,
        COALESCE(SUM(CASE WHEN event_type = 'PAYMENT' THEN amount ELSE 0 END), 0) AS collections,
        COALESCE(SUM(CASE WHEN event_type IN ('INITIAL_STOCK', 'STOCK_IN') THEN amount ELSE 0 END), 0) AS stockPurchases,
        SUM(CASE WHEN event_type = 'SALE' AND (cost_is_estimated = 1 OR total_cost = 0) THEN 1 ELSE 0 END) AS unverifiedCostSales,
        COUNT(DISTINCT CASE WHEN event_type = 'SALE' AND (cost_is_estimated = 1 OR total_cost = 0) THEN product_id END) AS unverifiedCostProductCount,
        COUNT(CASE WHEN event_type IN ('SALE', 'PAYMENT', 'INITIAL_STOCK', 'STOCK_IN') THEN 1 END) AS transactionCount
      FROM activity_history
      WHERE event_type IN ('SALE', 'PAYMENT', 'INITIAL_STOCK', 'STOCK_IN')
        AND currency = 'USD'
        AND created_at >= @rangeStartUtc AND created_at < @rangeEndUtc
    `).get({ ...financialRangeBounds });
    financialSummary.grossProfit = Number(financialSummary.unverifiedCostSales || 0) > 0
      ? null
      : Number(financialSummary.netSales) - Number(financialSummary.cogs)
    financialSummary.grossMargin = financialSummary.grossProfit !== null && Number(financialSummary.netSales) > 0
      ? financialSummary.grossProfit / Number(financialSummary.netSales) * 100
      : null
    const financialOtherCurrencies = db.prepare(`
      SELECT currency, COUNT(*) AS transactionCount, COALESCE(SUM(amount), 0) AS totalAmount
      FROM activity_history
      WHERE event_type IN ('SALE', 'PAYMENT', 'INITIAL_STOCK', 'STOCK_IN')
        AND currency <> 'USD'
        AND created_at >= @rangeStartUtc AND created_at < @rangeEndUtc
      GROUP BY currency ORDER BY currency
    `).all({ ...financialRangeBounds });

    const financePageSize = Math.min(100, Math.max(1, Number(options.financePageSize) || 25))
    const financePage = Math.max(1, Math.trunc(Number(options.financePage) || 1))
    const financeEventType = ['SALE', 'PAYMENT', 'STOCK'].includes(options.financeEventType) ? options.financeEventType : 'all'
    const financeEventTypeFilter = `(@eventType = 'all' OR event_type = @eventType OR (@eventType = 'STOCK' AND event_type IN ('INITIAL_STOCK', 'STOCK_IN')))`
    const financeSortColumns = { date: 'created_at', amount: 'amount', type: 'event_type' }
    const financeSortColumn = financeSortColumns[options.financeSortBy] || financeSortColumns.date
    const financeSortDirection = options.financeSortDirection === 'asc' ? 'ASC' : 'DESC'
    const financeTransactionCount = Number(db.prepare(`
      SELECT COUNT(*) AS count FROM activity_history
      WHERE event_type IN ('SALE', 'PAYMENT', 'INITIAL_STOCK', 'STOCK_IN')
        AND currency = 'USD'
        AND created_at >= @rangeStartUtc AND created_at < @rangeEndUtc
        AND ${financeEventTypeFilter}
    `).get({ ...financialRangeBounds, eventType: financeEventType }).count || 0)
    const financeTransactions = db.prepare(`
      SELECT rowid AS id, event_type AS eventType, product_name AS productName,
        customer_name AS customerName, quantity, unit_price AS unitPrice,
        total_cost AS totalCost, amount, currency, note, created_at AS createdAt
      FROM activity_history
      WHERE event_type IN ('SALE', 'PAYMENT', 'INITIAL_STOCK', 'STOCK_IN')
        AND currency = 'USD'
        AND created_at >= @rangeStartUtc AND created_at < @rangeEndUtc
        AND ${financeEventTypeFilter}
      ORDER BY ${financeSortColumn} ${financeSortDirection}, rowid DESC
      LIMIT @limit OFFSET @offset
    `).all({ ...financialRangeBounds, eventType: financeEventType, limit: financePageSize, offset: (financePage - 1) * financePageSize });

    const allTimeStats = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN event_type IN ('INITIAL_STOCK', 'STOCK_IN') THEN amount ELSE 0 END), 0) AS totalStockExpenses,
        COALESCE(SUM(CASE WHEN event_type = 'PAYMENT' THEN amount ELSE 0 END), 0) AS totalCollected
      FROM activity_history
      WHERE event_type IN ('INITIAL_STOCK', 'STOCK_IN', 'PAYMENT') AND currency = 'USD'
    `).get();

    const allowedStockPurchasePeriods = new Set(['today', 'week', 'month', 'all', 'custom']);
    const stockPurchasePeriod = allowedStockPurchasePeriods.has(options.stockPurchasePeriod)
      ? options.stockPurchasePeriod
      : 'all';
    const stockPurchaseStartDate = String(options.stockPurchaseStartDate || '');
    const stockPurchaseEndDate = String(options.stockPurchaseEndDate || '');
    if (stockPurchasePeriod === 'custom') {
      const isValidDate = (value) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const parsedDate = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
      };
      if (!isValidDate(stockPurchaseStartDate) || !isValidDate(stockPurchaseEndDate)) {
        throw new Error('Mal alımı için geçerli bir tarih aralığı seçin.');
      }
      if (stockPurchaseStartDate > stockPurchaseEndDate) {
        throw new Error('Mal alımı başlangıç tarihi bitiş tarihinden sonra olamaz.');
      }
    }
    const stockPurchaseTotal = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM activity_history
      WHERE event_type IN ('INITIAL_STOCK', 'STOCK_IN')
        AND currency = 'USD'
        AND (
          @period = 'all'
          OR (@period = 'today' AND date(created_at, 'localtime') = date('now', 'localtime'))
          OR (@period = 'week' AND date(created_at, 'localtime') BETWEEN date('now', 'localtime', 'weekday 0', '-6 days') AND date('now', 'localtime'))
          OR (@period = 'month' AND date(created_at, 'localtime') BETWEEN date('now', 'localtime', 'start of month') AND date('now', 'localtime'))
          OR (@period = 'custom' AND date(created_at, 'localtime') BETWEEN @startDate AND @endDate)
        )
    `).get({ period: stockPurchasePeriod, startDate: stockPurchaseStartDate, endDate: stockPurchaseEndDate }).total;

    const allowedGrossProfitPeriods = new Set(['today', 'week', 'month', 'all', 'custom']);
    const grossProfitPeriod = allowedGrossProfitPeriods.has(options.grossProfitPeriod)
      ? options.grossProfitPeriod
      : 'today';
    const grossProfitStartDate = String(options.grossProfitStartDate || '');
    const grossProfitEndDate = String(options.grossProfitEndDate || '');
    if (grossProfitPeriod === 'custom') {
      const isValidDate = (value) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const parsedDate = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
      };
      if (!isValidDate(grossProfitStartDate) || !isValidDate(grossProfitEndDate)) {
        throw new Error('Brüt kâr için geçerli bir tarih aralığı seçin.');
      }
      if (grossProfitStartDate > grossProfitEndDate) {
        throw new Error('Brüt kâr başlangıç tarihi bitiş tarihinden sonra olamaz.');
      }
    }
    const grossProfitTotal = db.prepare(`
      SELECT COALESCE(SUM(CASE
        WHEN cost_is_estimated = 0 AND total_cost > 0 THEN amount - total_cost
        ELSE 0
      END), 0) AS total
      FROM activity_history
      WHERE event_type = 'SALE' AND currency = 'USD'
        AND (
          @period = 'all'
          OR (@period = 'today' AND date(created_at, 'localtime') = date('now', 'localtime'))
          OR (@period = 'week' AND date(created_at, 'localtime') BETWEEN date('now', 'localtime', 'weekday 0', '-6 days') AND date('now', 'localtime'))
          OR (@period = 'month' AND date(created_at, 'localtime') BETWEEN date('now', 'localtime', 'start of month') AND date('now', 'localtime'))
          OR (@period = 'custom' AND date(created_at, 'localtime') BETWEEN @startDate AND @endDate)
        )
    `).get({ period: grossProfitPeriod, startDate: grossProfitStartDate, endDate: grossProfitEndDate }).total;

    const stockExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS totalStockCost
      FROM activity_history
      WHERE event_type IN ('INITIAL_STOCK', 'STOCK_IN') AND date(created_at, 'localtime') = date('now', 'localtime')
    `).get().totalStockCost || 0;

    const todaySalesList = db.prepare(`
      SELECT rowid AS id, event_type AS eventType, product_name AS productName,
             customer_name AS customerName, quantity, amount AS totalPrice,
             currency, created_at AS createdAt, note
      FROM activity_history
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
        AND (customer_id IS NULL OR EXISTS (SELECT 1 FROM customers c WHERE c.id = activity_history.customer_id))
        AND (product_id IS NULL OR EXISTS (SELECT 1 FROM products p WHERE p.id = activity_history.product_id AND p.is_deleted = 0))
      ORDER BY created_at DESC, rowid DESC
      LIMIT 15
    `).all();

    return {
      totalProducts,
      lowStockProducts,
      categoryInventory,
      lowStockItems,
      outOfStockProducts,
      negativeStockCount,
      outstandingBalance,
      salesStats,
      paymentsStats,
      weeklyPaymentsStats: [],
      paymentsTrendStats: [],
      financialSummary,
      financialOtherCurrencies,
      financialTrendStats,
      financeTransactions,
      financePage,
      financePageSize,
      financeTransactionCount,
      financeEventType,
      allTimeStats,
      stockPurchasePeriod,
      stockPurchaseTotal,
      grossProfitPeriod,
      grossProfitTotal,
      stockExpenses,
      todaySalesList
    };
  } catch (error) {
    console.error("Dashboard istatistikleri çekilirken hata:", error);
    return { totalProducts: 0, lowStockProducts: 0, categoryInventory: [], lowStockItems: [], outOfStockProducts: [], negativeStockCount: 0, outstandingBalance: { amount: 0, customerCount: 0 }, salesStats: [], paymentsStats: [], weeklyPaymentsStats: [], paymentsTrendStats: [], financialSummary: null, financialOtherCurrencies: [], financialTrendStats: [], financeTransactions: [], financePage: 1, financePageSize: 25, financeTransactionCount: 0, allTimeStats: { totalStockExpenses: 0, totalCollected: 0 }, stockPurchasePeriod: 'all', stockPurchaseTotal: 0, grossProfitPeriod: 'today', grossProfitTotal: 0, stockExpenses: 0, todaySalesList: [] };
  }
}
