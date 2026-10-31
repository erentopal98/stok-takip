const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Ürün işlemleri
  getProducts: (options) => ipcRenderer.invoke('products:getAll', options),
  getProductCatalog: (brand) => ipcRenderer.invoke('products:getCatalog', brand),
  getProductStockBatches: (id) => ipcRenderer.invoke('products:getStockBatches', id),
  addProduct: (product) => ipcRenderer.invoke('products:add', product),
  updateProduct: (product) => ipcRenderer.invoke('products:update', product),
  deactivateProduct: (id) => ipcRenderer.invoke('products:deactivate', id),
  deleteProduct: (id) => ipcRenderer.invoke('products:delete', id),
  
  // Stok işlemleri
  updateStock: (movement) => ipcRenderer.invoke('stock:update', movement),

  // Müşteri ve Satış işlemleri
  getCustomers: () => ipcRenderer.invoke('customers:getAll'),
  addCustomer: (customer) => ipcRenderer.invoke('customers:add', customer),
  updateCustomer: (customer) => ipcRenderer.invoke('customers:update', customer), // YENİ
  deleteCustomer: (id) => ipcRenderer.invoke('customers:delete', id),             // YENİ
  
  makeSale: (payload) => ipcRenderer.invoke('sales:make', payload),
  getCustomerSales: (customerId) => ipcRenderer.invoke('sales:getByCustomer', customerId),
  
  addPayment: (payload) => ipcRenderer.invoke('payments:add', payload),
  getCustomerPayments: (customerId) => ipcRenderer.invoke('payments:getByCustomer', customerId),
  getActivityHistory: (options) => ipcRenderer.invoke('history:getAll', options),
  exportActivityHistoryExcel: (workbookBytes) => ipcRenderer.invoke('history:exportExcel', workbookBytes),
  exportExcelFile: (payload) => ipcRenderer.invoke('files:exportExcel', payload),
  exportCustomerStatementPdf: (payload) => ipcRenderer.invoke('files:exportCustomerStatementPdf', payload),

  // DASHBOARD HATASINI ÇÖZEN SATIR
  getDashboardStats: (options) => ipcRenderer.invoke('dashboard:getStats', options)
})
