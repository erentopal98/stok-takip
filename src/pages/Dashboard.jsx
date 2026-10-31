import React, { useState, useEffect } from 'react';
import { TrendingUp, PackageOpen, AlertTriangle, ArrowDownRight, Wallet, ShoppingCart } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockProducts: 0,
    salesStats: [],
    paymentsStats: [],
    stockExpenses: 0,
    todaySalesList: []
  });

  const [isLoading, setIsLoading] = useState(true);

  async function loadDashboardData() {
    try {
      const data = await window.electronAPI.getDashboardStats();
      if (data) setStats(data);
    } catch (error) {
      console.error("Dashboard verileri çekilemedi:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) return <div className="flex h-full items-center justify-center text-slate-400 font-medium">Veriler Yükleniyor...</div>;

  const tlSales = stats.salesStats.find(s => s.currency === 'TL') || { salesCount: 0, totalRevenue: 0, totalProfit: 0, totalItemsSold: 0 };
  const usdSales = stats.salesStats.find(s => s.currency === 'USD') || { salesCount: 0, totalRevenue: 0, totalProfit: 0, totalItemsSold: 0 };
  
  const tlPayments = stats.paymentsStats.find(p => p.currency === 'TL')?.totalPaid || 0;
  const usdPayments = stats.paymentsStats.find(p => p.currency === 'USD')?.totalPaid || 0;

  const totalSalesCount = (tlSales.salesCount || 0) + (usdSales.salesCount || 0);
  const totalItemsSold = (tlSales.totalItemsSold || 0) + (usdSales.totalItemsSold || 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* BAŞLIK VE CANLI VERİ İNDİKATÖRÜ */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Özet Paneli</h2>
          <p className="text-slate-500 mt-1">Bugünkü işlemler ve finansal durum.</p>
        </div>
        <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full flex items-center gap-2 border border-emerald-100">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Canlı Veri
        </div>
      </div>

      {/* 1. SATIR: MİNİMALİST ANA KARTLAR */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Ciro Kartı */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Bugünkü Ciro</p>
              <h3 className="text-2xl font-bold text-slate-800">{(tlSales.totalRevenue / 100).toFixed(2)} ₺</h3>
              {usdSales.totalRevenue > 0 && <h4 className="text-base font-semibold text-slate-500 mt-0.5">{(usdSales.totalRevenue / 100).toFixed(2)} $</h4>}
            </div>
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <ShoppingCart size={24} strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 font-medium">{totalSalesCount} işlemde {totalItemsSold} ürün satıldı.</p>
        </div>

        {/* Kâr Kartı */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Net Kâr</p>
              <h3 className="text-2xl font-bold text-slate-800">{(tlSales.totalProfit / 100).toFixed(2)} ₺</h3>
              {usdSales.totalProfit > 0 && <h4 className="text-base font-semibold text-slate-500 mt-0.5">{(usdSales.totalProfit / 100).toFixed(2)} $</h4>}
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <TrendingUp size={24} strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 font-medium">Alış maliyetleri düşülmüş net tutar.</p>
        </div>

        {/* Kasa Kartı */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Kasa (Tahsilat)</p>
              <h3 className="text-2xl font-bold text-slate-800">{(tlPayments / 100).toFixed(2)} ₺</h3>
              {usdPayments > 0 && <h4 className="text-base font-semibold text-slate-500 mt-0.5">{(usdPayments / 100).toFixed(2)} $</h4>}
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Wallet size={24} strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 font-medium">Alınan nakit/havale toplamı.</p>
        </div>

        {/* Gider Kartı */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Mal Alım Gideri</p>
              <h3 className="text-2xl font-bold text-slate-800">{(stats.stockExpenses / 100).toFixed(2)} ₺</h3>
            </div>
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
              <ArrowDownRight size={24} strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 font-medium">Depoya çekilen stok maliyeti.</p>
        </div>
      </div>

      {/* 2. SATIR: SADELEŞTİRİLMİŞ TABLOLAR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Satış Akışı */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">Canlı İşlem Akışı</h3>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">{stats.todaySalesList.length} İşlem</span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
                  <th className="py-4 px-6 font-medium">Zaman</th>
                  <th className="py-4 px-6 font-medium">Müşteri</th>
                  <th className="py-4 px-6 font-medium">Ürün</th>
                  <th className="py-4 px-6 font-medium text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.todaySalesList.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-4 px-6 text-slate-400">{new Date(sale.createdAt).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</td>
                    <td className="py-4 px-6 font-medium text-slate-700">{sale.customerName}</td>
                    <td className="py-4 px-6 text-slate-500">
                      {sale.productName} <span className="text-xs text-slate-400 ml-1">x{sale.quantity}</span>
                    </td>
                    <td className="py-4 px-6 text-right font-semibold text-slate-800">
                      {(sale.totalPrice / 100).toFixed(2)} <span className="text-slate-400 ml-0.5">{sale.currency === 'USD' ? '$' : '₺'}</span>
                    </td>
                  </tr>
                ))}
                {stats.todaySalesList.length === 0 && (
                  <tr><td colSpan="4" className="py-12 text-center text-slate-400">Bugün henüz bir işlem gerçekleşmedi.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stok Durumu */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4">Stok Durumu</h3>
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex items-center space-x-5">
              <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-600">
                <PackageOpen size={28} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-slate-500 text-sm font-medium mb-0.5">Kayıtlı Ürün</p>
                <h4 className="text-3xl font-bold text-slate-800">{stats.totalProducts}</h4>
              </div>
            </div>

            <div className={`rounded-2xl border p-6 shadow-sm flex flex-col justify-center items-center text-center ${stats.lowStockProducts > 0 ? 'bg-red-50/50 border-red-100' : 'bg-white border-slate-100'}`}>
              <AlertTriangle size={40} strokeWidth={1.5} className={`mb-4 ${stats.lowStockProducts > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
              <h4 className={`text-lg font-bold mb-2 ${stats.lowStockProducts > 0 ? 'text-red-800' : 'text-slate-800'}`}>
                {stats.lowStockProducts > 0 ? 'Kritik Stok Uyarıları' : 'Stoklar Düzenli'}
              </h4>
              <p className={`text-sm leading-relaxed ${stats.lowStockProducts > 0 ? 'text-red-600/80' : 'text-slate-500'}`}>
                {stats.lowStockProducts > 0 
                  ? `Tükenmek üzere olan ${stats.lowStockProducts} adet ürününüz var. Lütfen envanteri kontrol edin.` 
                  : 'Şu an minimum seviyenin altında ürün bulunmuyor.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}