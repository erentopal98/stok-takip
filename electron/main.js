import process from 'node:process'
import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

import {
  testDatabaseConnection,
  getProducts,
  addProduct,
  updateStock,
  deactivateProduct,
  getStockMovements
} from './database.js'

console.log('Electron main.js başladı')

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isDevelopment = process.env.NODE_ENV === 'development'
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'

function registerIpcHandlers() {
  ipcMain.handle('db:test', () => {
    return testDatabaseConnection()
  })

  ipcMain.handle('products:getAll', () => {
    return getProducts()
  })

  ipcMain.handle('products:add', (_event, product) => {
    return addProduct(product)
  })

  ipcMain.handle('products:updateStock', (_event, payload) => {
    return updateStock(payload)
  })

  ipcMain.handle('products:deactivate', (_event, productId) => {
    return deactivateProduct(productId)
  })

  ipcMain.handle('stockMovements:getRecent', () => {
    return getStockMovements()
  })
}

function createWindow() {
  console.log('Electron window oluşturuluyor...')

  const preloadPath = join(__dirname, 'preload.cjs')

  console.log('Preload path:', preloadPath)
  console.log('Preload dosyası var mı:', existsSync(preloadPath))

  const win = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    show: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => {
    console.log('Electron window hazır')
    win.show()
  })

  if (isDevelopment) {
    console.log('Development URL yükleniyor:', devServerUrl)
    win.loadURL(devServerUrl)

    // Geliştirme sırasında açık kalsın.
    // İstersen sonra yorum satırı yaparız.
    // win.webContents.openDevTools()
  } else {
    const indexPath = join(__dirname, '../dist/index.html')
    console.log('Production dosyası yükleniyor:', indexPath)
    win.loadFile(indexPath)
  }
}

app.whenReady().then(() => {
  console.log('Electron app ready')

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  console.log('Tüm pencereler kapandı')

  if (process.platform !== 'darwin') {
    app.quit()
  }
})