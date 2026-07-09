import React, { useState } from 'react';
import Sidebar from './components/layout/Sidebar'; // Sidebar'ın olduğu dosya yolunu kontrol et
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import StockMovements from './pages/StockMovements';
import Customers from './pages/Customers';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900">
      {/* Sidebar - Sabit genişlik */}
      <div className="w-64 flex-shrink-0">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
      
      {/* Ana İçerik Alanı - Esnek */}
     <main className="flex-1 p-8 overflow-y-auto">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'products' && <Products />}
          {activeTab === 'movements' && <StockMovements />}
          {/* ŞU SATIRIN OLDUĞUNDAN EMİN OL: */}
          {activeTab === 'customers' && <Customers />} 
     </main>
    </div>
  );
}

export default App;