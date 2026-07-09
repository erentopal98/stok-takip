import React, { useState, useEffect } from 'react';
import { Users, UserPlus, ShoppingBag, X, History } from 'lucide-react';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  
  // Modallar için State'ler
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [formError, setFormError] = useState('');

  // Form State'leri
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '', note: '' });
  const [saleForm, setSaleForm] = useState({ customerId: '', productId: '', quantity: 1, unitPrice: '' });
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  async function loadData() {
    try {
      const [custList, prodList] = await Promise.all([
        window.electronAPI.getCustomers(),
        window.electronAPI.getProducts()
      ]);
      setCustomers(custList);
      setProducts(prodList.filter(p => p.currentQuantity > 0)); // Sadece stoğu olanlar satılabilir
    } catch (err) {
      console.error("Veriler yüklenirken hata:", err);
    }
  }

  useEffect(() => { loadData(); }, []);

  // --- YENİ MÜŞTERİ EKLEME ---
  async function handleCustomerSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!customerForm.name.trim()) return setFormError('Müşteri adı zorunludur.');

    try {
      await window.electronAPI.addCustomer(customerForm);
      setIsCustomerModalOpen(false);
      setCustomerForm({ name: '', phone: '', email: '', note: '' });
      loadData();
    } catch (err) {
      setFormError(err.message);
    }
  }

  // --- SATIŞ YAPMA ---
  async function handleSaleSubmit(e) {
    e.preventDefault();
    setFormError('');
    
    if (!saleForm.customerId || !saleForm.productId) {
      return setFormError('Lütfen müşteri ve ürün seçtiğinizden emin olun.');
    }

    try {
      await window.electronAPI.makeSale({
        customerId: saleForm.customerId,
        productId: saleForm.productId,
        quantity: saleForm.quantity,
        unitPrice: Math.round(Number(String(saleForm.unitPrice).replace(',', '.')) * 100)
      });
      
      setIsSaleModalOpen(false);
      setSaleForm({ customerId: '', productId: '', quantity: 1, unitPrice: '' });
      loadData();
      alert("Satış başarıyla tamamlandı ve stoktan düşüldü!");
    } catch (err) {
      setFormError(err.message);
    }
  }

  // --- MÜŞTERİ GEÇMİŞİNİ GÖRÜNTÜLEME ---
  async function openHistory(customerId, customerName) {
    setSelectedCustomerName(customerName);
    try {
      const history = await window.electronAPI.getCustomerSales(customerId);
      setSalesHistory(history);
      setIsHistoryModalOpen(true);
    } catch (err) {
      alert("Geçmiş yüklenemedi: " + err.message);
    }
  }

  // Ürün seçildiğinde fiyatını otomatik doldur
  function handleProductSelect(e) {
    const prodId = e.target.value;
    const selectedProd = products.find(p => p.id === Number(prodId));
    setSaleForm(prev => ({ 
      ...prev, 
      productId: prodId, 
      unitPrice: selectedProd ? (selectedProd.retailPrice / 100).toFixed(2) : '' 
    }));
  }

  return (
    <div className="space-y-6">
      {/* Üst Bilgi ve Butonlar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Müşteriler & Satışlar</h2>
          <p className="text-slate-500">Müşteri portföyünüzü ve satış hareketlerini yönetin.</p>
        </div>
        
        <div className="flex space-x-3">
          <button onClick={() => setIsCustomerModalOpen(true)} className="flex items-center space-x-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition shadow-sm">
            <UserPlus size={18} />
            <span>Yeni Müşteri</span>
          </button>
          <button onClick={() => setIsSaleModalOpen(true)} className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm">
            <ShoppingBag size={18} />
            <span>Satış Yap</span>
          </button>
        </div>
      </div>

      {/* Müşteriler Tablosu */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="px-6 py-4 font-medium">Müşteri Adı</th>
                <th className="px-6 py-4 font-medium">Telefon</th>
                <th className="px-6 py-4 font-medium">Notlar</th>
                <th className="px-6 py-4 font-medium text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-800">{c.name}</td>
                  <td className="px-6 py-4 text-slate-600">{c.phone || '-'}</td>
                  <td className="px-6 py-4 text-slate-500 text-sm max-w-xs truncate">{c.note || '-'}</td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => openHistory(c.id, c.name)} className="flex items-center justify-center space-x-1 mx-auto text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 px-3 py-1.5 rounded-md transition">
                      <History size={16} />
                      <span>Satış Geçmişi</span>
                    </button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                    <Users size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-lg font-medium">Henüz kayıtlı müşteri yok.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. YENİ MÜŞTERİ MODALI */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">Yeni Müşteri Ekle</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6">
              {formError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>}
              <form id="customerForm" onSubmit={handleCustomerSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Müşteri / Firma Adı *</label>
                  <input required value={customerForm.name} onChange={(e) => setCustomerForm({...customerForm, name: e.target.value})} className="mt-1 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Örn: Ahmet Yılmaz" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Telefon</label>
                  <input value={customerForm.phone} onChange={(e) => setCustomerForm({...customerForm, phone: e.target.value})} className="mt-1 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Notlar</label>
                  <textarea value={customerForm.note} onChange={(e) => setCustomerForm({...customerForm, note: e.target.value})} className="mt-1 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" rows="3"></textarea>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
              <button onClick={() => setIsCustomerModalOpen(false)} className="px-5 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-200 transition">İptal</button>
              <button type="submit" form="customerForm" className="px-5 py-2 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-700">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SATIŞ YAP MODALI */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-emerald-100 bg-emerald-50/50">
              <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2"><ShoppingBag size={20}/> Yeni Satış Yap</h3>
              <button onClick={() => setIsSaleModalOpen(false)} className="text-emerald-600 hover:text-emerald-800"><X size={20} /></button>
            </div>
            <div className="p-6">
              {formError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>}
              <form id="saleForm" onSubmit={handleSaleSubmit} className="space-y-4">
                
                <div>
                  <label className="text-sm font-medium text-slate-700">Müşteri Seçin *</label>
                  <select required value={saleForm.customerId} onChange={(e) => setSaleForm({...saleForm, customerId: e.target.value})} className="mt-1 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="">-- Müşteri Seç --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Ürün Seçin (Stoktaki Ürünler) *</label>
                  <select required value={saleForm.productId} onChange={handleProductSelect} className="mt-1 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="">-- Ürün Seç --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {p.currentQuantity})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Adet</label>
                    <input type="number" min="1" required value={saleForm.quantity} onChange={(e) => setSaleForm({...saleForm, quantity: e.target.value})} className="mt-1 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Satış Fiyatı (Birim ₺)</label>
                    <input type="number" step="0.01" min="0" required value={saleForm.unitPrice} onChange={(e) => setSaleForm({...saleForm, unitPrice: e.target.value})} className="mt-1 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                </div>

              </form>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
              <button onClick={() => setIsSaleModalOpen(false)} className="px-5 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-200 transition">İptal</button>
              <button type="submit" form="saleForm" className="px-5 py-2 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700">Satışı Tamamla</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MÜŞTERİ GEÇMİŞİ MODALI */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800"><span className="text-indigo-600">{selectedCustomerName}</span> - Satış Geçmişi</h3>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                    <th className="py-3 px-4">Tarih</th>
                    <th className="py-3 px-4">Ürün</th>
                    <th className="py-3 px-4">Özellik</th>
                    <th className="py-3 px-4 text-center">Adet</th>
                    <th className="py-3 px-4 text-right">Birim Fiyat</th>
                    <th className="py-3 px-4 text-right">Toplam Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesHistory.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-500">{new Date(s.createdAt).toLocaleString('tr-TR')}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{s.productName}</td>
                      <td className="py-3 px-4 text-sm text-slate-500">{s.category || '-'} {s.color ? `(${s.color})` : ''}</td>
                      <td className="py-3 px-4 text-center font-bold">{s.quantity}</td>
                      <td className="py-3 px-4 text-right text-slate-600">{(s.unitPrice / 100).toFixed(2)} ₺</td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-600">{(s.totalPrice / 100).toFixed(2)} ₺</td>
                    </tr>
                  ))}
                  {salesHistory.length === 0 && (
                    <tr><td colSpan="6" className="py-8 text-center text-slate-500">Bu müşteriye ait henüz bir satış bulunmuyor.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}