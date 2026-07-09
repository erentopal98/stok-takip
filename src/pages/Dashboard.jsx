import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, Activity } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    criticalStockCount: 0,
    todayMovements: 0
  });

  const [criticalProducts, setCriticalProducts] = useState([]);

  async function loadData() {
    try {
      // Hem ürünleri hem de hareket geçmişini aynı anda veritabanından çekiyoruz
      const [productList, movementList] = await Promise.all([
        window.electronAPI.getProducts(),
        window.electronAPI.getStockMovements()
      ]);

      // 1. Kritik Stok Hesaplaması (Mevcut <= Minimum)
      const critical = productList.filter(p => p.currentQuantity <= p.minQuantity);

      // 2. Bugünkü Hareketlerin Hesaplanması
      const todayDate = new Date();
      const todayMovementsCount = movementList.filter(m => {
        const mDate = new Date(m.createdAt);
        return mDate.getDate() === todayDate.getDate() &&
               mDate.getMonth() === todayDate.getMonth() &&
               mDate.getFullYear() === todayDate.getFullYear();
      }).length;

      // State'leri güncelliyoruz
      setStats({
        totalProducts: productList.length,
        criticalStockCount: critical.length,
        todayMovements: todayMovementsCount
      });

      setCriticalProducts(critical);

    } catch (err) {
      console.error("Dashboard verileri yüklenirken hata:", err);
    }
  }

  // Sayfa açıldığında verileri yükle
  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Sayfa Başlığı */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Özet Paneli</h2>
        <p className="text-slate-500 mt-1">Stok durumunuzun güncel özeti.</p>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-start justify-between transition hover:shadow-md">
          <div>
            <p className="text-sm font-medium text-slate-500">Toplam Aktif Ürün</p>
            <h3 className="text-3xl font-bold text-slate-800 mt-2">{stats.totalProducts}</h3>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
            <Package size={24} />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-red-100 shadow-sm flex items-start justify-between transition hover:shadow-md">
          <div>
            <p className="text-sm font-medium text-slate-500">Kritik Stok Uyarısı</p>
            <h3 className="text-3xl font-bold text-red-600 mt-2">{stats.criticalStockCount}</h3>
          </div>
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-start justify-between transition hover:shadow-md">
          <div>
            <p className="text-sm font-medium text-slate-500">Bugünkü Hareketler</p>
            <h3 className="text-3xl font-bold text-emerald-600 mt-2">{stats.todayMovements}</h3>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
            <Activity size={24} />
          </div>
        </div>
      </div>

      {/* Kritik Stok Tablosu */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-red-100 bg-red-50/50 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="text-red-500" size={20} />
            <h3 className="text-lg font-semibold text-slate-800">Tükenmek Üzere Olan Ürünler</h3>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="px-6 py-3 font-medium">Ürün Adı</th>
                <th className="px-6 py-3 font-medium">Kategori</th>
                <th className="px-6 py-3 font-medium text-right">Mevcut Stok</th>
                <th className="px-6 py-3 font-medium text-right">Min. Stok</th>
                <th className="px-6 py-3 font-medium text-center">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {criticalProducts.map((product) => {
                const isOutOfStock = product.currentQuantity === 0;
                
                return (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-800 font-medium">{product.name}</td>
                    <td className="px-6 py-4 text-slate-500">{product.category || '-'}</td>
                    <td className={`px-6 py-4 font-bold text-right ${isOutOfStock ? 'text-red-600' : 'text-orange-500'}`}>
                      {product.currentQuantity}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-right">{product.minQuantity}</td>
                    <td className="px-6 py-4 flex justify-center">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        isOutOfStock 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {isOutOfStock ? 'Tükendi' : 'Kritik Seviye'}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {criticalProducts.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    Harika! Şu an stok seviyesi kritik olan hiçbir ürününüz yok.
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