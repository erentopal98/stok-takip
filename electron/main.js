import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { startMonthlyBackupScheduler, stopMonthlyBackupScheduler } from './monthly-backup.js'
import {
  testDatabaseConnection, getProducts, getProductCatalog, getProductStockBatches, addProduct, updateStock, deactivateProduct, deleteProduct, updateProduct,
  getCustomers, addCustomer, updateCustomer, deleteCustomer, makeSale, getCustomerSales, 
  addPayment, getCustomerPayments, getActivityHistory, getDashboardStats
} from './database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Keep packaged app data separate from the development database. This gives a
// fresh production install an empty database while preserving it on upgrades.
if (app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'stok-takip-desktop'))
}

let mainWindow

function normalizeExcelBuffer(workbookBytes) {
  if (Buffer.isBuffer(workbookBytes)) return workbookBytes
  if (workbookBytes instanceof ArrayBuffer) return Buffer.from(workbookBytes)
  if (ArrayBuffer.isView(workbookBytes)) {
    return Buffer.from(workbookBytes.buffer, workbookBytes.byteOffset, workbookBytes.byteLength)
  }
  if (Array.isArray(workbookBytes)) return Buffer.from(workbookBytes)
  return null
}

async function saveExcelWorkbook(workbookBytes, title, defaultName) {
  const excelBuffer = normalizeExcelBuffer(workbookBytes)
  if (!excelBuffer?.byteLength) throw new Error('Excel dosyası oluşturulamadı.')
  const result = await dialog.showSaveDialog(mainWindow, {
    title,
    defaultPath: defaultName,
    filters: [{ name: 'Excel çalışma kitabı', extensions: ['xlsx'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  await writeFile(result.filePath, excelBuffer)
  return { success: true, filePath: result.filePath }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character])
}

function formatStatementMoney(value, currency = 'USD') {
  const amount = Number(value || 0) / 100
  const symbol = currency === 'TL' ? '₺' : '$'
  return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`
}

function formatStatementDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString('tr-TR')
}

function createCustomerStatementHtml(payload) {
  const customer = payload.customer
  const salesUsd = Number(customer.totalSalesUSD || 0)
  const paidUsd = Number(customer.totalPaidUSD || 0)
  const salesTl = Number(customer.totalSalesTL || 0)
  const paidTl = Number(customer.totalPaidTL || 0)
  const movements = Array.isArray(payload.movements) ? payload.movements : []
  const movementRows = movements.map((movement) => {
    const quantity = movement.quantity === '' ? '—' : escapeHtml(movement.quantity)
    const unitPrice = movement.unitPrice === '' ? '—' : formatStatementMoney(movement.unitPrice, movement.currency)
    return `<tr>
      <td class="nowrap">${escapeHtml(formatStatementDate(movement.createdAt))}</td>
      <td>${escapeHtml(movement.type)}</td>
      <td class="description">${escapeHtml(movement.description)}</td>
      <td class="number">${quantity}</td>
      <td class="number nowrap">${escapeHtml(unitPrice)}</td>
      <td class="number nowrap">${escapeHtml(formatStatementMoney(movement.amount, movement.currency))}</td>
    </tr>`
  }).join('')

  return `<!doctype html>
  <html lang="tr"><head><meta charset="utf-8"><title>Cari Hesap Dökümü</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body { color: #172033; font: 10pt Arial, sans-serif; margin: 0; }
    h1 { font-size: 19pt; margin: 0; }
    h2 { color: #334155; font-size: 14pt; margin: 5px 0 0; }
    .subtitle { color: #64748b; font-size: 9pt; margin-top: 5px; }
    .customer { border: 1px solid #dbe3ee; border-radius: 8px; margin: 16px 0 12px; padding: 12px; }
    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
    .detail-label { color: #64748b; display: block; font-size: 8pt; margin-bottom: 2px; }
    .detail-value { overflow-wrap: anywhere; }
    .note { white-space: pre-wrap; }
    .balances { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0 18px; }
    .balance { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
    .balance-label { color: #64748b; display: block; font-size: 8pt; margin-bottom: 4px; }
    .balance-value { font-size: 11pt; font-weight: bold; }
    h3 { font-size: 12pt; margin: 18px 0 8px; }
    table { border-collapse: collapse; table-layout: fixed; width: 100%; }
    thead { display: table-header-group; }
    th { background: #f1f5f9; color: #475569; font-size: 8pt; text-align: left; }
    th, td { border: 1px solid #dbe3ee; padding: 6px; vertical-align: top; }
    td { font-size: 8pt; overflow-wrap: anywhere; }
    tr { break-inside: avoid; }
    .nowrap { white-space: nowrap; }
    .number { text-align: right; }
    .description { width: 34%; }
    .empty { color: #64748b; padding: 18px; text-align: center; }
    .footer { color: #64748b; font-size: 8pt; margin-top: 12px; text-align: right; }
  </style></head><body>
    <h1>Cari Hesap Dökümü</h1>
    <h2>${escapeHtml(customer.name)}</h2>
    <div class="subtitle">Oluşturulma tarihi: ${escapeHtml(new Date().toLocaleString('tr-TR'))}</div>
    <section class="customer"><div class="details">
      <div><span class="detail-label">Müşteri No</span><span class="detail-value">${escapeHtml(customer.id)}</span></div>
      <div><span class="detail-label">Telefon</span><span class="detail-value">${escapeHtml(customer.phone || '—')}</span></div>
      <div><span class="detail-label">E-posta</span><span class="detail-value">${escapeHtml(customer.email || '—')}</span></div>
      <div><span class="detail-label">Müşteri Notu</span><span class="detail-value note">${escapeHtml(customer.note || '—')}</span></div>
    </div></section>
    <section class="balances">
      <div class="balance"><span class="balance-label">Toplam Borçlandırma</span><span class="balance-value">${escapeHtml(formatStatementMoney(salesUsd))}${salesTl ? `<br>${escapeHtml(formatStatementMoney(salesTl, 'TL'))}` : ''}</span></div>
      <div class="balance"><span class="balance-label">Tahsil Edilen</span><span class="balance-value">${escapeHtml(formatStatementMoney(paidUsd))}${paidTl ? `<br>${escapeHtml(formatStatementMoney(paidTl, 'TL'))}` : ''}</span></div>
      <div class="balance"><span class="balance-label">Güncel Borç</span><span class="balance-value">${escapeHtml(formatStatementMoney(Math.max(0, salesUsd - paidUsd)))}${salesTl > paidTl ? `<br>${escapeHtml(formatStatementMoney(salesTl - paidTl, 'TL'))}` : ''}</span></div>
    </section>
    <h3>Cari Hareketler (${movements.length})</h3>
    <table><thead><tr><th style="width:17%">Tarih / Saat</th><th style="width:11%">İşlem</th><th style="width:31%">Açıklama</th><th style="width:8%">Adet</th><th style="width:16%">Birim Fiyat</th><th style="width:17%">Tutar</th></tr></thead>
    <tbody>${movementRows || '<tr><td colspan="6" class="empty">Bu müşteriye ait işlem hareketi yok.</td></tr>'}</tbody></table>
    <div class="footer">Toplam ${movements.length} satış ve tahsilat hareketi</div>
  </body></html>`
}

async function saveCustomerStatementPdf(payload) {
  const customer = payload?.customer
  if (!customer || !String(customer.name || '').trim()) throw new Error('Cari döküm için müşteri bilgisi bulunamadı.')
  const safeName = String(payload.defaultName || 'cari-dokumu.pdf').replace(/[<>:"/\\|?*]/g, '-').trim()
  const result = await dialog.showSaveDialog(mainWindow, {
    title: `${customer.name} cari dökümünü PDF olarak kaydet`,
    defaultPath: safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`,
    filters: [{ name: 'PDF belgesi', extensions: ['pdf'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  const pdfPath = result.filePath.toLowerCase().endsWith('.pdf') ? result.filePath : `${result.filePath}.pdf`

  const pdfWindow = new BrowserWindow({
    show: false,
    width: 1000,
    height: 1400,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  try {
    const html = createCustomerStatementHtml(payload)
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdfBytes = await pdfWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      landscape: false,
      margins: { top: 0.45, bottom: 0.45, left: 0.4, right: 0.4 }
    })
    await writeFile(pdfPath, pdfBytes)
    return { success: true, filePath: pdfPath }
  } finally {
    if (!pdfWindow.isDestroyed()) pdfWindow.close()
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
    let retryTimer = null
    const retryDevelopmentLoad = () => {
      if (retryTimer || mainWindow.isDestroyed()) return
      retryTimer = setTimeout(() => {
        retryTimer = null
        if (mainWindow.isDestroyed()) return
        mainWindow.loadURL(devServerUrl).catch(() => retryDevelopmentLoad())
      }, 1000)
    }

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, failedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3 || !(failedUrl || '').startsWith(devServerUrl)) return
      console.error(`Geliştirme sayfası yüklenemedi (${errorCode}): ${errorDescription}`)
      retryDevelopmentLoad()
    })
    mainWindow.webContents.on('did-finish-load', () => {
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = null
    })
    mainWindow.on('closed', () => {
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = null
    })

    mainWindow.loadURL(devServerUrl).catch(() => retryDevelopmentLoad())
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function registerIpcHandlers() {
  ipcMain.handle('db:test', () => testDatabaseConnection());
  
  // Ürün ve Stok İşlemleri (Kurşun Geçirmez Hata Yakalama Eklendi)
  ipcMain.handle('products:getAll', (_event, options) => getProducts(options));
  ipcMain.handle('products:getCatalog', (_event, brand) => getProductCatalog(brand));
  ipcMain.handle('products:getStockBatches', (_event, id) => getProductStockBatches(id));
  ipcMain.handle('products:add', (_event, product) => addProduct(product));
  ipcMain.handle('products:update', (_event, product) => updateProduct(product));
  ipcMain.handle('products:deactivate', (_event, id) => deactivateProduct(id));
  ipcMain.handle('products:delete', (_event, id) => deleteProduct(id));
  
  ipcMain.handle('stock:update', (_event, movement) => updateStock(movement));
  
  // Müşteri, Satış, Ödeme ve Dashboard İşlemleri
  ipcMain.handle('customers:getAll', () => getCustomers());
  ipcMain.handle('customers:add', (_event, customer) => addCustomer(customer));
  ipcMain.handle('customers:update', (_event, customer) => updateCustomer(customer));
  ipcMain.handle('customers:delete', (_event, id) => deleteCustomer(id));
  
  ipcMain.handle('sales:make', (_event, payload) => makeSale(payload));
  ipcMain.handle('sales:getByCustomer', (_event, customerId) => getCustomerSales(customerId));
  
  ipcMain.handle('payments:add', (_event, payload) => addPayment(payload));
  ipcMain.handle('payments:getByCustomer', (_event, customerId) => getCustomerPayments(customerId));
  ipcMain.handle('history:getAll', (_event, options) => getActivityHistory(options));
  ipcMain.handle('history:exportExcel', async (_event, workbookBytes) => {
    return saveExcelWorkbook(workbookBytes, 'İşlem geçmişini Excel olarak kaydet', `islem-gecmisi-${new Date().toISOString().slice(0, 10)}.xlsx`)
  });
  ipcMain.handle('files:exportExcel', (_event, payload) =>
    saveExcelWorkbook(payload?.workbookBytes, payload?.title || 'Excel dosyasını kaydet', payload?.defaultName || 'liste.xlsx')
  )
  ipcMain.handle('files:exportCustomerStatementPdf', (_event, payload) => saveCustomerStatementPdf(payload))
  
  ipcMain.handle('dashboard:getStats', (_event, options) => getDashboardStats(options));
}

app.whenReady().then(() => {
  createWindow()
  registerIpcHandlers()
  startMonthlyBackupScheduler()
}).catch((err) => console.error("!!! ELECTRON BAŞLATMA HATASI !!!", err))

app.on('before-quit', stopMonthlyBackupScheduler)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
