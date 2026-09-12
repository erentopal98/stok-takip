import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  testDatabaseConnection, getProducts, addProduct, updateStock, deactivateProduct, getStockMovements, updateProduct,
  getCustomers, addCustomer, updateCustomer, deleteCustomer, makeSale, getCustomerSales, 
  addPayment, getCustomerPayments, getDashboardStats
} from './database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false
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
  ipcMain.handle('db:test', () => testDatabaseConnection());
  
  // Ürün ve Stok İşlemleri (Kurşun Geçirmez Hata Yakalama Eklendi)
  ipcMain.handle('products:getAll', async () => { try { return getProducts(); } catch(err) { return []; } });
  ipcMain.handle('products:add', async (_event, product) => { try { return addProduct(product); } catch(err) { throw err; } });
  ipcMain.handle('products:update', async (_event, product) => { try { return updateProduct(product); } catch(err) { throw err; } });
  ipcMain.handle('products:deactivate', async (_event, id) => { try { return deactivateProduct(id); } catch(err) { throw err; } });
  
  ipcMain.handle('stock:update', async (_event, movement) => { try { return updateStock(movement); } catch(err) { throw err; } });
  ipcMain.handle('stock:getMovements', async () => { try { return getStockMovements(); } catch(err) { return []; } });
  
  // Müşteri, Satış, Ödeme ve Dashboard İşlemleri
  ipcMain.handle('customers:getAll', () => getCustomers());
  ipcMain.handle('customers:add', async (_event, customer) => { try { return addCustomer(customer); } catch (err) { throw err; } });
  ipcMain.handle('customers:update', async (_event, customer) => { try { return updateCustomer(customer); } catch (err) { throw err; } });
  ipcMain.handle('customers:delete', async (_event, id) => { try { return deleteCustomer(id); } catch (err) { throw err; } });
  
  ipcMain.handle('sales:make', async (_event, payload) => { try { return makeSale(payload); } catch (err) { throw err; } });
  ipcMain.handle('sales:getByCustomer', async (_event, customerId) => { try { return getCustomerSales(customerId); } catch (err) { return []; } });
  
  ipcMain.handle('payments:add', async (_event, payload) => { try { return addPayment(payload); } catch (err) { throw err; } });
  ipcMain.handle('payments:getByCustomer', async (_event, customerId) => { try { return getCustomerPayments(customerId); } catch (err) { return []; } });
  
  ipcMain.handle('dashboard:getStats', async () => { try { return getDashboardStats(); } catch (err) { return null; } });
}

app.whenReady().then(() => {
  createWindow()
  registerIpcHandlers()
}).catch((err) => console.error("!!! ELECTRON BAŞLATMA HATASI !!!", err))

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })