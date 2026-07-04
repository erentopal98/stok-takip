import { useEffect, useMemo, useState } from 'react'
import './App.css'

const emptyProductForm = {
  name: '',
  category: '',
  brand: '',
  compatibleModel: '',
  color: '',
  barcode: '',
  sku: '',
  currentQuantity: 0,
  minQuantity: 0,
  purchasePrice: 0,
  retailPrice: 0,
  wholesalePrice: 0
}

function tlToKurus(value) {
  const numberValue = Number(String(value).replace(',', '.'))

  if (Number.isNaN(numberValue)) {
    return 0
  }

  return Math.round(numberValue * 100)
}

function kurusToTl(value) {
  return `${(Number(value || 0) / 100).toFixed(2)} TL`
}

function movementLabel(type) {
  const labels = {
    INITIAL_STOCK: 'İlk Stok',
    STOCK_IN: 'Stok Girişi',
    STOCK_OUT: 'Stok Çıkışı',
    PRODUCT_DEACTIVATED: 'Ürün Pasife Alındı'
  }

  return labels[type] || type
}

function App() {
  const [dbStatus, setDbStatus] = useState(null)
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productForm, setProductForm] = useState(emptyProductForm)
  const [stockQuantity, setStockQuantity] = useState(1)
  const [stockUnitPrice, setStockUnitPrice] = useState(0)
  const [stockNote, setStockNote] = useState('')
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const selectedProduct = useMemo(() => {
    return products.find((product) => product.id === Number(selectedProductId)) || null
  }, [products, selectedProductId])

  function getElectronAPI() {
    if (!window.electronAPI) {
      throw new Error('electronAPI bulunamadı. Uygulamayı Electron üzerinden çalıştırdığından emin ol.')
    }

    return window.electronAPI
  }

  function showSuccess(message) {
    setSuccessMessage(message)
    setError(null)
  }

  function showError(err) {
    console.error(err)
    setError(err.message || String(err))
    setSuccessMessage(null)
  }

  async function refreshAll() {
    const electronAPI = getElectronAPI()

    const [productList, movementList] = await Promise.all([
      electronAPI.getProducts(),
      electronAPI.getStockMovements()
    ])

    setProducts(productList)
    setMovements(movementList)

    if (selectedProductId) {
      const exists = productList.some((product) => product.id === Number(selectedProductId))

      if (!exists) {
        setSelectedProductId('')
      }
    }
  }

  async function testDatabase() {
    try {
      const electronAPI = getElectronAPI()
      const result = await electronAPI.testDatabase()

      setDbStatus(result)
      setError(null)
    } catch (err) {
      showError(err)
    }
  }

  async function loadInitialData() {
    try {
      await testDatabase()
      await refreshAll()
    } catch (err) {
      showError(err)
    }
  }

  function handleProductFormChange(event) {
    const { name, value } = event.target

    setProductForm((previous) => ({
      ...previous,
      [name]: value
    }))
  }

  async function handleAddProduct(event) {
    event.preventDefault()

    try {
      const electronAPI = getElectronAPI()

      await electronAPI.addProduct({
        name: productForm.name,
        category: productForm.category,
        brand: productForm.brand,
        compatibleModel: productForm.compatibleModel,
        color: productForm.color,
        barcode: productForm.barcode,
        sku: productForm.sku,
        currentQuantity: Number(productForm.currentQuantity || 0),
        minQuantity: Number(productForm.minQuantity || 0),
        purchasePrice: tlToKurus(productForm.purchasePrice),
        retailPrice: tlToKurus(productForm.retailPrice),
        wholesalePrice: tlToKurus(productForm.wholesalePrice)
      })

      setProductForm(emptyProductForm)
      await refreshAll()
      showSuccess('Ürün başarıyla eklendi.')
    } catch (err) {
      showError(err)
    }
  }

  async function handleStockUpdate(movementType) {
    try {
      if (!selectedProduct) {
        throw new Error('Önce listeden bir ürün seçmelisin.')
      }

      const electronAPI = getElectronAPI()

      await electronAPI.updateStock({
        productId: selectedProduct.id,
        movementType,
        quantity: Number(stockQuantity || 0),
        unitPrice: tlToKurus(stockUnitPrice),
        note: stockNote
      })

      setStockQuantity(1)
      setStockUnitPrice(0)
      setStockNote('')

      await refreshAll()

      if (movementType === 'STOCK_IN') {
        showSuccess('Stok girişi başarıyla yapıldı.')
      } else {
        showSuccess('Stok çıkışı başarıyla yapıldı.')
      }
    } catch (err) {
      showError(err)
    }
  }

  async function handleDeactivateProduct(product) {
    try {
      const confirmed = window.confirm(
        `"${product.name}" ürünü pasife alınacak. Devam etmek istiyor musun?`
      )

      if (!confirmed) {
        return
      }

      const electronAPI = getElectronAPI()

      await electronAPI.deactivateProduct(product.id)

      await refreshAll()
      showSuccess('Ürün pasife alındı.')
    } catch (err) {
      showError(err)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  return (
    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center' }}>Stok Takip</h1>

      {dbStatus && (
        <div
          style={{
            padding: 12,
            border: '1px solid #c8e6c9',
            background: '#f1f8f1',
            borderRadius: 8,
            marginBottom: 12
          }}
        >
          {dbStatus.message} - {dbStatus.now}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 12,
            border: '1px solid #ffcdd2',
            background: '#ffebee',
            color: '#c62828',
            borderRadius: 8,
            marginBottom: 12,
            fontWeight: 'bold'
          }}
        >
          Hata: {error}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            padding: 12,
            border: '1px solid #bbdefb',
            background: '#e3f2fd',
            color: '#1565c0',
            borderRadius: 8,
            marginBottom: 12,
            fontWeight: 'bold'
          }}
        >
          {successMessage}
        </div>
      )}

      <section
        style={{
          padding: 16,
          border: '1px solid #ddd',
          borderRadius: 8,
          marginBottom: 16
        }}
      >
        <h2>Yeni Ürün Ekle</h2>

        <form onSubmit={handleAddProduct}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12
            }}
          >
            <label>
              Ürün Adı *
              <input
                name="name"
                value={productForm.name}
                onChange={handleProductFormChange}
                required
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Kategori
              <input
                name="category"
                value={productForm.category}
                onChange={handleProductFormChange}
                placeholder="Kılıf, Cam, Kablo..."
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Marka
              <input
                name="brand"
                value={productForm.brand}
                onChange={handleProductFormChange}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Uyumlu Model
              <input
                name="compatibleModel"
                value={productForm.compatibleModel}
                onChange={handleProductFormChange}
                placeholder="iPhone 15, Samsung A55..."
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Renk
              <input
                name="color"
                value={productForm.color}
                onChange={handleProductFormChange}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Barkod
              <input
                name="barcode"
                value={productForm.barcode}
                onChange={handleProductFormChange}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Stok Kodu / SKU
              <input
                name="sku"
                value={productForm.sku}
                onChange={handleProductFormChange}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Başlangıç Stok
              <input
                name="currentQuantity"
                type="number"
                min="0"
                step="1"
                value={productForm.currentQuantity}
                onChange={handleProductFormChange}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Minimum Stok
              <input
                name="minQuantity"
                type="number"
                min="0"
                step="1"
                value={productForm.minQuantity}
                onChange={handleProductFormChange}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Alış Fiyatı TL
              <input
                name="purchasePrice"
                type="number"
                min="0"
                step="0.01"
                value={productForm.purchasePrice}
                onChange={handleProductFormChange}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Perakende TL
              <input
                name="retailPrice"
                type="number"
                min="0"
                step="0.01"
                value={productForm.retailPrice}
                onChange={handleProductFormChange}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Toptan TL
              <input
                name="wholesalePrice"
                type="number"
                min="0"
                step="0.01"
                value={productForm.wholesalePrice}
                onChange={handleProductFormChange}
                style={{ width: '100%' }}
              />
            </label>
          </div>

          <button type="submit" style={{ marginTop: 16 }}>
            Ürünü Kaydet
          </button>
        </form>
      </section>

      <section
        style={{
          padding: 16,
          border: '1px solid #ddd',
          borderRadius: 8,
          marginBottom: 16
        }}
      >
        <h2>Stok Giriş / Çıkış</h2>

        {selectedProduct ? (
          <p>
            Seçili ürün:{' '}
            <strong>
              {selectedProduct.name} - Mevcut stok: {selectedProduct.currentQuantity}
            </strong>
          </p>
        ) : (
          <p>Listeden bir ürün seç.</p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 160px 1fr auto auto',
            gap: 12,
            alignItems: 'end'
          }}
        >
          <label>
            Adet
            <input
              type="number"
              min="1"
              step="1"
              value={stockQuantity}
              onChange={(event) => setStockQuantity(event.target.value)}
              style={{ width: '100%' }}
            />
          </label>

          <label>
            Birim Fiyat TL
            <input
              type="number"
              min="0"
              step="0.01"
              value={stockUnitPrice}
              onChange={(event) => setStockUnitPrice(event.target.value)}
              style={{ width: '100%' }}
            />
          </label>

          <label>
            Not
            <input
              value={stockNote}
              onChange={(event) => setStockNote(event.target.value)}
              placeholder="Satış, mal gelişi, düzeltme..."
              style={{ width: '100%' }}
            />
          </label>

          <button type="button" onClick={() => handleStockUpdate('STOCK_IN')}>
            Stok Girişi +
          </button>

          <button type="button" onClick={() => handleStockUpdate('STOCK_OUT')}>
            Stok Çıkışı -
          </button>
        </div>
      </section>

      <section
        style={{
          padding: 16,
          border: '1px solid #ddd',
          borderRadius: 8,
          marginBottom: 16
        }}
      >
        <h2>Ürünler</h2>

        <button onClick={refreshAll}>
          Listeyi Yenile
        </button>

        <table
          border="1"
          cellPadding="8"
          style={{
            width: '100%',
            marginTop: 16,
            borderCollapse: 'collapse'
          }}
        >
          <thead>
            <tr>
              <th>Seç</th>
              <th>ID</th>
              <th>Ürün</th>
              <th>Kategori</th>
              <th>Model</th>
              <th>Renk</th>
              <th>Stok</th>
              <th>Min.</th>
              <th>Alış</th>
              <th>Perakende</th>
              <th>Toptan</th>
              <th>İşlem</th>
            </tr>
          </thead>

          <tbody>
            {products.map((product) => {
              const isLowStock = product.currentQuantity <= product.minQuantity

              return (
                <tr
                  key={product.id}
                  style={{
                    background: selectedProductId === String(product.id)
                      ? '#e3f2fd'
                      : isLowStock
                        ? '#fff8e1'
                        : 'transparent'
                  }}
                >
                  <td>
                    <input
                      type="radio"
                      name="selectedProduct"
                      checked={selectedProductId === String(product.id)}
                      onChange={() => setSelectedProductId(String(product.id))}
                    />
                  </td>
                  <td>{product.id}</td>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>{product.compatibleModel}</td>
                  <td>{product.color}</td>
                  <td>
                    <strong>{product.currentQuantity}</strong>
                  </td>
                  <td>{product.minQuantity}</td>
                  <td>{kurusToTl(product.purchasePrice)}</td>
                  <td>{kurusToTl(product.retailPrice)}</td>
                  <td>{kurusToTl(product.wholesalePrice)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleDeactivateProduct(product)}
                    >
                      Pasife Al
                    </button>
                  </td>
                </tr>
              )
            })}

            {products.length === 0 && (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center' }}>
                  Henüz ürün yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section
        style={{
          padding: 16,
          border: '1px solid #ddd',
          borderRadius: 8
        }}
      >
        <h2>Son Stok Hareketleri</h2>

        <table
          border="1"
          cellPadding="8"
          style={{
            width: '100%',
            marginTop: 16,
            borderCollapse: 'collapse'
          }}
        >
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Ürün</th>
              <th>İşlem</th>
              <th>Adet</th>
              <th>Önceki</th>
              <th>Yeni</th>
              <th>Birim Fiyat</th>
              <th>Not</th>
            </tr>
          </thead>

          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id}>
                <td>{movement.createdAt}</td>
                <td>{movement.productName}</td>
                <td>{movementLabel(movement.movementType)}</td>
                <td>{movement.quantity}</td>
                <td>{movement.previousQuantity}</td>
                <td>{movement.newQuantity}</td>
                <td>{kurusToTl(movement.unitPrice)}</td>
                <td>{movement.note}</td>
              </tr>
            ))}

            {movements.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center' }}>
                  Henüz stok hareketi yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export default App