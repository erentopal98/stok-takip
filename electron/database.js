import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

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
  `)
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

  if (Number.isNaN(numberValue)) {
    return defaultValue
  }

  return numberValue
}

function normalizePositiveInteger(value, fieldName) {
  const numberValue = Number(value)

  if (!Number.isInteger(numberValue)) {
    throw new Error(`${fieldName} tam sayı olmalıdır.`)
  }

  if (numberValue <= 0) {
    throw new Error(`${fieldName} 0'dan büyük olmalıdır.`)
  }

  return numberValue
}

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    compatibleModel: row.compatibleModel,
    color: row.color,
    barcode: row.barcode,
    sku: row.sku,
    currentQuantity: row.currentQuantity,
    minQuantity: row.minQuantity,
    purchasePrice: row.purchasePrice,
    retailPrice: row.retailPrice,
    wholesalePrice: row.wholesalePrice,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
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

export function getProducts() {
  const database = getDatabase()

  return database
    .prepare(`
      SELECT
        id,
        name,
        category,
        brand,
        compatible_model AS compatibleModel,
        color,
        barcode,
        sku,
        current_quantity AS currentQuantity,
        min_quantity AS minQuantity,
        purchase_price AS purchasePrice,
        retail_price AS retailPrice,
        wholesale_price AS wholesalePrice,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM products
      WHERE is_active = 1
      ORDER BY created_at DESC, id DESC
    `)
    .all()
    .map(mapProduct)
}

export function addProduct(product) {
  const database = getDatabase()

  const name = normalizeText(product.name)

  if (!name) {
    throw new Error('Ürün adı boş bırakılamaz.')
  }

  const currentQuantity = normalizeNumber(product.currentQuantity, 0)
  const minQuantity = normalizeNumber(product.minQuantity, 0)
  const purchasePrice = normalizeNumber(product.purchasePrice, 0)
  const retailPrice = normalizeNumber(product.retailPrice, 0)
  const wholesalePrice = normalizeNumber(product.wholesalePrice, 0)

  if (!Number.isInteger(currentQuantity) || currentQuantity < 0) {
    throw new Error('Stok adedi negatif olamaz ve tam sayı olmalıdır.')
  }

  if (!Number.isInteger(minQuantity) || minQuantity < 0) {
    throw new Error('Minimum stok negatif olamaz ve tam sayı olmalıdır.')
  }

  if (purchasePrice < 0 || retailPrice < 0 || wholesalePrice < 0) {
    throw new Error('Fiyat bilgileri negatif olamaz.')
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
      wholesale_price
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
      @wholesalePrice
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
    const result = insertProduct.run({
      name,
      category: normalizeText(product.category),
      brand: normalizeText(product.brand),
      compatibleModel: normalizeText(product.compatibleModel),
      color: normalizeText(product.color),
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
      insertStockMovement.run({
        productId,
        movementType: 'INITIAL_STOCK',
        quantity: currentQuantity,
        previousQuantity: 0,
        newQuantity: currentQuantity,
        unitPrice: purchasePrice,
        note: 'İlk ürün kaydı sırasında oluşturulan başlangıç stoku'
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
      throw new Error('Bu barkod başka bir üründe kullanılıyor.')
    }

    if (error.message.includes('UNIQUE constraint failed: products.sku')) {
      throw new Error('Bu stok kodu başka bir üründe kullanılıyor.')
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

  if (unitPrice < 0) {
    throw new Error('Birim fiyat negatif olamaz.')
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

    updateProductStatement.run({
      productId,
      newQuantity
    })

    insertMovementStatement.run({
      productId,
      movementType,
      quantity: signedQuantity,
      previousQuantity,
      newQuantity,
      unitPrice,
      note
    })

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

export function getStockMovements(limit = 50) {
  const database = getDatabase()

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200)

  return database
    .prepare(`
      SELECT
        sm.id,
        sm.product_id AS productId,
        p.name AS productName,
        sm.movement_type AS movementType,
        sm.quantity,
        sm.previous_quantity AS previousQuantity,
        sm.new_quantity AS newQuantity,
        sm.unit_price AS unitPrice,
        sm.note,
        sm.created_at AS createdAt
      FROM stock_movements sm
      INNER JOIN products p ON p.id = sm.product_id
      ORDER BY sm.created_at DESC, sm.id DESC
      LIMIT ?
    `)
    .all(safeLimit)
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

  if (!Number.isInteger(minQuantity) || minQuantity < 0) {
    throw new Error('Minimum stok negatif olamaz ve tam sayı olmalıdır.')
  }
  if (purchasePrice < 0 || retailPrice < 0 || wholesalePrice < 0) {
    throw new Error('Fiyat bilgileri negatif olamaz.')
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
      min_quantity = @minQuantity,
      purchase_price = @purchasePrice,
      retail_price = @retailPrice,
      wholesale_price = @wholesalePrice,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `)

  try {
    updateStatement.run({
      id,
      name,
      category: normalizeText(product.category),
      brand: normalizeText(product.brand),
      compatibleModel: normalizeText(product.compatibleModel),
      color: normalizeText(product.color),
      barcode: normalizeText(product.barcode),
      sku: normalizeText(product.sku),
      minQuantity,
      purchasePrice,
      retailPrice,
      wholesalePrice
    })

    return { success: true, id }
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: products.barcode')) {
      throw new Error('Bu barkod başka bir üründe kullanılıyor.')
    }
    if (error.message.includes('UNIQUE constraint failed: products.sku')) {
      throw new Error('Bu stok kodu başka bir üründe kullanılıyor.')
    }
    throw error
  }
}

// --- MÜŞTERİ VE SATIŞ FONKSİYONLARI ---

export function getCustomers() {
  const db = getDatabase();
  // Tabloların ilk kez oluşturulduğundan emin oluyoruz
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      note TEXT,
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
  `);

  return db.prepare(`SELECT id, name, phone, email, note, created_at AS createdAt FROM customers ORDER BY name ASC`).all();
}

export function addCustomer(customer) {
  const db = getDatabase();
  const name = customer.name ? customer.name.trim() : '';
  if (!name) throw new Error("Müşteri adı boş olamaz.");

  const result = db.prepare(`
    INSERT INTO customers (name, phone, email, note)
    VALUES (@name, @phone, @email, @note)
  `).run({
    name,
    phone: customer.phone ? customer.phone.trim() : '',
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
  const unitPrice = Number(payload.unitPrice) || 0;
  const totalPrice = quantity * unitPrice;

  if (!customerId) throw new Error('Müşteri seçilmedi.');
  if (!productId) throw new Error('Ürün seçilmedi.');
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Geçerli bir adet giriniz.');

  const getProduct = db.prepare('SELECT current_quantity FROM products WHERE id = ? AND is_active = 1');
  const updateProduct = db.prepare('UPDATE products SET current_quantity = @newQuantity WHERE id = @id');
  const insertSale = db.prepare(`
    INSERT INTO sales (customer_id, product_id, quantity, unit_price, total_price)
    VALUES (@customerId, @productId, @quantity, @unitPrice, @totalPrice)
  `);
  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (product_id, movement_type, quantity, previous_quantity, new_quantity, unit_price, note)
    VALUES (@productId, 'STOCK_OUT', @quantity, @prevQty, @newQty, @unitPrice, @note)
  `);

  const saleTransaction = db.transaction(() => {
    const product = getProduct.get(productId);
    if (!product) throw new Error("Ürün bulunamadı.");
    
    const prevQty = Number(product.current_quantity);
    const newQty = prevQty - quantity;

    if (newQty < 0) throw new Error(`Yetersiz stok! Mevcut stok: ${prevQty}`);

    insertSale.run({ customerId, productId, quantity, unitPrice, totalPrice });
    updateProduct.run({ newQuantity: newQty, id: productId });
    insertMovement.run({ 
      productId, quantity: -quantity, prevQty, newQty, unitPrice, 
      note: 'Müşteriye Satış' 
    });

    return { success: true };
  });

  return saleTransaction();
}

export function getCustomerSales(customerId) {
  return getDatabase().prepare(`
    SELECT s.id, s.quantity, s.unit_price AS unitPrice, s.total_price AS totalPrice, s.created_at AS createdAt,
           p.name AS productName, p.category, p.color
    FROM sales s
    INNER JOIN products p ON s.product_id = p.id
    WHERE s.customer_id = ?
    ORDER BY s.created_at DESC
  `).all(Number(customerId));
}