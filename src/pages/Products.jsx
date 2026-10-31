import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, X, Search, Pencil, PackagePlus, Download, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';

export default function Products() {
  const pageSize = 50;
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [page, setPage] = useState(1);
  const productRequest = useRef(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [models, setModels] = useState([]);
  const [catalogBrands, setCatalogBrands] = useState([]);
  const [catalogModels, setCatalogModels] = useState([]);
  const [catalogModelsBrand, setCatalogModelsBrand] = useState('');
  const [brandIsOther, setBrandIsOther] = useState(false);
  const [modelIsOther, setModelIsOther] = useState(false);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [categoryIsOther, setCategoryIsOther] = useState(false);
  const [catalogColors, setCatalogColors] = useState([]);
  const [colorIsOther, setColorIsOther] = useState(false);
  const [productNames, setProductNames] = useState([]);
  const [editingProductId, setEditingProductId] = useState(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedStockProduct, setSelectedStockProduct] = useState(null);
  const [stockForm, setStockForm] = useState({ quantity: 0, unitPrice: '' });
  const [stockError, setStockError] = useState('');
  const [stockBatches, setStockBatches] = useState([]);
  const [stockSummary, setStockSummary] = useState(null);
  const [loadingStockBatches, setLoadingStockBatches] = useState(false);
  const [isRemovingProduct, setIsRemovingProduct] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  const initialFormState = {
    name: '', category: '', brand: '', compatibleModel: '', color: '',
    barcode: '', sku: '', currentQuantity: '', minQuantity: 0,
    purchasePrice: '', retailPrice: '', wholesalePrice: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  const fetchProducts = useCallback(async (requestedPage = page, requestedSearch = searchTerm, requestedBrand = brandFilter, requestedCategory = categoryFilter, requestedModel = modelFilter) => {
    const requestId = ++productRequest.current;
    try {
      const result = await window.electronAPI.getProducts({
        page: requestedPage,
        pageSize,
        search: requestedSearch,
        brand: requestedBrand,
        category: requestedCategory,
        compatibleModel: requestedModel,
        sortBy,
        sortDirection
      });
      if (requestId !== productRequest.current) return;
      setProducts(result.items || []);
      setTotalProducts(result.total || 0);
      setBrands(result.brands || []);
      setCategories(result.categories || []);
      setModels(result.models || []);
      setProductNames(result.names || []);
      if (result.page !== requestedPage) setPage(result.page);
    } catch (err) {
      if (requestId === productRequest.current) console.error("Ürünler yüklenirken hata:", err);
    }
  }, [page, searchTerm, brandFilter, categoryFilter, modelFilter, sortBy, sortDirection, pageSize]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchProducts(page, searchTerm); }, 150);
    return () => window.clearTimeout(timer);
  }, [fetchProducts, page, searchTerm]);

  useEffect(() => {
    let isCurrent = true;
    window.electronAPI.getProductCatalog('').then((catalog) => {
      if (isCurrent) {
        setCatalogBrands(catalog.brands || []);
        setCatalogCategories(catalog.categories || []);
        setCatalogColors(catalog.colors || []);
      }
    }).catch((error) => console.error('Ürün seçenekleri yüklenemedi:', error));
    return () => { isCurrent = false; };
  }, []);

  useEffect(() => {
    if (!isModalOpen || !formData.brand.trim()) {
      return undefined;
    }
    let isCurrent = true;
    const timer = window.setTimeout(() => {
      window.electronAPI.getProductCatalog(formData.brand).then((catalog) => {
        if (isCurrent) {
          setCatalogModels(catalog.models || []);
          setCatalogModelsBrand(formData.brand);
        }
      }).catch((error) => console.error('Uyumlu model listesi yüklenemedi:', error));
    }, 120);
    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [isModalOpen, formData.brand]);

  const availableCatalogModels = catalogModelsBrand.toLocaleLowerCase('tr-TR') === formData.brand.trim().toLocaleLowerCase('tr-TR')
    ? catalogModels
    : [];

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formError) setFormError('');
  }

  function handleBrandSelect(option) {
    setModelIsOther(false);
    if (option?.value === '__other__') {
      setBrandIsOther(true);
      setFormData((current) => ({ ...current, brand: '', compatibleModel: '' }));
      return;
    }
    setBrandIsOther(false);
    setFormData((current) => ({ ...current, brand: option?.value || '', compatibleModel: '' }));
  }

  function handleModelSelect(option) {
    if (option?.value === '__other__') {
      setModelIsOther(true);
      setFormData((current) => ({ ...current, compatibleModel: '' }));
      return;
    }
    setModelIsOther(false);
    setFormData((current) => ({ ...current, compatibleModel: option?.value || '' }));
  }

  function handleCategorySelect(option) {
    if (option?.value === '__other__') {
      setCategoryIsOther(true);
      setFormData((current) => ({ ...current, category: '' }));
      return;
    }
    setCategoryIsOther(false);
    setFormData((current) => ({ ...current, category: option?.value || '' }));
  }

  function handleColorSelect(option) {
    if (option?.value === '__other__') {
      setColorIsOther(true);
      setFormData((current) => ({ ...current, color: '' }));
      return;
    }
    setColorIsOther(false);
    setFormData((current) => ({ ...current, color: option?.value || '' }));
  }

  function clearZeroOnFocus(e) {
    const { name } = e.target;
    if (Number(formData[name]) === 0) setFormData((current) => ({ ...current, [name]: '' }));
  }

  function restoreZeroOnBlur(e) {
    const { name } = e.target;
    if (e.target.value === '') setFormData((current) => ({ ...current, [name]: '0' }));
  }

  function handleAddNewClick() {
    closeStockModal();
    setEditingProductId(null);
    setBrandIsOther(false);
    setModelIsOther(false);
    setCategoryIsOther(false);
    setColorIsOther(false);
    setFormData(initialFormState);
    setFormError('');
    setStockBatches([]);
    setStockSummary(null);
    setLoadingStockBatches(false);
    setIsModalOpen(true);
  }

  async function handleEditClick(product) {
    setEditingProductId(product.id);
    setBrandIsOther(false);
    setModelIsOther(false);
    setCategoryIsOther(false);
    setColorIsOther(false);
    setFormError('');
    setStockBatches([]);
    setStockSummary(null);
    setLoadingStockBatches(true);
    setFormData({
      name: product.name || '',
      category: product.category || '',
      brand: product.brand || '',
      compatibleModel: product.compatibleModel || '',
      color: product.color || '',
      barcode: product.barcode || '',
      sku: product.sku || '',
      currentQuantity: product.currentQuantity || 0,
      minQuantity: product.minQuantity || 0,
      purchasePrice: product.purchasePrice ? (product.purchasePrice / 100).toFixed(2) : '',
      retailPrice: product.retailPrice ? (product.retailPrice / 100).toFixed(2) : '',
      wholesalePrice: product.wholesalePrice ? (product.wholesalePrice / 100).toFixed(2) : ''
    });
    setIsModalOpen(true);
    try {
      const summary = await window.electronAPI.getProductStockBatches(product.id);
      setStockBatches(summary.batches || []);
      setStockSummary(summary);
    } catch (err) {
      setFormError(err.message || 'Alış geçmişi yüklenemedi.');
    } finally {
      setLoadingStockBatches(false);
    }
  }

  function openStockModal(product) {
    setSelectedStockProduct(product);
    setStockForm({ quantity: 0, unitPrice: '' });
    setStockError('');
    setIsStockModalOpen(true);
  }

  function closeStockModal() {
    setIsStockModalOpen(false);
    setSelectedStockProduct(null);
    setStockForm({ quantity: 0, unitPrice: '' });
    setStockError('');
  }

  async function handleStockSubmit(e) {
    e.preventDefault();
    setStockError('');
    const quantity = Number(stockForm.quantity);
    if (stockForm.unitPrice === '') return setStockError('Bu alış için birim maliyet girin.');
    const unitPrice = Math.round(Number(String(stockForm.unitPrice).replace(',', '.')) * 100);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return setStockError('Eklenecek adet 0’dan büyük tam sayı olmalıdır.');
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) return setStockError('Geçerli bir alış fiyatı girin.');
    try {
      await window.electronAPI.updateStock({
        productId: selectedStockProduct.id,
        movementType: 'STOCK_IN',
        quantity,
        unitPrice,
        note: `Yeni alış partisi: ${quantity} adet, birim maliyet ${(unitPrice / 100).toFixed(2)} $`
      });
      closeStockModal();
      await fetchProducts();
      window.dispatchEvent(new Event('dashboard:refresh'));
    } catch (err) {
      setStockError(err.message || 'Stok eklenemedi.');
    }
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingProductId(null);
    setBrandIsOther(false);
    setModelIsOther(false);
    setCategoryIsOther(false);
    setColorIsOther(false);
    setFormError('');
    setFormData(initialFormState);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    if (!formData.name || formData.name.trim() === '') {
      setFormError('Lütfen ürün adını giriniz.');
      return;
    }
    if (!editingProductId && formData.currentQuantity === '') {
      setFormError('Başlangıç stoğu boş bırakılamaz.');
      return;
    }
    if (!editingProductId && formData.purchasePrice === '') {
      setFormError('Alış fiyatı boş bırakılamaz.');
      return;
    }

    try {
      const payload = {
        ...formData,
        currentQuantity: Number(formData.currentQuantity || 0),
        minQuantity: Number(formData.minQuantity || 0),
        purchasePrice: Math.round(Number(String(formData.purchasePrice).replace(',', '.') || 0) * 100),
        retailPrice: Math.round(Number(String(formData.retailPrice).replace(',', '.') || 0) * 100),
        wholesalePrice: Math.round(Number(String(formData.wholesalePrice).replace(',', '.') || 0) * 100)
      };

      if (editingProductId) {
        payload.id = editingProductId;
        await window.electronAPI.updateProduct(payload);
      } else {
        await window.electronAPI.addProduct(payload);
      }

      closeModal();
      if (!editingProductId) setPage(1);
      await fetchProducts(editingProductId ? page : 1);
      window.dispatchEvent(new Event('dashboard:refresh'));
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleProductRemoval(product) {
    if (isRemovingProduct) return;
    const message = Number(product.isActive) === 1
      ? `${product.name} ürününü pasife almak istediğinize emin misiniz?`
      : `${product.name} ürününü envanterden kaldırmak istiyor musunuz? Satış, cari bakiye ve stok geçmişi korunur.`;

    if (!window.confirm(message)) {
      return;
    }

    // Önceki bir pencere durumunu silme isteği sürerken temizle. İstek bittikten
    // sonra modal state'ine dokunma; kullanıcı bu sırada yeni ürün açmış olabilir.
    setIsModalOpen(false);
    closeStockModal();
    setIsRemovingProduct(true);
    try {
      if (Number(product.isActive) === 1) {
        await window.electronAPI.deactivateProduct(product.id);
      } else {
        await window.electronAPI.deleteProduct(product.id);
      }
      await fetchProducts();
      window.dispatchEvent(new Event('dashboard:refresh'));
    } catch (err) {
      alert(err.message);
    } finally {
      setIsRemovingProduct(false);
    }
  }

  async function exportProductsExcel() {
    setIsExporting(true);
    setExportMessage('');
    try {
      const allProducts = [];
      const exportFilters = { search: searchTerm, brand: brandFilter, category: categoryFilter, compatibleModel: modelFilter, sortBy: 'brand', sortDirection: 'asc' };
      let result = await window.electronAPI.getProducts({ ...exportFilters, page: 1, pageSize: 200 });
      allProducts.push(...(result.items || []));
      for (let currentPage = 2; currentPage <= result.pageCount; currentPage += 1) {
        result = await window.electronAPI.getProducts({ ...exportFilters, page: currentPage, pageSize: 200 });
        allProducts.push(...(result.items || []));
      }
      const XLSX = await import('xlsx');
      const rows = allProducts.map((product) => ({
        'Ürün Adı': product.name || '',
        'Marka': product.brand || '',
        'Uyumlu Model': product.compatibleModel || '',
        'Kategori': product.category || '',
        'Renk': product.color || '',
        'Stok': Number(product.currentQuantity || 0),
        'Minimum Stok': Number(product.minQuantity || 0),
        'Mevcut Stok Ort. Alış Maliyeti ($)': Number(product.purchasePrice || 0) / 100,
        'Perakende Fiyatı ($)': Number(product.retailPrice || 0) / 100,
        'Toptan Fiyatı ($)': Number(product.wholesalePrice || 0) / 100,
        'Durum': Number(product.isActive) === 1 ? 'Aktif' : 'Pasif'
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 30 }, { wch: 20 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 10 },
        { wch: 14 }, { wch: 34 }, { wch: 20 }, { wch: 18 }, { wch: 12 }
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ürün Envanteri');
      const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
      const saved = await window.electronAPI.exportExcelFile({
        workbookBytes,
        title: 'Ürün envanterini Excel olarak kaydet',
        defaultName: `urun-envanteri-${new Date().toISOString().slice(0, 10)}.xlsx`
      });
      if (saved?.success) setExportMessage('Ürün envanteri Excel dosyası kaydedildi.');
    } catch (error) {
      setExportMessage(error.message || 'Ürün envanteri Excel dosyası oluşturulamadı.');
    } finally {
      setIsExporting(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(totalProducts / pageSize));

  function changeSort(field, numeric = false) {
    setPage(1);
    if (sortBy === field) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(field);
      setSortDirection(numeric ? 'desc' : 'asc');
    }
  }

  function sortHeading(label, field, numeric = false, align = '') {
    const Icon = sortBy !== field ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown;
    return <button type="button" onClick={() => changeSort(field, numeric)} aria-label={`${label}, ${sortBy === field && sortDirection === 'asc' ? 'artan' : 'azalan'} sırala`} className={`inline-flex items-center gap-1.5 hover:text-slate-800 ${align}`}>
      <span>{label}</span><Icon size={15} aria-hidden="true" className={sortBy === field ? 'text-indigo-600' : 'text-slate-400'} />
    </button>;
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-7 sm:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 sm:text-4xl">Ürün Envanteri</h2>
          <p className="text-base text-slate-500">Ürünler; aktif ve pasif durumlarıyla birlikte listelenir.</p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          <div className="relative w-full md:w-56">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input
              type="text" aria-label="Ürün envanterinde ara" placeholder="Ürün, marka veya kategori ara..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition"
            />
          </div>

          <button
            type="button"
            onClick={exportProductsExcel}
            disabled={isExporting}
            title="Ürün listesini Excel olarak indir"
            aria-label="Ürün listesini Excel olarak indir"
            className="flex flex-shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={17} />
            <span>{isExporting ? 'Hazırlanıyor…' : 'Excel'}</span>
          </button>
          <button
            type="button"
            onClick={handleAddNewClick}
            title="Yeni ürün ekle"
            aria-label="Yeni ürün ekle"
            className="flex flex-shrink-0 items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm"
          >
            <Plus size={18} />
            <span className="hidden md:inline">Yeni Ürün</span>
          </button>
        </div>
      </div>

      {exportMessage && <p role="status" className="text-sm text-slate-600">{exportMessage}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SearchableSelect
          options={[{ value: '', label: 'Tümü' }, ...brands.map((brand) => ({ value: brand, label: brand }))]}
          value={brandFilter}
          emptyDisplay="Markaya göre filtrele..."
          onChange={(option) => { setBrandFilter(option?.value || ''); setPage(1); }}
          searchPlaceholder="Markaya göre filtrele..."
          placeholder="Marka bulunamadı."
        />
        <SearchableSelect
          options={[{ value: '', label: 'Tümü' }, ...categories.map((category) => ({ value: category, label: category }))]}
          value={categoryFilter}
          emptyDisplay="Kategoriye göre filtrele..."
          onChange={(option) => { setCategoryFilter(option?.value || ''); setPage(1); }}
          searchPlaceholder="Kategoriye göre filtrele..."
          placeholder="Kategori bulunamadı."
        />
        <SearchableSelect
          options={[{ value: '', label: 'Tümü' }, ...models.map((model) => ({ value: model, label: model }))]}
          value={modelFilter}
          emptyDisplay="Modele göre filtrele..."
          onChange={(option) => { setModelFilter(option?.value || ''); setPage(1); }}
          searchPlaceholder="Modele göre filtrele..."
          placeholder="Model bulunamadı."
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="px-5 py-4 font-medium">{sortHeading('Ürün Adı', 'name')}</th>
                <th className="px-5 py-4 font-medium">{sortHeading('Marka', 'brand')}</th>
                <th className="px-5 py-4 font-medium">{sortHeading('Kategori', 'category')}</th>
                <th className="px-5 py-4 font-medium">{sortHeading('Renk', 'color')}</th>
                <th className="px-5 py-4 font-medium">Uyumlu Model</th>
                <th className="px-5 py-4 font-medium">Durum</th>
                <th className="px-5 py-4 font-medium text-right">{sortHeading('Stok', 'stock', true, 'justify-end w-full')}</th>
                <th className="px-5 py-4 font-medium text-right" title="Kalan stok partilerinin ağırlıklı ortalama alış maliyeti">{sortHeading('Mevcut stok ort. maliyeti', 'purchasePrice', true, 'justify-end w-full')}</th>
                <th className="px-5 py-4 font-medium text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="product-table-rows">
              {products.map((product) => {
                const quantity = Number(product.currentQuantity || 0);
                const isOutOfStock = quantity <= 0;
                const isCritical = !isOutOfStock && quantity <= Number(product.minQuantity || 0);
                return (
                  <tr key={product.id} className="transition-colors hover:bg-slate-50">
                    <td className="max-w-[220px] px-5 py-4 font-medium text-slate-800" title={product.name}><span className="block truncate">{product.name}</span></td>
                    <td className="max-w-[150px] px-5 py-4 text-slate-600" title={product.brand || ''}><span className="block truncate">{product.brand || '—'}</span></td>
                    <td className="max-w-[170px] px-5 py-4 text-slate-600" title={product.category || ''}><span className="block truncate">{product.category || '—'}</span></td>
                    <td className="max-w-[130px] px-5 py-4 text-slate-600" title={product.color || ''}><span className="block truncate">{product.color || '—'}</span></td>
                    <td className="max-w-[200px] px-5 py-4 text-slate-600" title={product.compatibleModel || ''}><span className="block truncate">{product.compatibleModel || '—'}</span></td>
                    <td className="px-5 py-4">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${Number(product.isActive) !== 1 ? 'bg-slate-100 text-slate-600' : isOutOfStock ? 'bg-rose-50 text-rose-700' : isCritical ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                        {Number(product.isActive) === 1 ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="block font-semibold tabular-nums text-slate-700">{quantity}</span>
                      <span className={`text-[11px] font-medium ${isOutOfStock ? 'text-rose-700' : isCritical ? 'text-amber-700' : 'text-emerald-700'}`}>{isOutOfStock ? 'Tükendi' : isCritical ? `Kritik · min. ${product.minQuantity}` : 'Normal'}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-slate-700">${(Number(product.purchasePrice || 0) / 100).toFixed(2)}</td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex justify-center items-center gap-2">
                        {Number(product.isActive) === 1 && <button type="button" onClick={() => openStockModal(product)} className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500" title="Stok ekle" aria-label={`${product.name} için stok ekle`}>
                          <PackagePlus size={18} />
                        </button>}
                        {Number(product.isActive) === 1 && <button type="button" onClick={() => handleEditClick(product)} className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500" title="Ürünü düzenle" aria-label={`${product.name} ürününü düzenle`}>
                          <Pencil size={18} />
                        </button>}
                        <button type="button" disabled={isRemovingProduct} onClick={() => handleProductRemoval(product)} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-wait disabled:opacity-40" title={Number(product.isActive) === 1 ? 'Ürünü pasife al' : 'Ürünü envanterden kaldır'} aria-label={Number(product.isActive) === 1 ? `${product.name} ürününü pasife al` : `${product.name} ürününü envanterden kaldır`}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                    {searchTerm ? 'Aramayla eşleşen ürün bulunamadı.' : 'Henüz ürün bulunmuyor.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
        <span>
          {totalProducts === 0 ? '0 ürün' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalProducts)} / ${totalProducts} ürün`}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50">
            Önceki
          </button>
          <span>{page} / {pageCount}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50">
            Sonraki
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="pointer-events-auto flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">

            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">
                {editingProductId ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded-md shadow-sm border border-slate-200">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              {formError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-center">
                  <span className="mr-2">⚠️</span> {formError}
                </div>
              )}

              <form id="productForm" noValidate onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <datalist id="product-name-suggestions">{productNames.map((name) => <option key={name} value={name} />)}</datalist>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Ürün Adı <span className="text-red-600">*</span></label>
                  <input name="name" list="product-name-suggestions" autoComplete="off" required value={formData.name} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Kategori</label>
                  <SearchableSelect
                    options={[{ value: '__other__', label: 'Diğer' }, ...catalogCategories.map((category) => ({ value: category, label: category })), ...(formData.category && !catalogCategories.some((category) => category.toLocaleLowerCase('tr-TR') === formData.category.toLocaleLowerCase('tr-TR')) && !categoryIsOther ? [{ value: formData.category, label: formData.category }] : [])]}
                    value={categoryIsOther ? '__other__' : formData.category}
                    emptyDisplay="Kategori seçin..."
                    onChange={handleCategorySelect}
                    searchPlaceholder="Kategori ara veya seç..."
                    placeholder="Kategori bulunamadı."
                  />
                  {categoryIsOther && <input name="category" autoFocus autoComplete="off" value={formData.category} onChange={handleInputChange} placeholder="Yeni kategori adını girin" className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Marka</label>
                  <SearchableSelect
                    options={[{ value: '__other__', label: 'Diğer' }, ...catalogBrands.map((brand) => ({ value: brand, label: brand }))]}
                    value={brandIsOther ? '__other__' : formData.brand}
                    emptyDisplay="Marka seçin..."
                    onChange={handleBrandSelect}
                    searchPlaceholder="Marka ara veya seç..."
                    placeholder="Marka bulunamadı."
                  />
                  {brandIsOther && <input
                    name="brand"
                    autoFocus
                    autoComplete="off"
                    value={formData.brand}
                    onChange={(event) => setFormData((current) => ({ ...current, brand: event.target.value, compatibleModel: '' }))}
                    placeholder="Yeni marka adını girin"
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  />}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Uyumlu Model</label>
                  {formData.brand.trim() ? <>
                    <SearchableSelect
                      options={[{ value: '__other__', label: 'Diğer' }, ...availableCatalogModels.map((model) => ({ value: model, label: model }))]}
                      value={modelIsOther ? '__other__' : formData.compatibleModel}
                      emptyDisplay="Uyumlu model seçin..."
                      onChange={handleModelSelect}
                      searchPlaceholder="Markaya uygun model ara veya seç..."
                      placeholder="Bu marka için kayıtlı model yok."
                    />
                    {modelIsOther && <input
                      name="compatibleModel"
                      autoFocus
                      autoComplete="off"
                      value={formData.compatibleModel}
                      onChange={handleInputChange}
                      placeholder="Yeni uyumlu model adını girin"
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    />}
                  </> : <input disabled value="Önce marka seçin" className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-slate-400" />}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Renk</label>
                  <SearchableSelect
                    options={[{ value: '__other__', label: 'Diğer' }, ...catalogColors.map((color) => ({ value: color, label: color })), ...(formData.color && !catalogColors.some((color) => color.toLocaleLowerCase('tr-TR') === formData.color.toLocaleLowerCase('tr-TR')) && !colorIsOther ? [{ value: formData.color, label: formData.color }] : [])]}
                    value={colorIsOther ? '__other__' : formData.color}
                    emptyDisplay="Renk seçin..."
                    onChange={handleColorSelect}
                    searchPlaceholder="Renk ara veya seç..."
                    placeholder="Renk bulunamadı."
                  />
                  {colorIsOther && <input name="color" autoFocus autoComplete="off" value={formData.color} onChange={handleInputChange} placeholder="Yeni renk adını girin" className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">{editingProductId ? 'Mevcut Stok Adedi' : <>Başlangıç Stoğu <span className="text-red-600">*</span></>}</label>
                  <input
                    type="number" min="0" name="currentQuantity" value={formData.currentQuantity} onChange={handleInputChange}
                    onFocus={clearZeroOnFocus} onBlur={editingProductId ? restoreZeroOnBlur : undefined}
                    required={!editingProductId}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Minimum Stok Alarmı</label>
                  <input type="number" min="0" name="minQuantity" value={formData.minQuantity} onChange={handleInputChange} onFocus={clearZeroOnFocus} onBlur={restoreZeroOnBlur} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">{editingProductId ? 'Ağırlıklı Ortalama Alış Maliyeti ($)' : <>Alış Fiyatı ($) <span className="text-red-600">*</span></>}</label>
                  <input type="number" step="0.01" min="0" name="purchasePrice" value={formData.purchasePrice} onChange={handleInputChange} readOnly={Boolean(editingProductId)} required={!editingProductId} className={`w-full px-4 py-2 border border-slate-200 rounded-lg outline-none ${editingProductId ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 focus:ring-2 focus:ring-indigo-500'}`} />
                  {editingProductId && <p className="text-xs text-slate-500">Yeni alış maliyetini kaydetmek için Stok Ekle’yi kullanın.</p>}
                </div>
                {editingProductId && <section className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="font-semibold text-slate-800">Alış partileri ve maliyet dökümü</h4>
                  {loadingStockBatches ? <p className="mt-2 text-sm text-slate-500">Alış geçmişi yükleniyor…</p> : <>
                    <div className="mt-2 space-y-1.5">
                      {stockBatches.map((batch, index) => <p key={`${batch.createdAt}-${index}`} className="text-sm text-slate-600">
                        {new Date(batch.createdAt).toLocaleString('tr-TR')} · {batch.quantity} adet × ${(batch.unitCost / 100).toFixed(2)} = ${(batch.quantity * batch.unitCost / 100).toFixed(2)} · kalan {batch.remainingQuantity}
                      </p>)}
                      {stockBatches.length === 0 && <p className="text-sm text-slate-500">Kayıtlı alış partisi yok.</p>}
                    </div>
                    {stockSummary && <div className="mt-3 border-t border-slate-200 pt-3 text-sm font-medium text-slate-700">
                      <p>Toplam alınan: {stockSummary.totalPurchasedQuantity} adet · alış toplamı: ${(stockSummary.totalPurchaseCost / 100).toFixed(2)}</p>
                      <p>Mevcut stok: {stockSummary.currentQuantity} adet · stok maliyeti: ${(stockSummary.currentInventoryCost / 100).toFixed(2)} · ağırlıklı ortalama: ${(stockSummary.averageUnitCost / 100).toFixed(2)} / adet</p>
                    </div>}
                  </>}
                </section>}
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
              <button type="button" onClick={closeModal} className="px-5 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-200 transition">İptal</button>
              <button type="submit" form="productForm" className="px-5 py-2 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition">
                {editingProductId ? 'Değişiklikleri Kaydet' : 'Ürünü Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isStockModalOpen && selectedStockProduct && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="font-bold text-slate-800">Stok Ekle</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedStockProduct.name} · Mevcut stok: {selectedStockProduct.currentQuantity}</p>
              </div>
              <button type="button" onClick={closeStockModal} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Kapat"><X size={18} /></button>
            </div>
            <form id="stockReceiveForm" onSubmit={handleStockSubmit} className="space-y-4 p-6">
              {stockError && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{stockError}</div>}
              <p className="text-sm text-slate-500">Her yeni alış adet ve birim maliyetle ayrı kaydedilir; önceki alışların fiyatı değişmez.</p>
              <div>
                <label htmlFor="stock-receive-quantity" className="mb-1.5 block text-sm font-medium text-slate-700">Eklenecek Adet</label>
                <input id="stock-receive-quantity" type="number" min="1" value={stockForm.quantity} onFocus={() => { if (Number(stockForm.quantity) === 0) setStockForm((current) => ({ ...current, quantity: '' })); }} onBlur={() => { if (stockForm.quantity === '') setStockForm((current) => ({ ...current, quantity: 0 })); }} onChange={(event) => setStockForm((current) => ({ ...current, quantity: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label htmlFor="stock-receive-price" className="mb-1.5 block text-sm font-medium text-slate-700">Bu Alışın Birim Maliyeti ($)</label>
                <input id="stock-receive-price" type="number" min="0" step="0.01" value={stockForm.unitPrice} onFocus={() => { if (Number(stockForm.unitPrice) === 0) setStockForm((current) => ({ ...current, unitPrice: '' })); }} onChange={(event) => setStockForm((current) => ({ ...current, unitPrice: event.target.value }))} placeholder="0.00" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none focus:border-indigo-500" />
              </div>
            </form>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button type="button" onClick={closeStockModal} className="rounded-xl px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-200">İptal</button>
              <button type="submit" form="stockReceiveForm" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700"><PackagePlus size={17} /> Stok Ekle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
