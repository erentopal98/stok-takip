import React, { useState, useEffect } from 'react';
import { Users, UserPlus, ShoppingBag, X, History, Search, Banknote, Receipt, Edit2, Trash2, AlertCircle } from 'lucide-react';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [paymentsHistory, setPaymentsHistory] = useState([]);
  
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState(''); // Silme işlemi vb. sayfa hataları için
  const [searchTerm, setSearchTerm] = useState('');
  const [historyTab, setHistoryTab] = useState('sales');

  // Müşteri Formu ve Düzenleme State'i
  const [customerForm, setCustomerForm] = useState({ id: null, name: '', phone: '', email: '', note: '' });
  const [isEditMode, setIsEditMode] = useState(false);

  const [saleForm, setSaleForm] = useState({ customerId: '', productId: '', quantity: 1, unitPrice: '', currency: 'USD' });
  const [paymentForm, setPaymentForm] = useState({ customerId: '', amount: '', note: '', currency: 'TL' });
  
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  async function loadData() {
    try {
      const [custList, prodList] = await Promise.all([
        window.electronAPI.getCustomers(),
        window.electronAPI.getProducts()
      ]);
      setCustomers(custList);
      setProducts(prodList.filter(p => p.currentQuantity > 0));
    } catch (err) { console.error("Veriler yüklenirken hata:", err); }
  }

  useEffect(() => { loadData(); }, []);

  // MÜŞTERİ EKLEME VE GÜNCELLEME
  async function handleCustomerSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!customerForm.name || !customerForm.name.trim()) return setFormError('Lütfen müşteri adını giriniz.');
    
    try {
      if (isEditMode) {
        await window.electronAPI.updateCustomer(customerForm);
      } else {
        await window.electronAPI.addCustomer(customerForm);
      }
      closeCustomerModal();
      loadData();
    } catch (err) { setFormError(err.message); }
  }

  // MÜŞTERİ SİLME
  async function handleDeleteCustomer(id, name) {
    if (window.confirm(`${name} isimli müşteriyi silmek istediğinize emin misiniz?`)) {
      setPageError('');
      try {
        await window.electronAPI.deleteCustomer(id);
        loadData();
      } catch (err) {
        setPageError(err.message);
      }
    }
  }

  // MÜŞTERİ DÜZENLEME MODALINI AÇ
  function openEditCustomer(customer) {
    setCustomerForm({ id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, note: customer.note });
    setIsEditMode(true);
    setIsCustomerModalOpen(true);
  }

  async function handleSaleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!saleForm.customerId || !saleForm.productId) return setFormError('Müşteri ve ürün seçimi zorunludur.');
    if (!saleForm.quantity || saleForm.quantity < 1) return setFormError('Geçerli bir adet girin.');
    if (saleForm.unitPrice === '' || Number(saleForm.unitPrice) < 0) return setFormError('Geçerli bir fiyat girin.');
    try {
      await window.electronAPI.makeSale({
        customerId: saleForm.customerId, productId: saleForm.productId,
        quantity: saleForm.quantity,
        unitPrice: Math.round(Number(String(saleForm.unitPrice).replace(',', '.')) * 100),
        currency: saleForm.currency
      });
      closeSaleModal();
      loadData();
    } catch (err) { setFormError(err.message); }
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!paymentForm.customerId) return setFormError('Müşteri seçimi zorunludur.');
    
    const amountInKurus = Math.round(Number(String(paymentForm.amount).replace(',', '.')) * 100);
    if (amountInKurus <= 0) return setFormError('Geçerli bir ödeme tutarı girin.');

    const selectedC = customers.find(c => c.id === Number(paymentForm.customerId));
    if (selectedC) {
      const isUSD = paymentForm.currency === 'USD';
      const maxAllowed = isUSD 
        ? (selectedC.totalSalesUSD - selectedC.totalPaidUSD) 
        : (selectedC.totalSalesTL - selectedC.totalPaidTL);

      if (amountInKurus > maxAllowed) {
        return setFormError(`Tahsilat tutarı, kalan ${isUSD ? 'Dolar ($)' : 'TL (₺)'} borcundan (${(maxAllowed / 100).toFixed(2)}) fazla olamaz.`);
      }
    }
    try {
      await window.electronAPI.addPayment({
        customerId: paymentForm.customerId, amount: amountInKurus,
        note: paymentForm.note, currency: paymentForm.currency
      });
      closePaymentModal();
      loadData();
    } catch (err) { setFormError(err.message); }
  }

  async function openHistory(customer) {
    setSelectedCustomer(customer);
    setHistoryTab('sales');
    try {
      const [sales, payments] = await Promise.all([
        window.electronAPI.getCustomerSales(customer.id),
        window.electronAPI.getCustomerPayments(customer.id)
      ]);
      setSalesHistory(sales);
      setPaymentsHistory(payments);
      setIsHistoryModalOpen(true);
    } catch (err) { console.error("Geçmiş yüklenemedi:", err); }
  }

  function openQuickPayment(customer) {
    let defaultCurrency = 'TL';
    const balTL = customer.totalSalesTL - customer.totalPaidTL;
    const balUSD = customer.totalSalesUSD - customer.totalPaidUSD;
    if (balUSD > 0 && balTL <= 0) defaultCurrency = 'USD';
    setPaymentForm({ customerId: customer.id, amount: '', note: 'Nakit Tahsilat', currency: defaultCurrency });
    setIsPaymentModalOpen(true);
  }

  function openQuickSale(customerId) {
    setSaleForm({ customerId, productId: '', quantity: 1, unitPrice: '', currency: 'USD' });
    setIsSaleModalOpen(true);
  }

  function handleProductSelect(e) {
    const prodId = e.target.value;
    const selectedProd = products.find(p => p.id === Number(prodId));
    setSaleForm(prev => ({ ...prev, productId: prodId, unitPrice: selectedProd ? (selectedProd.retailPrice / 100).toFixed(2) : '' }));
    setFormError('');
  }

  function closeCustomerModal() { setIsCustomerModalOpen(false); setFormError(''); setIsEditMode(false); setCustomerForm({ id: null, name: '', phone: '', email: '', note: '' }); }
  function closeSaleModal() { setIsSaleModalOpen(false); setFormError(''); setSaleForm({ customerId: '', productId: '', quantity: 1, unitPrice: '', currency: 'USD' }); }
  function closePaymentModal() { setIsPaymentModalOpen(false); setFormError(''); setPaymentForm({ customerId: '', amount: '', note: '', currency: 'TL' }); }

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone && c.phone.includes(searchTerm)));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Cari Hesaplar</h2>
          <p className="text-slate-500 mt-1">Müşteri portföyü ve alacak verecek durumu.</p>
        </div>
        
        <div className="flex flex-col w-full md:w-auto md:flex-row items-center gap-4">
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input type="text" placeholder="Müşteri veya telefon ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-sm transition-all text-sm" />
          </div>
          <div className="flex w-full md:w-auto gap-3">
            <button onClick={() => setIsCustomerModalOpen(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm text-sm font-medium">
              <UserPlus size={18} /> <span className="hidden md:inline">Yeni Müşteri</span>
            </button>
            <button onClick={() => { setSaleForm({...saleForm, customerId: '', currency: 'USD'}); setIsSaleModalOpen(true); }} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 hover:shadow-md transition-all shadow-sm text-sm font-medium">
              <ShoppingBag size={18} /> <span>Satış Yap</span>
            </button>
          </div>
        </div>
      </div>

      {/* Silme Hatası Uyarı Bandı */}
      {pageError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2"><AlertCircle size={18}/> <span className="text-sm font-medium">{pageError}</span></div>
          <button onClick={() => setPageError('')} className="text-red-500 hover:text-red-700"><X size={18}/></button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
                <th className="px-6 py-4 font-medium">Müşteri / Firma</th>
                {/* Metinler değiştirildi */}
                <th className="px-6 py-4 font-medium text-right">Toplam Borç</th>
                <th className="px-6 py-4 font-medium text-right">Tahsil Edilen</th>
                <th className="px-6 py-4 font-medium text-right">Kalan Borç</th>
                <th className="px-6 py-4 font-medium text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredCustomers.map((c) => {
                const balTL = c.totalSalesTL - c.totalPaidTL;
                const balUSD = c.totalSalesUSD - c.totalPaidUSD;
                
                return (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 text-base">{c.name}</div>
                      <div className="text-slate-500 mt-0.5">{c.phone || '-'}</div>
                    </td>
                    
                    <td className="px-6 py-4 text-right text-slate-500 space-y-1">
                      {c.totalSalesTL > 0 && <div>{(c.totalSalesTL / 100).toFixed(2)} ₺</div>}
                      {c.totalSalesUSD > 0 && <div>{(c.totalSalesUSD / 100).toFixed(2)} $</div>}
                      {c.totalSalesTL === 0 && c.totalSalesUSD === 0 && <div>0.00 ₺</div>}
                    </td>
                    
                    <td className="px-6 py-4 text-right text-emerald-600/80 font-medium space-y-1">
                      {c.totalPaidTL > 0 && <div>{(c.totalPaidTL / 100).toFixed(2)} ₺</div>}
                      {c.totalPaidUSD > 0 && <div>{(c.totalPaidUSD / 100).toFixed(2)} $</div>}
                      {c.totalPaidTL === 0 && c.totalPaidUSD === 0 && <div>0.00 ₺</div>}
                    </td>
                    
                    <td className="px-6 py-4 text-right font-bold space-y-1">
                      {balTL > 0 && <div className="text-red-500">{(balTL / 100).toFixed(2)} ₺</div>}
                      {balTL === 0 && <div className="text-slate-400 font-medium">0.00 ₺</div>}
                      {balUSD > 0 && <div className="text-red-500">{(balUSD / 100).toFixed(2)} $</div>}
                    </td>
                    
                    <td className="px-6 py-4">
                      {/* DÜZENLE VE SİL BUTONLARI EKLENDİ */}
                      <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openQuickPayment(c)} title="Ödeme Al" className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"><Banknote size={18} /></button>
                        <button onClick={() => openQuickSale(c.id)} title="Satış Yap" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><ShoppingBag size={18} /></button>
                        <button onClick={() => openHistory(c)} title="Cari Döküm" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><History size={18} /></button>
                        <span className="w-px h-5 bg-slate-200 mx-1"></span>
                        <button onClick={() => openEditCustomer(c)} title="Düzenle" className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"><Edit2 size={16} /></button>
                        <button onClick={() => handleDeleteCustomer(c.id, c.name)} title="Sil" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCustomers.length === 0 && (<tr><td colSpan="5" className="px-6 py-16 text-center text-slate-400">Aranan müşteri bulunamadı.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {/* MÜŞTERİ EKLE / DÜZENLE MODALI */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-white">
              <h3 className="text-lg font-bold text-slate-800">{isEditMode ? 'Müşteriyi Düzenle' : 'Yeni Müşteri Ekle'}</h3>
              <button onClick={closeCustomerModal} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-1.5 rounded-full transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6">
              {formError && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">⚠️ {formError}</div>}
              <form id="customerForm" onSubmit={handleCustomerSubmit} className="space-y-4">
                <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Firma / Müşteri Adı</label><input value={customerForm.name} onChange={(e) => { setCustomerForm({...customerForm, name: e.target.value}); setFormError(''); }} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" /></div>
                <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Telefon</label><input value={customerForm.phone} onChange={(e) => setCustomerForm({...customerForm, phone: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" /></div>
                <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Notlar</label><textarea value={customerForm.note} onChange={(e) => setCustomerForm({...customerForm, note: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none resize-none" rows="3"></textarea></div>
              </form>
            </div>
            <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button onClick={closeCustomerModal} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors">İptal</button>
              <button type="submit" form="customerForm" className="px-6 py-2.5 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors">{isEditMode ? 'Güncelle' : 'Kaydet'}</button>
            </div>
          </div>
        </div>
      )}

      {/* DİĞER MODALLAR (Satış, Tahsilat) AYNEN KALDI, KOD UZAMAMASI İÇİN DÖKÜM METİNLERİ GÜNCELLENDİ */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ShoppingBag size={20} className="text-indigo-600"/> Satış İşlemi</h3>
              <button onClick={closeSaleModal} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-1.5 rounded-full transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6">
              {formError && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">⚠️ {formError}</div>}
              <form id="saleForm" onSubmit={handleSaleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Müşteri Seçin</label>
                    <select value={saleForm.customerId} onChange={(e) => { setSaleForm({...saleForm, customerId: e.target.value}); setFormError(''); }} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500">
                      <option value="">-- Listeden Seç --</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Ürün Seçin</label>
                    <select value={saleForm.productId} onChange={handleProductSelect} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500">
                      <option value="">-- Listeden Seç --</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {p.currentQuantity})</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-slate-100 pt-5">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Kur / Para Birimi</label>
                    <select value={saleForm.currency} onChange={(e) => setSaleForm({...saleForm, currency: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-indigo-700">
                      <option value="USD">Dolar ($)</option>
                      <option value="TL">TL (₺)</option>
                    </select>
                  </div>
                  <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Adet</label><input type="number" min="1" value={saleForm.quantity} onChange={(e) => setSaleForm({...saleForm, quantity: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" /></div>
                  <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Birim Fiyat</label><input type="number" step="0.01" min="0" value={saleForm.unitPrice} onChange={(e) => setSaleForm({...saleForm, unitPrice: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" /></div>
                </div>
              </form>
            </div>
            <div className="px-6 py-5 bg-slate-50/50 flex justify-end gap-3">
              <button onClick={closeSaleModal} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors">İptal</button>
              <button type="submit" form="saleForm" className="px-6 py-2.5 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors">Satışı Onayla</button>
            </div>
          </div>
        </div>
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2"><Banknote size={20} className="text-emerald-600"/> Tahsilat Makbuzu</h3>
              <button onClick={closePaymentModal} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-1.5 rounded-full transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6">
              {formError && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">⚠️ {formError}</div>}
              <form id="paymentForm" onSubmit={handlePaymentSubmit} className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Müşteri Cari</label>
                  <select value={paymentForm.customerId} onChange={(e) => { setPaymentForm({...paymentForm, customerId: e.target.value}); setFormError(''); }} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                    <option value="">-- Müşteri Seç --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Para Birimi</label>
                    <select value={paymentForm.currency} onChange={(e) => setPaymentForm({...paymentForm, currency: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-emerald-700">
                      <option value="TL">TL (₺)</option>
                      <option value="USD">Dolar ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Tutar</label>
                    <input type="number" step="0.01" min="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full px-4 py-2.5 bg-white border-2 border-emerald-100 rounded-xl focus:border-emerald-500 outline-none font-bold text-emerald-700" placeholder="0.00" />
                  </div>
                </div>
                <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Açıklama</label><input value={paymentForm.note} onChange={(e) => setPaymentForm({...paymentForm, note: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" /></div>
              </form>
            </div>
            <div className="px-6 py-5 bg-slate-50/50 flex justify-end gap-3">
              <button onClick={closePaymentModal} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors">İptal</button>
              <button type="submit" form="paymentForm" className="px-6 py-2.5 rounded-xl font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* CARİ DÖKÜM MODALI (Metinler Toplam Borç/Kalan Borç olarak güncellendi) */}
      {isHistoryModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-white">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">{selectedCustomer.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">Cari Hareket Dökümü</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setIsHistoryModalOpen(false); openQuickPayment(selectedCustomer); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold rounded-xl transition-colors text-sm"><Banknote size={16} />Ödeme Al</button>
                  <button onClick={() => { setIsHistoryModalOpen(false); openQuickSale(selectedCustomer.id); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold rounded-xl transition-colors text-sm"><ShoppingBag size={16} />Satış Yap</button>
                  <button onClick={() => setIsHistoryModalOpen(false)} className="ml-2 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full transition-colors"><X size={20} /></button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Toplam Borç</p>
                  <div className="text-lg font-bold text-slate-700 space-y-0.5">
                     {selectedCustomer.totalSalesTL > 0 && <div>{(selectedCustomer.totalSalesTL / 100).toFixed(2)} ₺</div>}
                     {selectedCustomer.totalSalesUSD > 0 && <div>{(selectedCustomer.totalSalesUSD / 100).toFixed(2)} $</div>}
                     {selectedCustomer.totalSalesTL === 0 && selectedCustomer.totalSalesUSD === 0 && <div>0.00 ₺</div>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tahsilat</p>
                  <div className="text-lg font-bold text-emerald-600 space-y-0.5">
                     {selectedCustomer.totalPaidTL > 0 && <div>{(selectedCustomer.totalPaidTL / 100).toFixed(2)} ₺</div>}
                     {selectedCustomer.totalPaidUSD > 0 && <div>{(selectedCustomer.totalPaidUSD / 100).toFixed(2)} $</div>}
                     {selectedCustomer.totalPaidTL === 0 && selectedCustomer.totalPaidUSD === 0 && <div>0.00 ₺</div>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Kalan Borç</p>
                  <div className="text-lg font-bold text-red-500 space-y-0.5">
                     {(selectedCustomer.totalSalesTL - selectedCustomer.totalPaidTL) > 0 && <div>{((selectedCustomer.totalSalesTL - selectedCustomer.totalPaidTL) / 100).toFixed(2)} ₺</div>}
                     {(selectedCustomer.totalSalesTL - selectedCustomer.totalPaidTL) === 0 && <div className="text-slate-400">0.00 ₺</div>}
                     {(selectedCustomer.totalSalesUSD - selectedCustomer.totalPaidUSD) > 0 && <div>{((selectedCustomer.totalSalesUSD - selectedCustomer.totalPaidUSD) / 100).toFixed(2)} $</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex px-8 border-b border-slate-100 bg-white">
              <button onClick={() => setHistoryTab('sales')} className={`py-4 px-2 mr-6 text-sm font-semibold transition-all relative ${historyTab === 'sales' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Satış Fişleri{historyTab === 'sales' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></div>}</button>
              <button onClick={() => setHistoryTab('payments')} className={`py-4 px-2 text-sm font-semibold transition-all relative ${historyTab === 'payments' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>Tahsilat Makbuzları{historyTab === 'payments' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-t-full"></div>}</button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
              {historyTab === 'sales' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead><tr className="bg-slate-50/50 text-slate-400 border-b border-slate-100"><th className="py-4 px-6 font-medium">Tarih / Saat</th><th className="py-4 px-6 font-medium">Ürün Açıklaması</th><th className="py-4 px-6 font-medium text-center">Adet</th><th className="py-4 px-6 font-medium text-right">Tutar</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {salesHistory.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-6 text-slate-500">{new Date(s.createdAt).toLocaleDateString('tr-TR')} <span className="text-slate-300 ml-1">{new Date(s.createdAt).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</span></td>
                          <td className="py-4 px-6 text-slate-700 font-medium">{s.productName}</td>
                          <td className="py-4 px-6 text-slate-500 text-center">x{s.quantity}</td>
                          <td className="py-4 px-6 text-right font-bold text-slate-800">{(s.totalPrice / 100).toFixed(2)} <span className="text-slate-400 font-normal ml-0.5">{s.currency === 'USD' ? '$' : '₺'}</span></td>
                        </tr>
                      ))}
                      {salesHistory.length === 0 && <tr><td colSpan="4" className="py-16 text-center text-slate-400">Bu müşteriye ait satış kaydı yok.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              {historyTab === 'payments' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead><tr className="bg-slate-50/50 text-slate-400 border-b border-slate-100"><th className="py-4 px-6 font-medium">Tarih / Saat</th><th className="py-4 px-6 font-medium">Açıklama / Not</th><th className="py-4 px-6 font-medium text-right">Tahsil Edilen</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {paymentsHistory.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-6 text-slate-500">{new Date(p.createdAt).toLocaleDateString('tr-TR')} <span className="text-slate-300 ml-1">{new Date(p.createdAt).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</span></td>
                          <td className="py-4 px-6 text-slate-700 font-medium">{p.note}</td>
                          <td className="py-4 px-6 text-right font-bold text-emerald-600">+{(p.amount / 100).toFixed(2)} <span className="text-emerald-400/80 font-normal ml-0.5">{p.currency === 'USD' ? '$' : '₺'}</span></td>
                        </tr>
                      ))}
                      {paymentsHistory.length === 0 && <tr><td colSpan="3" className="py-16 text-center text-slate-400">Bu müşteriye ait ödeme kaydı yok.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}