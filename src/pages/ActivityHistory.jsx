import { useEffect, useRef, useState } from 'react';
import { Download, History, Search, X, CalendarDays } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';

const labels = {
  SALE: 'Satış',
  PAYMENT: 'Tahsilat',
  DEBT_SETTLED: 'Borç Kapandı',
  STOCK_IN: 'Stok Girişi',
  STOCK_OUT: 'Stok Çıkışı',
  INITIAL_STOCK: 'İlk Stok',
  PRODUCT_DEACTIVATED: 'Ürün Pasife Alındı'
};

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('tr-TR');
}

function formatAmount(value, currency = 'USD') {
  const symbol = currency === 'TL' ? '₺' : '$';
  return `${(Number(value || 0) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function currentDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function rolling30DayStartValue() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function ActivityHistory({ onNavigate }) {
  const [entries, setEntries] = useState([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const [startDate, setStartDate] = useState(rolling30DayStartValue);
  const [endDate, setEndDate] = useState(currentDateValue);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState('filtered');
  const [exportMonth, setExportMonth] = useState(currentMonthValue);
  const requestId = useRef(0);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      window.electronAPI.getActivityHistory({ page, pageSize: 50, search, eventType, startDate, endDate })
        .then((result) => {
          if (currentRequest !== requestId.current) return;
          setEntries(result?.items || []);
          setTotalEntries(Number(result?.total || 0));
          setPageCount(Number(result?.pageCount || 1));
          if (result?.page && result.page !== page) setPage(result.page);
          setError('');
        })
        .catch((loadError) => { if (currentRequest === requestId.current) setError(loadError.message || 'İşlem geçmişi yüklenemedi.'); })
        .finally(() => { if (currentRequest === requestId.current) setIsLoading(false); });
    }, 150);
    return () => { window.clearTimeout(timer); };
  }, [page, search, eventType, startDate, endDate]);

  async function exportExcel() {
    setIsExporting(true);
    setError('');
    try {
      const exportFilters = { eventType, search, allTime: true };
      if (exportScope === 'month') exportFilters.month = exportMonth;
      else {
        if (startDate) exportFilters.startDate = startDate;
        if (endDate) exportFilters.endDate = endDate;
      }
      const exportEntries = await window.electronAPI.getActivityHistory(exportFilters);
      if (!exportEntries.length) {
        setError('Seçilen dönemde işlem kaydı bulunamadı.');
        return;
      }
      const XLSX = await import('xlsx');
      const rows = exportEntries.map((entry) => ({
        'Tarih / Saat': formatDateTime(entry.createdAt),
        'İşlem': labels[entry.eventType] || entry.eventType,
        'Müşteri': entry.customerName || '',
        'Ürün': entry.productName || '',
        'Adet': entry.quantity ? Math.abs(Number(entry.quantity)) : '',
        'Birim Fiyat': Number(entry.unitPrice || 0) / 100,
        'Tutar': entry.eventType === 'DEBT_SETTLED' ? '' : Number(entry.amount || 0) / 100,
        'Para Birimi': entry.currency || 'USD',
        'Önceki Stok': entry.previousQuantity ?? '',
        'Yeni Stok': entry.newQuantity ?? '',
        'Not': entry.note || ''
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 32 }, { wch: 10 },
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 36 }
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'İşlem Geçmişi');
      const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
      const result = await window.electronAPI.exportActivityHistoryExcel(bytes);
      if (result?.canceled) return;
      if (result?.success) {
        setError(`Excel dosyası kaydedildi (${exportScope === 'all' ? 'tüm zamanlar' : exportScope === 'month' ? exportMonth : 'ekrandaki filtreler'}).`);
        setIsExportModalOpen(false);
      }
    } catch (exportError) {
      setError(exportError.message || 'Excel dosyası kaydedilemedi.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-7 sm:space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 sm:text-4xl">İşlem Geçmişi</h2>
        <p className="mt-1 text-base text-slate-500">Satış, tahsilat ve stok hareketleri tarihe göre kaydedilir; geçmişe sayfalarla ulaşabilirsin.</p>
        </div>
        <button type="button" onClick={() => { setError(''); setIsExportModalOpen(true); }} disabled={isExporting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
          <Download size={18} /> {isExporting ? 'Hazırlanıyor…' : 'Excel’e Aktar'}
        </button>
      </div>

      {error && <div role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{error}</div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_17rem_10rem_10rem]">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400"><Search size={18} /></span>
          <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Müşteri, ürün veya işlem ara..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 outline-none focus:border-indigo-500" />
        </div>
        <SearchableSelect
          options={[{ value: '', label: 'Tüm İşlemler' }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]}
          value={eventType}
          onChange={(option) => { setEventType(option?.value || ''); setPage(1); }}
          searchPlaceholder="İşlem türüne göre filtrele..."
          placeholder="İşlem türü bulunamadı."
        />
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-500"><CalendarDays size={15} /><input aria-label="Başlangıç tarihi" type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} className="min-w-0 bg-transparent py-2.5 outline-none" /></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-500"><CalendarDays size={15} /><input aria-label="Bitiş tarihi" type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} className="min-w-0 bg-transparent py-2.5 outline-none" /></label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center gap-2 font-semibold text-slate-800"><History size={18} className="text-slate-500" /> Kayıtlar</div>
          <span className="text-sm text-slate-500">{isLoading ? 'Yükleniyor…' : `${totalEntries.toLocaleString('tr-TR')} kayıt · Sayfa ${page} / ${pageCount}`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-base">
            <thead><tr className="border-b border-slate-100 bg-white text-slate-500">
              <th className="px-5 py-3.5 font-medium">Tarih / Saat</th>
              <th className="px-5 py-3.5 font-medium">İşlem</th>
              <th className="px-5 py-3.5 font-medium">Müşteri</th>
              <th className="px-5 py-3.5 font-medium">Ürün</th>
              <th className="px-5 py-3.5 text-right font-medium">Adet</th>
              <th className="px-5 py-3.5 text-right font-medium">Birim Fiyat</th>
              <th className="px-5 py-3.5 text-right font-medium">Tutar</th>
              <th className="px-5 py-3.5 font-medium">Not</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.sourceKey} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDateTime(entry.createdAt)}</td>
                  <td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${entry.eventType === 'PAYMENT' ? 'bg-emerald-50 text-emerald-700' : entry.eventType === 'DEBT_SETTLED' ? 'border border-emerald-200 bg-white text-emerald-700' : entry.eventType === 'SALE' ? 'bg-indigo-50 text-indigo-700' : ['STOCK_IN', 'INITIAL_STOCK'].includes(entry.eventType) ? 'bg-sky-50 text-sky-700' : entry.eventType === 'STOCK_OUT' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{labels[entry.eventType] || entry.eventType}</span>{entry.eventType === 'DEBT_SETTLED' && <span className="mt-1 block text-[11px] text-slate-400">Tahsilatla ilişkili durum kaydı</span>}</td>
                  <td className="px-5 py-3.5 font-medium text-slate-700">{entry.customerName ? <button type="button" onClick={() => onNavigate?.('customers')} className="max-w-[220px] truncate text-left hover:text-indigo-700 hover:underline" title="Cari Hesaplar sayfasına git">{entry.customerName}</button> : '—'}</td>
                  <td className="px-5 py-3.5 text-slate-700">{entry.productName ? <button type="button" onClick={() => onNavigate?.('products')} className="max-w-[240px] truncate text-left hover:text-indigo-700 hover:underline" title="Ürün Envanteri sayfasına git">{entry.productName}</button> : '—'}</td>
                  <td className="px-5 py-3.5 text-right text-slate-600">{entry.quantity ? Math.abs(Number(entry.quantity)) : '—'}</td>
                  <td className="px-5 py-3.5 text-right text-slate-600">{entry.unitPrice ? formatAmount(entry.unitPrice, entry.currency) : '—'}</td>
                  <td className={`px-5 py-3.5 text-right font-semibold ${entry.eventType === 'DEBT_SETTLED' ? 'text-slate-400' : entry.eventType === 'PAYMENT' ? 'text-emerald-700' : entry.eventType === 'SALE' ? 'text-indigo-700' : ['INITIAL_STOCK', 'STOCK_IN'].includes(entry.eventType) ? 'text-rose-700' : 'text-slate-800'}`}>{entry.eventType === 'DEBT_SETTLED' ? '—' : entry.amount ? formatAmount(entry.amount, entry.currency) : '—'}</td>
                  <td className="max-w-xs truncate px-5 py-3.5 text-slate-500" title={entry.note || ''}>{entry.note || '—'}</td>
                </tr>
              ))}
              {!isLoading && entries.length === 0 && <tr><td colSpan="8" className="px-5 py-16 text-center text-slate-500">{totalEntries ? 'Filtrelerle eşleşen kayıt bulunamadı.' : 'Henüz işlem kaydı yok.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
        <span>{entries.length ? `${(page - 1) * 50 + 1}–${Math.min(page * 50, totalEntries)} / ${totalEntries}` : `${totalEntries} kayıt`}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || isLoading} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Önceki</button>
          <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount || isLoading} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Sonraki</button>
        </div>
      </div>

      {isExportModalOpen && <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={19} className="text-indigo-600" />
              <h3 className="font-bold text-slate-800">Geçmişi Excel’e Aktar</h3>
            </div>
            <button type="button" onClick={() => setIsExportModalOpen(false)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Kapat"><X size={18} /></button>
          </div>
          <div className="space-y-4 p-6">
            <label className="block text-sm font-medium text-slate-700" htmlFor="history-export-scope">Aktarım dönemi</label>
            <select id="history-export-scope" value={exportScope} onChange={(event) => setExportScope(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-700 outline-none focus:border-indigo-500">
              <option value="filtered">Ekrandaki tarih ve işlem filtreleri</option>
              <option value="month">Ay ve yıl seç</option>
              <option value="all">Tüm zamanlar</option>
            </select>
            {exportScope === 'filtered' && <p className="text-xs text-slate-500">Arama, işlem türü ve tarih aralığı uygulanır; tüm eşleşen kayıtlar aktarılır.</p>}
            {exportScope === 'month' && <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="history-export-month">Ay / Yıl</label>
              <input id="history-export-month" type="month" value={exportMonth} onChange={(event) => setExportMonth(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-700 outline-none focus:border-indigo-500" />
            </div>}
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button type="button" onClick={() => setIsExportModalOpen(false)} className="rounded-xl px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-200">İptal</button>
            <button type="button" onClick={exportExcel} disabled={isExporting || (exportScope === 'month' && !exportMonth) || (exportScope === 'filtered' && startDate && endDate && startDate > endDate)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Download size={17} /> {isExporting ? 'Hazırlanıyor…' : 'Excel’i Oluştur'}
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
}
