import { useState, useEffect, useRef } from 'react';
import { UserPlus, ShoppingBag, X, History, Search, Banknote, Edit2, Trash2, AlertCircle, Download, FileText, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';

function formatUsd(value) {
  return `${(Number(value || 0) / 100).toFixed(2)}\u00a0$`;
}

function formatTl(value) {
  return `${(Number(value || 0) / 100).toFixed(2)}\u00a0₺`;
}

function formatTurkishPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const normalized = digits.length === 10 && digits.startsWith('5') ? `0${digits}` : digits;
  return /^0\d{10}$/.test(normalized)
    ? `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 9)} ${normalized.slice(9)}`
    : value || '-';
}

function formatStatementDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString('tr-TR');
}

function getCustomerStatementMovements(sales, payments) {
  return [
    ...sales.map((sale) => ({
      createdAt: sale.createdAt,
      type: 'Satış',
      description: [sale.productName, sale.category, sale.color].filter(Boolean).join(' · '),
      quantity: Number(sale.quantity || 0),
      unitPrice: Number(sale.unitPrice || 0),
      amount: Number(sale.totalPrice || 0),
      currency: sale.currency || 'USD',
      note: ''
    })),
    ...payments.map((payment) => ({
      createdAt: payment.createdAt,
      type: 'Tahsilat',
      description: payment.note || 'Müşteri ödemesi',
      quantity: '',
      unitPrice: '',
      amount: Number(payment.amount || 0),
      currency: payment.currency || 'USD',
      note: payment.note || ''
    }))
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [paymentsHistory, setPaymentsHistory] = useState([]);
  
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debtFilter, setDebtFilter] = useState('all');
  const [customerSortBy, setCustomerSortBy] = useState('name');
  const [customerSortDirection, setCustomerSortDirection] = useState('asc');
  const [productSearch, setProductSearch] = useState('');
  const productOptionsRequest = useRef(0);
  const [historyTab, setHistoryTab] = useState('sales');
  const [isExportingHistory, setIsExportingHistory] = useState(false);
  const [historyExportError, setHistoryExportError] = useState('');
  const [isExportingCustomers, setIsExportingCustomers] = useState(false);
  const [customerExportMessage, setCustomerExportMessage] = useState('');

  const [customerForm, setCustomerForm] = useState({ id: null, name: '', phone: '0', email: '', note: '' });
  const [isEditMode, setIsEditMode] = useState(false);

  const [saleForm, setSaleForm] = useState({ customerId: '', productId: '', quantity: 1, unitPrice: '' });
  const [paymentForm, setPaymentForm] = useState({ customerId: '', amount: '', note: '' });
  
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  async function loadData() {
    try {
      const custList = await window.electronAPI.getCustomers();
      setCustomers(custList);
    } catch (err) { console.error("Veriler yüklenirken hata:", err); }
  }

  async function loadProductOptions(search) {
    const requestId = ++productOptionsRequest.current;
    try {
      const result = await window.electronAPI.getProducts({
        page: 1,
        pageSize: 50,
        search,
        activeOnly: true,
        inStockOnly: true
      });
      if (requestId === productOptionsRequest.current) setProductOptions(result.items || []);
    } catch (err) {
      console.error('Satış ürünleri yüklenemedi:', err);
      if (requestId === productOptionsRequest.current) setProductOptions([]);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isSaleModalOpen) return undefined;
    const timer = window.setTimeout(() => { void loadProductOptions(productSearch); }, 200);
    return () => window.clearTimeout(timer);
  }, [isSaleModalOpen, productSearch]);

  async function handleCustomerSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!customerForm.name || !customerForm.name.trim()) return setFormError('Lütfen müşteri adını giriniz.');
    const phone = customerForm.phone === '0' ? '' : customerForm.phone;
    if (!/^0\d{10}$/.test(phone)) return setFormError('Telefon zorunludur; 0 ile başlamalı ve toplam 11 hane olmalıdır.');
    
    try {
      const payload = { ...customerForm, phone };
      if (isEditMode) {
        await window.electronAPI.updateCustomer(payload);
      } else {
        await window.electronAPI.addCustomer(payload);
      }
      closeCustomerModal();
      loadData();
    } catch (err) { setFormError(err.message); }
  }

  async function handleDeleteCustomer(id, name) {
    if (window.confirm(`${name} isimli müşteriyi silmek istiyor musunuz? Satış ve tahsilat geçmişi İşlem Geçmişi ekranında korunur.`)) {
      setPageError('');
      try {
        await window.electronAPI.deleteCustomer(id);
        loadData();
        window.dispatchEvent(new Event('dashboard:refresh'));
      } catch (err) {
        setPageError(err.message);
      }
    }
  }

  function openEditCustomer(customer) {
    const savedPhone = String(customer.phone || '').replace(/\D/g, '');
    const phone = savedPhone ? (savedPhone.startsWith('0') ? savedPhone : `0${savedPhone}`).slice(0, 11) : '0';
    setCustomerForm({ id: customer.id, name: customer.name, phone, email: customer.email, note: customer.note });
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
        customerId: saleForm.customerId,
        productId: saleForm.productId,
        quantity: Number(saleForm.quantity),
        unitPrice: Math.round(Number(String(saleForm.unitPrice).replace(',', '.')) * 100),
        currency: 'USD'
      });
      window.dispatchEvent(new Event('dashboard:refresh'));
      closeSaleModal();
      loadData();
    } catch (err) { setFormError(err.message); }
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!paymentForm.customerId) return setFormError('Müşteri seçimi zorunludur.');
    
    const amountInCents = Math.round(Number(String(paymentForm.amount).replace(',', '.')) * 100);
    if (amountInCents <= 0) return setFormError('Geçerli bir ödeme tutarı girin.');

    const selectedC = customers.find(c => c.id === Number(paymentForm.customerId));
    if (selectedC) {
      const maxAllowed = Number(selectedC.totalSalesUSD || 0) - Number(selectedC.totalPaidUSD || 0);

      if (amountInCents > maxAllowed) {
        return setFormError(`Tahsilat tutarı, kalan borçtan (${formatUsd(maxAllowed)}) fazla olamaz.`);
      }
    }
    try {
      await window.electronAPI.addPayment({
        customerId: paymentForm.customerId,
        amount: amountInCents,
        note: paymentForm.note,
        currency: 'USD'
      });
      window.dispatchEvent(new Event('dashboard:refresh'));
      closePaymentModal();
      loadData();
    } catch (err) { setFormError(err.message); }
  }

  async function openHistory(customer) {
    setSelectedCustomer(customer);
    setHistoryTab('sales');
    setHistoryExportError('');
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
    setPaymentForm({ customerId: customer.id, amount: '', note: 'Nakit Tahsilat' });
    setIsPaymentModalOpen(true);
  }

  function openQuickSale(customerId) {
    productOptionsRequest.current += 1;
    setProductSearch('');
    setProductOptions([]);
    setSaleForm({ customerId, productId: '', quantity: 1, unitPrice: '' });
    setIsSaleModalOpen(true);
  }

  function handleProductSelect(selectedProd) {
    const prodId = selectedProd?.id ?? '';
    setSaleForm(prev => ({
      ...prev,
      productId: String(prodId),
      unitPrice: selectedProd?.retailPrice
        ? (selectedProd.retailPrice / 100).toFixed(2)
        : ''
    }));
    setProductSearch(selectedProd?.name || '');
    setFormError('');
  }

  function closeCustomerModal() { setIsCustomerModalOpen(false); setFormError(''); setIsEditMode(false); setCustomerForm({ id: null, name: '', phone: '0', email: '', note: '' }); }
  function closeSaleModal() { productOptionsRequest.current += 1; setIsSaleModalOpen(false); setFormError(''); setProductSearch(''); setProductOptions([]); setSaleForm({ customerId: '', productId: '', quantity: 1, unitPrice: '' }); }
  function closePaymentModal() { setIsPaymentModalOpen(false); setFormError(''); setPaymentForm({ customerId: '', amount: '', note: '' }); }

  async function exportCustomersExcel() {
    setIsExportingCustomers(true);
    setCustomerExportMessage('');
    try {
      const sortedCustomers = [...customers].sort((left, right) =>
        String(left.name || '').localeCompare(String(right.name || ''), 'tr', { sensitivity: 'base' })
      );
      const XLSX = await import('xlsx');
      const rows = sortedCustomers.map((customer) => {
        const totalSales = Number(customer.totalSalesUSD || 0);
        const totalPaid = Number(customer.totalPaidUSD || 0);
        const totalSalesTL = Number(customer.totalSalesTL || 0);
        const totalPaidTL = Number(customer.totalPaidTL || 0);
        return {
          'Müşteri Adı Soyadı': customer.name || '',
          'Telefon Numarası': customer.phone || '',
          'E-posta Adresi': customer.email || '',
          'Toplam Borçlandırma ($)': totalSales / 100,
          'Tahsil Edilen ($)': totalPaid / 100,
          'Güncel Borç ($)': Math.max(0, totalSales - totalPaid) / 100,
          'Toplam Satış (₺)': totalSalesTL / 100,
          'Tahsilat (₺)': totalPaidTL / 100,
          'Güncel Borç (₺)': Math.max(0, totalSalesTL - totalPaidTL) / 100,
          'Müşteri Notu': customer.note || ''
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 32 }, { wch: 20 }, { wch: 32 }, { wch: 24 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 40 }
      ];
      if (worksheet['!ref']) worksheet['!autofilter'] = { ref: worksheet['!ref'] };
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Müşteriler');
      const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
      const saved = await window.electronAPI.exportExcelFile({
        workbookBytes,
        title: 'Müşteri listesini Excel olarak kaydet',
        defaultName: `musteri-listesi-${new Date().toISOString().slice(0, 10)}.xlsx`
      });
      if (saved?.success) setCustomerExportMessage('Müşteri listesi Excel dosyası kaydedildi.');
    } catch (error) {
      setCustomerExportMessage(error.message || 'Müşteri listesi Excel dosyası oluşturulamadı.');
    } finally {
      setIsExportingCustomers(false);
    }
  }

  async function exportCustomerHistoryExcel() {
    if (!selectedCustomer) return;
    setIsExportingHistory(true);
    setHistoryExportError('');
    try {
      const XLSX = await import('xlsx');
      const movements = getCustomerStatementMovements(salesHistory, paymentsHistory);
      const usdSales = Number(selectedCustomer.totalSalesUSD || 0);
      const usdPayments = Number(selectedCustomer.totalPaidUSD || 0);
      const tlSales = Number(selectedCustomer.totalSalesTL || 0);
      const tlPayments = Number(selectedCustomer.totalPaidTL || 0);
      const customerRows = [
        ['Müşteri Bilgisi', 'Değer'],
        ['Ad Soyad', selectedCustomer.name || ''],
        ['Müşteri No', selectedCustomer.id],
        ['Telefon', selectedCustomer.phone || ''],
        ['E-posta', selectedCustomer.email || ''],
        ['Müşteri Notu', selectedCustomer.note || ''],
        ['Toplam Borçlandırma ($)', usdSales / 100],
        ['Tahsil Edilen ($)', usdPayments / 100],
        ['Güncel Borç ($)', Math.max(0, usdSales - usdPayments) / 100],
        ['Toplam Borçlandırma (₺)', tlSales / 100],
        ['Tahsil Edilen (₺)', tlPayments / 100],
        ['Güncel Borç (₺)', Math.max(0, tlSales - tlPayments) / 100],
        ['Döküm Tarihi', new Date().toLocaleString('tr-TR')]
      ];
      const customerSheet = XLSX.utils.aoa_to_sheet(customerRows);
      customerSheet['!cols'] = [{ wch: 34 }, { wch: 48 }];
      const movementHeaders = ['Tarih / Saat', 'İşlem', 'Açıklama', 'Adet', 'Birim Fiyat', 'Tutar', 'Para Birimi', 'Not'];
      const movementRows = movements.map((movement) => ({
        'Tarih / Saat': formatStatementDate(movement.createdAt),
        'İşlem': movement.type,
        'Açıklama': movement.description,
        'Adet': movement.quantity,
        'Birim Fiyat': movement.unitPrice === '' ? '' : movement.unitPrice / 100,
        'Tutar': movement.amount / 100,
        'Para Birimi': movement.currency,
        'Not': movement.note
      }));
      const movementsSheet = movementRows.length
        ? XLSX.utils.json_to_sheet(movementRows, { header: movementHeaders })
        : XLSX.utils.aoa_to_sheet([movementHeaders]);
      movementsSheet['!cols'] = [{ wch: 23 }, { wch: 14 }, { wch: 40 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 13 }, { wch: 36 }];
      if (movementsSheet['!ref']) movementsSheet['!autofilter'] = { ref: movementsSheet['!ref'] };
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, customerSheet, 'Müşteri Bilgileri');
      XLSX.utils.book_append_sheet(workbook, movementsSheet, 'Cari Hareketler');
      const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
      const safeName = selectedCustomer.name.replace(/[<>:"/\\|?*]/g, '-').trim() || 'musteri';
      const result = await window.electronAPI.exportExcelFile({
        workbookBytes,
        title: `${selectedCustomer.name} cari dökümünü Excel olarak kaydet`,
        defaultName: `cari-dokumu-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`
      });
      if (result?.success) setHistoryExportError('Müşteri bilgileri ve tüm cari hareketleri Excel olarak kaydedildi.');
    } catch (error) {
      setHistoryExportError(error.message || 'Cari döküm Excel dosyası oluşturulamadı.');
    } finally {
      setIsExportingHistory(false);
    }
  }

  async function exportCustomerHistoryPdf() {
    if (!selectedCustomer) return;
    if (typeof window.electronAPI?.exportCustomerStatementPdf !== 'function') {
      setHistoryExportError('PDF dışa aktarma güncellemesi yüklü değil. Electron uygulamasını tamamen kapatıp yeniden başlatın.');
      return;
    }
    setIsExportingHistory(true);
    setHistoryExportError('');
    try {
      const safeName = selectedCustomer.name.replace(/[<>:"/\\|?*]/g, '-').trim() || 'musteri';
      const result = await window.electronAPI.exportCustomerStatementPdf({
        customer: {
          id: selectedCustomer.id,
          name: selectedCustomer.name || '',
          phone: selectedCustomer.phone || '',
          email: selectedCustomer.email || '',
          note: selectedCustomer.note || '',
          totalSalesUSD: Number(selectedCustomer.totalSalesUSD || 0),
          totalPaidUSD: Number(selectedCustomer.totalPaidUSD || 0),
          totalSalesTL: Number(selectedCustomer.totalSalesTL || 0),
          totalPaidTL: Number(selectedCustomer.totalPaidTL || 0)
        },
        movements: getCustomerStatementMovements(salesHistory, paymentsHistory),
        defaultName: `cari-dokumu-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`
      });
      if (result?.success) setHistoryExportError('Müşteri bilgileri ve tüm cari hareketleri PDF olarak kaydedildi.');
    } catch (error) {
      setHistoryExportError(error.message || 'Cari döküm PDF dosyası oluşturulamadı.');
    } finally {
      setIsExportingHistory(false);
    }
  }

  const filteredCustomers = customers
    .filter((customer) => customer.name.toLowerCase().includes(searchTerm.toLowerCase())
      || (customer.phone && customer.phone.includes(searchTerm))
      || (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())))
    .filter((customer) => debtFilter !== 'owing'
      || Number(customer.totalSalesUSD || 0) > Number(customer.totalPaidUSD || 0)
      || Number(customer.totalSalesTL || 0) > Number(customer.totalPaidTL || 0))
    .sort((left, right) => {
      const direction = customerSortDirection === 'asc' ? 1 : -1;
      if (customerSortBy === 'name') {
        return direction * String(left.name || '').localeCompare(String(right.name || ''), 'tr', { sensitivity: 'base' });
      }
      const valuesFor = (customer) => {
        const salesUsd = Number(customer.totalSalesUSD || 0);
        const paidUsd = Number(customer.totalPaidUSD || 0);
        const salesTl = Number(customer.totalSalesTL || 0);
        const paidTl = Number(customer.totalPaidTL || 0);
        if (customerSortBy === 'totalDebt') return [salesUsd, salesTl];
        if (customerSortBy === 'totalPaid') return [paidUsd, paidTl];
        return [Math.max(0, salesUsd - paidUsd), Math.max(0, salesTl - paidTl)];
      };
      const leftValues = valuesFor(left);
      const rightValues = valuesFor(right);
      return direction * (leftValues[0] - rightValues[0] || leftValues[1] - rightValues[1])
        || String(left.name || '').localeCompare(String(right.name || ''), 'tr', { sensitivity: 'base' });
    });
  function changeCustomerSort(field, numeric = false) {
    if (customerSortBy === field) setCustomerSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    else {
      setCustomerSortBy(field);
      setCustomerSortDirection(numeric ? 'desc' : 'asc');
    }
  }
  function customerSortHeading(label, field, numeric = false) {
    const Icon = customerSortBy !== field ? ArrowUpDown : customerSortDirection === 'asc' ? ArrowUp : ArrowDown;
    return <button type="button" onClick={() => changeCustomerSort(field, numeric)} aria-label={`${label}, ${customerSortBy === field && customerSortDirection === 'asc' ? 'artan' : 'azalan'} sırala`} className="inline-flex items-center gap-1.5 hover:text-slate-800">
      <span>{label}</span><Icon size={15} aria-hidden="true" className={customerSortBy === field ? 'text-indigo-600' : 'text-slate-400'} />
    </button>;
  }
  const customerOptions = customers.map((customer) => ({
    value: String(customer.id),
    label: customer.name,
    description: customer.phone || '',
    searchTerms: [customer.phone, customer.email, customer.note]
  }));
  const productSelectOptions = productOptions.map((product) => ({
    value: String(product.id),
    label: product.name,
    description: [product.brand, product.compatibleModel, product.color, product.category].filter(Boolean).join(' · ') || 'Aksesuar',
    meta: `Stok: ${product.currentQuantity}`,
    searchTerms: [product.brand, product.category, product.compatibleModel, product.color],
    data: product
  }));

  return (
    <div className="mx-auto max-w-[1680px] space-y-7 sm:space-y-8">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight sm:text-4xl">Cari Hesaplar</h2>
          <p className="mt-1 text-base text-slate-500">Borçlandırma, tahsilat ve kalan bakiye. Para birimleri ayrı gösterilir.</p>
        </div>
        
        <div className="flex flex-col w-full md:w-auto md:flex-row items-center gap-4">
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input type="text" placeholder="Müşteri, telefon veya e-posta ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-sm transition-all text-sm" />
          </div>
          <select aria-label="Müşteri borç filtresi" value={debtFilter} onChange={(event) => setDebtFilter(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none focus:border-indigo-500 md:w-auto">
            <option value="all">Tüm müşteriler</option>
            <option value="owing">Borcu olanlar</option>
          </select>
          <div className="flex w-full md:w-auto gap-3">
            <button onClick={exportCustomersExcel} disabled={isExportingCustomers} className="flex-1 md:flex-none flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm text-sm font-medium disabled:opacity-50">
              <Download size={18} /> <span>{isExportingCustomers ? 'Hazırlanıyor…' : 'Excel'}</span>
            </button>
            <button onClick={() => setIsCustomerModalOpen(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm text-sm font-medium">
              <UserPlus size={18} /> <span className="hidden md:inline">Yeni Müşteri</span>
            </button>
            <button onClick={() => openQuickSale('')} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 hover:shadow-md transition-all shadow-sm text-sm font-medium">
              <ShoppingBag size={18} /> <span>Satış Yap</span>
            </button>
          </div>
        </div>
      </div>

      {customerExportMessage && <p role="status" className="text-sm text-slate-600">{customerExportMessage}</p>}

      {pageError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2"><AlertCircle size={18}/> <span className="text-sm font-medium">{pageError}</span></div>
          <button onClick={() => setPageError('')} className="text-red-500 hover:text-red-700"><X size={18}/></button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
                <th className="px-6 py-4 font-medium">{customerSortHeading('Müşteri / Firma', 'name')}</th>
                <th className="px-6 py-4 font-medium text-right">{customerSortHeading('Toplam Borçlandırma', 'totalDebt', true)}</th>
                <th className="px-6 py-4 font-medium text-right">{customerSortHeading('Tahsil Edilen', 'totalPaid', true)}</th>
                <th className="px-6 py-4 font-medium text-right">{customerSortHeading('Kalan Borç', 'remainingDebt', true)}</th>
                <th className="px-6 py-4 font-medium text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="customer-table-rows">
              {filteredCustomers.map((c) => {
                const balUSD = Math.max(0, Number(c.totalSalesUSD || 0) - Number(c.totalPaidUSD || 0));
                const balTL = Math.max(0, Number(c.totalSalesTL || 0) - Number(c.totalPaidTL || 0));
                
                return (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <button type="button" onClick={() => openHistory(c)} className="text-left font-bold text-slate-800 text-base hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" aria-label={`${c.name} cari hareketlerini aç`}>{c.name}</button>
                      <div className="text-slate-500 mt-0.5">{formatTurkishPhone(c.phone)}</div>
                      {c.email && <div className="mt-0.5 text-xs text-slate-400">{c.email}</div>}
                    </td>
                    
                    <td className="px-6 py-4 text-right text-slate-500">{formatUsd(c.totalSalesUSD)}{Number(c.totalSalesTL) > 0 && <div className="text-xs">{formatTl(c.totalSalesTL)}</div>}</td>
                    <td className="px-6 py-4 text-right text-emerald-600/80 font-medium">{formatUsd(c.totalPaidUSD)}{Number(c.totalPaidTL) > 0 && <div className="text-xs">{formatTl(c.totalPaidTL)}</div>}</td>
                    <td className={`px-6 py-4 text-right font-bold ${balUSD > 0 || balTL > 0 ? 'text-red-500' : 'text-slate-400 font-medium'}`}>
                      {formatUsd(balUSD)}{balTL > 0 && <div className="text-xs">{formatTl(balTL)}</div>}
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => openQuickPayment(c)} title="Ödeme Al" aria-label={`${c.name} için ödeme al`} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-emerald-500"><Banknote size={18} /></button>
                        <button type="button" onClick={() => openQuickSale(c.id)} title="Satış Yap" aria-label={`${c.name} için satış yap`} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-indigo-500"><ShoppingBag size={18} /></button>
                        <button type="button" onClick={() => openHistory(c)} title="Cari Döküm" aria-label={`${c.name} cari dökümünü aç`} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-blue-500"><History size={18} /></button>
                        <span className="w-px h-5 bg-slate-200 mx-1"></span>
                        <button type="button" onClick={() => openEditCustomer(c)} title="Düzenle" aria-label={`${c.name} bilgilerini düzenle`} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-amber-500"><Edit2 size={16} /></button>
                        <button type="button" onClick={() => handleDeleteCustomer(c.id, c.name)} title="Sil" aria-label={`${c.name} müşterisini sil`} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-rose-500"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCustomers.length === 0 && (<tr><td colSpan="5" className="px-6 py-16 text-center text-slate-400">{debtFilter === 'owing' ? 'Borcu olan müşteri bulunamadı.' : 'Aranan müşteri bulunamadı.'}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="flex max-h-[min(90vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5 sm:px-7">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><UserPlus size={20} /></span>
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-800">{isEditMode ? 'Müşteriyi Düzenle' : 'Yeni Müşteri Ekle'}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Cari hesabı oluşturmak için bilgileri girin</p>
                </div>
              </div>
              <button type="button" onClick={closeCustomerModal} aria-label="Pencereyi kapat" className="rounded-xl bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-7">
              {formError && <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600"><AlertCircle size={17} className="mt-0.5 shrink-0" />{formError}</div>}
              <form id="customerForm" onSubmit={handleCustomerSubmit} className="space-y-4.5">
                <div><label htmlFor="customer-name" className="mb-1.5 block text-sm font-semibold text-slate-700">Firma / Müşteri Adı <span className="text-red-600">*</span></label><input id="customer-name" autoFocus autoComplete="name" required placeholder="Ad soyad veya firma adı" value={customerForm.name} onChange={(e) => { setCustomerForm({...customerForm, name: e.target.value}); setFormError(''); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" /></div>
                <div><label htmlFor="customer-phone" className="mb-1.5 block text-sm font-semibold text-slate-700">Telefon <span className="text-red-600">*</span></label><input id="customer-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={11} required placeholder="05XXXXXXXXX" value={customerForm.phone} onChange={(e) => { const digits = e.target.value.replace(/\D/g, ''); const phone = digits ? (digits.startsWith('0') ? digits : `0${digits}`).slice(0, 11) : '0'; setCustomerForm((current) => ({ ...current, phone })); setFormError(''); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" /><p className="mt-1.5 text-xs text-slate-400">Türkiye numarası · 0 ile başlayan 11 hane</p></div>
                <div><label htmlFor="customer-email" className="mb-1.5 block text-sm font-semibold text-slate-700">E-posta</label><input id="customer-email" type="email" autoComplete="email" placeholder="ornek@eposta.com" value={customerForm.email || ''} onChange={(e) => { setCustomerForm((current) => ({ ...current, email: e.target.value })); setFormError(''); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" /></div>
                <div><label htmlFor="customer-note" className="mb-1.5 block text-sm font-semibold text-slate-700">Notlar</label><textarea id="customer-note" placeholder="Cari hesapla ilgili ek bilgi..." value={customerForm.note} onChange={(e) => setCustomerForm({...customerForm, note: e.target.value})} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" rows="3"></textarea></div>
              </form>
            </div>
            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:px-7">
              <button type="button" onClick={closeCustomerModal} className="rounded-xl px-5 py-2.5 font-semibold text-slate-600 transition-colors hover:bg-slate-200">İptal</button>
              <button type="submit" form="customerForm" className="rounded-xl bg-indigo-600 px-6 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20">{isEditMode ? 'Güncelle' : 'Kaydet'}</button>
            </div>
          </div>
        </div>
      )}

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
                    <SearchableSelect options={customerOptions} value={saleForm.customerId} onChange={(option) => { setSaleForm((current) => ({ ...current, customerId: option?.value || '' })); setFormError(''); }} placeholder="Müşteri bulunamadı." searchPlaceholder="Müşteri ara: ad veya telefon..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Ürün Seçin</label>
                    <SearchableSelect
                      options={productSelectOptions}
                      value={saleForm.productId}
                      query={productSearch}
                      onQueryChange={(query) => {
                        productOptionsRequest.current += 1;
                        setProductSearch(query);
                      }}
                      onChange={(option) => {
                        if (option) handleProductSelect(option.data);
                        else setSaleForm((current) => ({ ...current, productId: '', unitPrice: '' }));
                      }}
                      placeholder="Stoklu ürün bulunamadı."
                      searchPlaceholder="Ürün ara: ad, marka veya model..."
                    />
                    {saleForm.productId && <p className="mt-1.5 text-xs text-emerald-700">Ürün seçildi · Değiştirmek için arama alanına yazın.</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5">
                  <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Adet</label><input type="number" min="1" value={saleForm.quantity} onChange={(e) => setSaleForm({...saleForm, quantity: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" /></div>
                  <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Birim Fiyat ($)</label><input type="number" step="0.01" min="0" value={saleForm.unitPrice} onChange={(e) => setSaleForm({...saleForm, unitPrice: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" /></div>
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
          <div className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5">
              <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2"><Banknote size={20} className="text-emerald-600"/> Tahsilat</h3>
              <button onClick={closePaymentModal} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-1.5 rounded-full transition-colors"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {formError && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">⚠️ {formError}</div>}
              <form id="paymentForm" onSubmit={handlePaymentSubmit} className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Müşteri Cari</label>
                  <SearchableSelect options={customerOptions} value={paymentForm.customerId} onChange={(option) => { setPaymentForm((current) => ({ ...current, customerId: option?.value || '' })); setFormError(''); }} placeholder="Müşteri bulunamadı." searchPlaceholder="Müşteri ara: ad veya telefon..." openOnFocus={false} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Tutar ($)</label>
                  <input type="number" step="0.01" min="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full px-4 py-2.5 bg-white border-2 border-emerald-100 rounded-xl focus:border-emerald-500 outline-none font-bold text-emerald-700" placeholder="0.00" />
                </div>
                <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Açıklama</label><input value={paymentForm.note} onChange={(e) => setPaymentForm({...paymentForm, note: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" /></div>
              </form>
            </div>
            <div className="flex shrink-0 justify-end gap-3 bg-slate-50/50 px-6 py-5">
              <button onClick={closePaymentModal} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors">İptal</button>
              <button type="submit" form="paymentForm" className="px-6 py-2.5 rounded-xl font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {isHistoryModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-white">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">{selectedCustomer.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">Cari Hareket Dökümü</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button onClick={exportCustomerHistoryExcel} disabled={isExportingHistory} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"><Download size={16} />{isExportingHistory ? 'Hazırlanıyor…' : 'Excel’e Aktar'}</button>
                  <button onClick={exportCustomerHistoryPdf} disabled={isExportingHistory} className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"><FileText size={16} />PDF indir</button>
                  <button onClick={() => { setIsHistoryModalOpen(false); openQuickPayment(selectedCustomer); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold rounded-xl transition-colors text-sm"><Banknote size={16} />Ödeme Al</button>
                  <button onClick={() => { setIsHistoryModalOpen(false); openQuickSale(selectedCustomer.id); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold rounded-xl transition-colors text-sm"><ShoppingBag size={16} />Satış Yap</button>
                  <button onClick={() => setIsHistoryModalOpen(false)} className="ml-2 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full transition-colors"><X size={20} /></button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Toplam Borçlandırma</p>
                <div className="text-lg font-bold text-slate-700">{formatUsd(selectedCustomer.totalSalesUSD)}{Number(selectedCustomer.totalSalesTL) > 0 && <div className="text-sm">{formatTl(selectedCustomer.totalSalesTL)}</div>}</div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tahsilat</p>
                <div className="text-lg font-bold text-emerald-600">{formatUsd(selectedCustomer.totalPaidUSD)}{Number(selectedCustomer.totalPaidTL) > 0 && <div className="text-sm">{formatTl(selectedCustomer.totalPaidTL)}</div>}</div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Kalan Borç</p>
                  <div className="text-lg font-bold text-red-500">
                    {formatUsd(Math.max(Number(selectedCustomer.totalSalesUSD || 0) - Number(selectedCustomer.totalPaidUSD || 0), 0))}
                    {Number(selectedCustomer.totalSalesTL || 0) > Number(selectedCustomer.totalPaidTL || 0) && <div className="text-sm">{formatTl(Number(selectedCustomer.totalSalesTL || 0) - Number(selectedCustomer.totalPaidTL || 0))}</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex px-8 border-b border-slate-100 bg-white">
              <button onClick={() => setHistoryTab('sales')} className={`py-4 px-2 mr-6 text-sm font-semibold transition-all relative ${historyTab === 'sales' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Satış Fişleri{historyTab === 'sales' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></div>}</button>
              <button onClick={() => setHistoryTab('payments')} className={`py-4 px-2 text-sm font-semibold transition-all relative ${historyTab === 'payments' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>Tahsilat Makbuzları{historyTab === 'payments' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-t-full"></div>}</button>
            </div>

            {historyExportError && <div role="status" className="mx-8 mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">{historyExportError}</div>}

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
                          <td className="py-4 px-6 text-right font-bold text-slate-800">{s.currency === 'TL' ? formatTl(s.totalPrice) : formatUsd(s.totalPrice)}</td>
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
                          <td className="py-4 px-6 text-right font-bold text-emerald-600">+{p.currency === 'TL' ? formatTl(p.amount) : formatUsd(p.amount)}</td>
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
