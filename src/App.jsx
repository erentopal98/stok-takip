import { Component, useEffect, useState } from 'react';
import Sidebar from './components/layout/Sidebar'; // Sidebar'ın olduğu dosya yolunu kontrol et
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';
import ActivityHistory from './pages/ActivityHistory';

class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Arayüz oluşturulurken hata oluştu:', error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
          <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-bold">Ekran yüklenirken bir hata oluştu</h1>
            <p className="mt-2 text-sm text-slate-600">Hata ayrıntısı terminale kaydedildi. Uygulamayı yeniden başlatıp bu mesajı paylaşabilirsiniz.</p>
            <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-xs text-rose-800">
              {this.state.error.stack || this.state.error.message || String(this.state.error)}
            </pre>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('stok-takip-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('stok-takip-theme', theme); } catch { /* Tercih kaydı kullanılamıyorsa arayüz yine çalışır. */ }
  }, [theme]);
  return (
    <AppErrorBoundary>
    <div className="app-shell flex h-screen w-full min-w-0 bg-slate-50 text-slate-900">
      <div className="app-sidebar w-64 flex-shrink-0">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} />
      </div>
      
      {/* Ana İçerik Alanı - Esnek */}
     <main className="app-main min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
          {activeTab === 'products' && <Products />}
          {activeTab === 'history' && <ActivityHistory onNavigate={setActiveTab} />}
          {/* ŞU SATIRIN OLDUĞUNDAN EMİN OL: */}
          {activeTab === 'customers' && <Customers />} 
     </main>
    </div>
    </AppErrorBoundary>
  );
}

export default App;
