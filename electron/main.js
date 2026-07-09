import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  testDatabaseConnection, getProducts, addProduct, updateStock, deactivateProduct, getStockMovements, updateProduct,
  getCustomers, addCustomer, makeSale, getCustomerSales
} from './database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://127.0.0.1:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function registerIpcHandlers() {
  // Veritabanı Test
  ipcMain.handle('db:test', () => testDatabaseConnection())

  // Ürün IPC Handlers
  ipcMain.handle('products:getAll', () => getProducts())
  ipcMain.handle('products:add', (_event, product) => addProduct(product))
  ipcMain.handle('products:update', (_event, product) => updateProduct(product))
  ipcMain.handle('products:deactivate', (_event, id) => deactivateProduct(id))

  // Stok IPC Handlers
  ipcMain.handle('stock:update', (_event, movement) => updateStock(movement))
  ipcMain.handle('stock:getMovements', () => getStockMovements())

  // Müşteri ve Satış IPC Handlers
  ipcMain.handle('customers:getAll', () => getCustomers())
  ipcMain.handle('customers:add', (_event, customer) => addCustomer(customer))
  ipcMain.handle('sales:make', (_event, payload) => makeSale(payload))
  ipcMain.handle('sales:getByCustomer', (_event, customerId) => getCustomerSales(customerId))
}

// KÖK NEDENİ ÇÖZEN YER: Başlatma zincirine .catch() ekledik. 
// Eğer bir hata varsa, gizlenmeyecek ve terminale kabak gibi yazılacak.
app.whenReady().then(() => {
  createWindow()
  registerIpcHandlers()
}).catch((err) => {
  console.error("!!! ELECTRON BAŞLATMA SIRASINDA KRİTİK HATA !!!", err)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})