import { LayoutDashboard, Package, Users, History, Sun, Moon } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, theme, onToggleTheme }) {
  const menuItems = [
    { id: 'dashboard', label: 'Özet (Dashboard)', icon: <LayoutDashboard size={20} /> },
    { id: 'products', label: 'Ürünler', icon: <Package size={20} /> },
    { id: 'history', label: 'İşlem Geçmişi', icon: <History size={20} /> },
    { id: 'customers', label: 'Müşteriler', icon: <Users size={20} /> }, // EKLENDİ
  ];

  return (
    <aside className="app-sidebar-panel w-64 bg-white border-r border-slate-200 flex flex-col h-full shadow-sm z-10">
      {/* Logo / Başlık Alanı */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3">
          <Package className="text-white" size={18} />
        </div>
        <h1 className="sidebar-label text-xl font-bold text-slate-800 tracking-tight">Stok Takip</h1>
      </div>

      {/* Menü Linkleri */}
      <nav className="flex-1 p-4 space-y-1.5">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              <span className={`${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                {item.icon}
              </span>
              <span className="sidebar-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Alt Bilgi */}
      <div className="p-4 border-t border-slate-100">
        <button type="button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Gündüz moduna geç' : 'Gece moduna geç'} title={theme === 'dark' ? 'Gündüz modu' : 'Gece modu'} className="theme-toggle mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          <span className="sidebar-label">{theme === 'dark' ? 'Gündüz modu' : 'Gece modu'}</span>
        </button>
        <div className="sidebar-version px-4 py-2 text-xs text-slate-400 text-center">
          Sürüm 1.0.0
        </div>
      </div>
    </aside>
  );
}
