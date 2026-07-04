const { contextBridge, ipcRenderer } = require('electron')

console.log('[PRELOAD] preload.cjs başladı')

try {
  const api = {
    testDatabase: () => ipcRenderer.invoke('db:test'),
    getProducts: () => ipcRenderer.invoke('products:getAll'),
    addProduct: (product) => ipcRenderer.invoke('products:add', product),
    updateStock: (payload) => ipcRenderer.invoke('products:updateStock', payload),
    deactivateProduct: (productId) => ipcRenderer.invoke('products:deactivate', productId),
    getStockMovements: () => ipcRenderer.invoke('stockMovements:getRecent')
  }

  contextBridge.exposeInMainWorld('electronAPI', api)

  contextBridge.exposeInMainWorld('preloadStatus', {
    loaded: true,
    message: 'preload.cjs başarıyla çalıştı'
  })

  console.log('[PRELOAD] electronAPI başarıyla expose edildi')
} catch (error) {
  console.error('[PRELOAD] Hata oluştu:', error)

  contextBridge.exposeInMainWorld('preloadStatus', {
    loaded: false,
    message: error.message
  })
}