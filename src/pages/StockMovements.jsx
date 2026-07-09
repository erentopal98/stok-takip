import React, { useState, useEffect } from 'react';
import { ArrowDownRight, ArrowUpRight, History, PackageSearch, ArrowRight, ChevronDown } from 'lucide-react';

// Yardımcı Fonksiyonlar
const tlToKurus = (value) => Math.round(Number(String(value).replace(',', '.')) * 100) || 0;
const kurusToTl = (value) => `${(Number(value || 0) / 100).toFixed(2)} ₺`;

const movementLabel = (type) => {
  const labels = {
    INITIAL_STOCK: 'İlk Stok',
    STOCK_IN: 'Stok Girişi',
    STOCK_OUT: 'Stok Çıkışı',
    PRODUCT_DEACTIVATED: 'Pasife Alındı'
  };
  return labels[type] || type;
};

export default function StockMovements() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);

  // Form ve Hata State'leri
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState(''); // Yeni: Şık hata mesajı için

  async function loadData() {
    try {
      const [productList, movementList] = await Promise.all([
        window.electronAPI.getProducts(),
        window.electronAPI.getStockMovements()
      ]);
      setProducts(productList);
      setMovements(movementList);
    } catch (err) {
      console.error("Veriler yüklenirken hata:", err);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleStockUpdate(movementType) {
    setFormError(''); // Önceki hataları temizle

    if (!selectedProductId) {
      setFormError("Lütfen işlem yapmak için listeden bir ürün seçin.");
      return;
    }

    try {
      await window.electronAPI.updateStock({
        productId: selectedProductId,
        movementType: movementType,
        quantity: Number(quantity),
        unitPrice: tlToKurus(unitPrice),
        note: note
      });

      // Başarılıysa formu sıfırla
      setSelectedProductId('');
      setQuantity(1);
      setUnitPrice('');
      setNote('');
      loadData(); 

    } catch (err) {
      setFormError("İşlem başarısız: " + err.message);
    }
  }

  return (
    <div className="space-y-8">
      {/* Üst Bilgi */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Stok İşlemleri</h2>
        <p className="text-slate-500">Hızlı stok giriş/çıkışı yapın ve geçmiş hareketleri izleyin.</p>
      </div>

      {/* Hızlı İşlem Formu */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-6 border-b border-slate-100 pb-4">
          <PackageSearch className="text-indigo-600" size={20} />
          <h3 className="text-lg font-semibold text-slate-800">Hızlı Stok Güncelleme</h3>
        </div>

        {/* Hata Mesajı Alanı */}
        {formError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-center">
            <span className="mr-2">⚠️</span> {formError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Ürün Seçin</label>
            {/* Özel Tasarım (Custom) Select Box */}
            <div className="relative">
              <select 
                value={selectedProductId} 
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setFormError(''); // Ürün seçilince hatayı kaldır
                }}
                disabled={products.length === 0}
                className={`w-full px-4 py-2.5 bg-slate-50 border ${formError ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} rounded-lg outline-none appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <option value="" disabled>
                  {products.length === 0 ? '-- Kayıtlı Aktif Ürün Yok --' : '-- Listeden Ürün Seç --'}
                </option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Mevcut Stok: {p.currentQuantity})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                <ChevronDown size={18} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Adet</label>
            <input 
              type="number" min="1" 
              value={quantity} onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Birim Fiyat (₺)</label>
            <input 
              type="number" step="0.01" min="0" placeholder="Opsiyonel"
              value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">İşlem Notu</label>
            <input 
              type="text" placeholder="Örn: Toptancıdan geldi, perakende satıldı..."
              value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
          </div>

          <div className="flex space-x-3 md:col-span-2 justify-end">
            <button 
              onClick={() => handleStockUpdate('STOCK_IN')}
              className="flex items-center justify-center space-x-2 w-full md:w-auto px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition shadow-sm"
            >
              <ArrowDownRight size={18} />
              <span>Giriş Yap (+)</span>
            </button>
            <button 
              onClick={() => handleStockUpdate('STOCK_OUT')}
              className="flex items-center justify-center space-x-2 w-full md:w-auto px-6 py-2.5 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 transition shadow-sm"
            >
              <ArrowUpRight size={18} />
              <span>Çıkış Yap (-)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hareketler Tablosu */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-2">
          <History className="text-slate-500" size={20} />
          <h3 className="text-lg font-semibold text-slate-800">Son Stok Hareketleri</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="px-6 py-4 font-medium">Tarih</th>
                <th className="px-6 py-4 font-medium">Ürün</th>
                <th className="px-6 py-4 font-medium">İşlem</th>
                <th className="px-6 py-4 font-medium text-center">Adet</th>
                <th className="px-6 py-4 font-medium text-center">Değişim</th>
                <th className="px-6 py-4 font-medium text-right">Fiyat</th>
                <th className="px-6 py-4 font-medium">Not</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((m) => {
                const isIncoming = m.movementType === 'STOCK_IN' || m.movementType === 'INITIAL_STOCK';
                const isOutgoing = m.movementType === 'STOCK_OUT';
                
                return (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-500">{new Date(m.createdAt).toLocaleString('tr-TR')}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{m.productName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        isIncoming ? 'bg-emerald-100 text-emerald-700' : 
                        isOutgoing ? 'bg-rose-100 text-rose-700' : 
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {movementLabel(m.movementType)}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-center font-bold ${isIncoming ? 'text-emerald-600' : isOutgoing ? 'text-rose-600' : 'text-slate-600'}`}>
                      {isIncoming ? '+' : isOutgoing ? '-' : ''}{Math.abs(m.quantity)}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-500 flex items-center justify-center space-x-1">
                      <span>{m.previousQuantity}</span>
                      <ArrowRight className="text-slate-300" size={14} />
                      <span className="font-medium text-slate-700">{m.newQuantity}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-600">
                      {m.unitPrice > 0 ? kurusToTl(m.unitPrice) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate" title={m.note}>
                      {m.note || '-'}
                    </td>
                  </tr>
                );
              })}

              {movements.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    Henüz hiç stok hareketi bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}