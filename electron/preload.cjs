const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Ürün işlemleri
  getProducts: () => ipcRenderer.invoke('products:getAll'),
  addProduct: (product) => ipcRenderer.invoke('products:add', product),
  updateProduct: (product) => ipcRenderer.invoke('products:update', product),
  deactivateProduct: (id) => ipcRenderer.invoke('products:deactivate', id),
  
  // Stok işlemleri
  updateStock: (movement) => ipcRenderer.invoke('stock:update', movement),
  getStockMovements: () => ipcRenderer.invoke('stock:getMovements'),

  // Müşteri ve Satış işlemleri
  getCustomers: () => ipcRenderer.invoke('customers:getAll'),
  addCustomer: (customer) => ipcRenderer.invoke('customers:add', customer),
  updateCustomer: (customer) => ipcRenderer.invoke('customers:update', customer), // YENİ
  deleteCustomer: (id) => ipcRenderer.invoke('customers:delete', id),             // YENİ
  
  makeSale: (payload) => ipcRenderer.invoke('sales:make', payload),
  getCustomerSales: (customerId) => ipcRenderer.invoke('sales:getByCustomer', customerId),
  
  addPayment: (payload) => ipcRenderer.invoke('payments:add', payload),
  getCustomerPayments: (customerId) => ipcRenderer.invoke('payments:getByCustomer', customerId),

  // DASHBOARD HATASINI ÇÖZEN SATIR
  getDashboardStats: () => ipcRenderer.invoke('dashboard:getStats')
})