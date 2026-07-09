import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, Package, Search, Pencil } from 'lucide-react'; // Pencil eklendi

export default function Products() {
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // DÜZENLEME MANTIĞI: Eğer null ise "Yeni Ekle", dolu ise "Düzenle" modundayız
  const [editingProductId, setEditingProductId] = useState(null);

  const initialFormState = {
    name: '', category: '', brand: '', compatibleModel: '', color: '',
    barcode: '', sku: '', currentQuantity: 0, minQuantity: 0,
    purchasePrice: '', retailPrice: '', wholesalePrice: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  async function fetchProducts() {
    try {
      const data = await window.electronAPI.getProducts();
      setProducts(data);
    } catch (err) {
      console.error("Ürünler yüklenirken hata:", err);
    }
  }

  useEffect(() => { fetchProducts(); }, []);

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formError) setFormError('');
  }

  // YENİ ÜRÜN EKLE BUTONU TIKLANDIĞINDA
  function handleAddNewClick() {
    setEditingProductId(null);
    setFormData(initialFormState);
    setFormError('');
    setIsModalOpen(true);
  }

  // DÜZENLE BUTONU TIKLANDIĞINDA (Kuruşları tekrar TL'ye çevirip forma basıyoruz)
  function handleEditClick(product) {
    setEditingProductId(product.id);
    setFormError('');
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
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingProductId(null);
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

    try {
      // Gönderilecek datayı hazırlayalım (TL -> Kuruş dönüşümleri vb.)
      const payload = {
        ...formData,
        minQuantity: Number(formData.minQuantity || 0),
        purchasePrice: Math.round(Number(String(formData.purchasePrice).replace(',', '.') || 0) * 100),
        retailPrice: Math.round(Number(String(formData.retailPrice).replace(',', '.') || 0) * 100),
        wholesalePrice: Math.round(Number(String(formData.wholesalePrice).replace(',', '.') || 0) * 100)
      };

      if (editingProductId) {
        // DÜZENLEME İŞLEMİ
        payload.id = editingProductId;
        await window.electronAPI.updateProduct(payload);
      } else {
        // YENİ EKLEME İŞLEMİ
        payload.currentQuantity = Number(formData.currentQuantity || 0); // Sadece ilk eklemede stok girilebilir
        await window.electronAPI.addProduct(payload);
      }
      
      closeModal();
      fetchProducts(); 
    } catch (err) {
      setFormError(err.message);
    }
  }

  const filteredProducts = products.filter(product => {
    const searchLower = searchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchLower) ||
      (product.barcode && product.barcode.includes(searchTerm)) ||
      (product.sku && product.sku.toLowerCase().includes(searchLower)) ||
      (product.category && product.category.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Ürün Envanteri</h2>
          <p className="text-slate-500">Kayıtlı tüm ürünlerin listesi ve detayları.</p>
        </div>
        
        <div className="flex w-full md:w-auto items-center space-x-3">
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input 
              type="text" placeholder="Ürün, barkod veya kategori ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition"
            />
          </div>

          <button 
            onClick={handleAddNewClick}
            className="flex flex-shrink-0 items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm"
          >
            <Plus size={18} />
            <span className="hidden md:inline">Yeni Ürün</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="px-6 py-4 font-medium">Ürün Adı</th>
                <th className="px-6 py-4 font-medium">Kategori</th>
                <th className="px-6 py-4 font-medium text-right">Stok</th>
                <th className="px-6 py-4 font-medium text-right">Alış</th>
                <th className="px-6 py-4 font-medium text-right">Satış</th>
                <th className="px-6 py-4 font-medium text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredProducts.map((product) => {
                const isCritical = product.currentQuantity <= product.minQuantity;
                return (
                  <tr key={product.id} className={`transition-colors ${isCritical ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}`}>
                    <td className="px-6 py-4 font-medium text-slate-800">{product.name}</td>
                    <td className="px-6 py-4 text-slate-500">{product.category || '-'}</td>
                    <td className={`px-6 py-4 text-right font-semibold ${isCritical ? 'text-red-600' : 'text-slate-700'}`}>
                      {product.currentQuantity}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">{(product.purchasePrice / 100).toFixed(2)} ₺</td>
                    <td className="px-6 py-4 text-right font-bold text-indigo-600">{(product.retailPrice / 100).toFixed(2)} ₺</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center space-x-3">
                        <button onClick={() => handleEditClick(product)} className="text-slate-400 hover:text-indigo-600 transition" title="Ürünü Düzenle">
                          <Pencil size={18} />
                        </button>
                        <button onClick={() => { if(window.confirm('Pasife almak istediğinize emin misiniz?')) window.electronAPI.deactivateProduct(product.id).then(fetchProducts); }} className="text-slate-400 hover:text-red-600 transition" title="Ürünü Pasife Al">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            
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

              <form id="productForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Ürün Adı *</label>
                  <input name="name" value={formData.name} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Kategori</label>
                  <input name="category" value={formData.category} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Marka</label>
                  <input name="brand" value={formData.brand} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Uyumlu Model</label>
                  <input name="compatibleModel" value={formData.compatibleModel} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Renk</label>
                  <input name="color" value={formData.color} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Barkod</label>
                  <input name="barcode" value={formData.barcode} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Stok Kodu (SKU)</label>
                  <input name="sku" value={formData.sku} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                
                {/* Stok miktarı sadece yeni ürün eklerken değiştirilebilir */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Başlangıç Stok</label>
                  <input 
                    type="number" min="0" name="currentQuantity" value={formData.currentQuantity} onChange={handleInputChange} 
                    disabled={editingProductId !== null}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed" 
                    title={editingProductId ? "Mevcut stok sadece Stok İşlemleri sayfasından değiştirilebilir." : ""}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Minimum Stok Alarmı</label>
                  <input type="number" min="0" name="minQuantity" value={formData.minQuantity} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Alış Fiyatı (₺)</label>
                  <input type="number" step="0.01" min="0" name="purchasePrice" value={formData.purchasePrice} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Perakende Fiyatı (₺)</label>
                  <input type="number" step="0.01" min="0" name="retailPrice" value={formData.retailPrice} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
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
    </div>
  );
}