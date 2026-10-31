import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronDown,
  ChevronRight, CircleAlert, Info, Package, ShoppingBag, Wallet
} from 'lucide-react'
import { getSalesChartDomain, getSalesChartLayout, getSalesChartWidth, layoutSalesChartLabels } from '../utils/salesChartScale.js'

const DAY_MS = 24 * 60 * 60 * 1000

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDate(value) {
  return new Date(`${value}T12:00:00`)
}

function mondayOf(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  return result
}

function money(value) {
  const amount = Number(value || 0) / 100
  const sign = amount < 0 ? '−' : ''
  return `${sign}$${Math.abs(amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function groupForRange(startDate, endDate) {
  const days = Math.max(1, Math.round((parseDate(endDate) - parseDate(startDate)) / DAY_MS) + 1)
  return days <= 45 ? 'day' : days <= 150 ? 'week' : 'month'
}

function makeChartRows(startDate, endDate, grouping, trendStats) {
  const from = parseDate(startDate)
  const through = parseDate(endDate)
  const data = new Map((trendStats || []).map((row) => [row.period, row]))
  const rows = []

  if (grouping === 'month') {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
    while (cursor <= through) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      rows.push({
        period: key,
        label: cursor.toLocaleDateString('tr-TR', { month: 'short', ...(from.getFullYear() !== through.getFullYear() ? { year: '2-digit' } : {}) }),
        sales: Number(data.get(key)?.netSales || 0),
        collections: Number(data.get(key)?.collections || 0)
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
  } else if (grouping === 'week') {
    const cursor = mondayOf(from)
    const finalWeek = mondayOf(through)
    while (cursor <= finalWeek) {
      const key = dateKey(cursor)
      rows.push({ period: key, label: cursor.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }), sales: Number(data.get(key)?.netSales || 0), collections: Number(data.get(key)?.collections || 0) })
      cursor.setDate(cursor.getDate() + 7)
    }
  } else {
    const cursor = new Date(from)
    const dayCount = Math.round((through - from) / DAY_MS) + 1
    while (cursor <= through) {
      const key = dateKey(cursor)
      const label = dayCount <= 10
        ? cursor.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric' })
        : cursor.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
      rows.push({ period: key, label, sales: Number(data.get(key)?.netSales || 0), collections: Number(data.get(key)?.collections || 0) })
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  return rows
}

function compactMoney(value, compact = false) {
  const amount = Number(value || 0) / 100
  if (Math.abs(amount) >= 1000000) return `$${(amount / 1000000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}M`
  if (compact && Math.abs(amount) >= 1000) return `$${(amount / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}K`
  if (!compact && Math.abs(amount) >= 10000) return `$${(amount / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}K`
  if (compact) return `$${Math.abs(amount) < 10 ? amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : Math.round(amount).toLocaleString('tr-TR')}`
  return money(value)
}

function SalesChart({ rows, loading, showSales, showCollections }) {
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const hasActivity = rows.some((row) => (showSales && row.sales > 0) || (showCollections && row.collections > 0))
  const chartWidth = getSalesChartWidth(containerWidth, rows.length)
  const { left, right, gap, categoryCenters } = getSalesChartLayout(chartWidth, rows.length)
  const baseline = 250
  const chartHeight = 230
  const barWidth = Math.min(42, Math.max(5, gap * (showSales && showCollections ? 0.3 : 0.58)))
  const max = Math.max(1, ...rows.flatMap((row) => [showSales ? row.sales : 0, showCollections ? row.collections : 0]))
  const domainMax = getSalesChartDomain(max)
  const showValueLabels = rows.length <= 45
  const useCompactLabels = rows.length > 7
  const labels = layoutSalesChartLabels(rows.flatMap((row, index) => {
    const pairWidth = showSales && showCollections ? barWidth * 2 + 6 : barWidth
    const x = categoryCenters[index] - pairWidth / 2
    const candidates = []
    if (showValueLabels && showSales && row.sales > 0) {
      const height = (row.sales / domainMax) * chartHeight
      candidates.push({ key: `${row.period}-sales`, text: compactMoney(row.sales, useCompactLabels), value: row.sales, series: 'sales', x: x + barWidth / 2, y: baseline - height - 8 })
    }
    if (showValueLabels && showCollections && row.collections > 0) {
      const collectionX = x + (showSales ? barWidth + 6 : 0)
      const height = (row.collections / domainMax) * chartHeight
      candidates.push({ key: `${row.period}-collections`, text: compactMoney(row.collections, useCompactLabels), value: row.collections, series: 'collections', x: collectionX + barWidth / 2, y: baseline - height - 8 })
    }
    return candidates
  }))

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      {loading
        ? <div className="flex h-[320px] items-center justify-center text-sm text-slate-400">Satış ve tahsilatlar yükleniyor…</div>
        : <>
        {!hasActivity && <p className="pointer-events-none absolute inset-x-0 top-5 z-10 text-center text-sm text-slate-400">Seçilen dönemde bu seriler için kayıt yok.</p>}
        <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} 320`} style={{ minWidth: `${chartWidth}px`, width: `${chartWidth}px`, height: '320px' }} className="block" role="img" aria-label="Seçilen dönemde satışlar ve tahsilatlar">
          <line x1={left} y1={baseline} x2={right} y2={baseline} stroke="#e2e8f0" />
          {rows.map((row, index) => {
            const salesHeight = row.sales > 0 ? Math.max(1, (row.sales / domainMax) * chartHeight) : 0
            const collectionHeight = row.collections > 0 ? Math.max(1, (row.collections / domainMax) * chartHeight) : 0
            const pairWidth = showSales && showCollections ? barWidth * 2 + 6 : barWidth
            const groupCenter = categoryCenters[index]
            const x = groupCenter - pairWidth / 2
            return (
              <g key={row.period}>
                <title>{`${row.label} · Satış: ${money(row.sales)} · Tahsilat: ${money(row.collections)}`}</title>
                {showSales && salesHeight > 0 && <rect x={x} y={baseline - salesHeight} width={barWidth} height={salesHeight} rx="4" fill="#4f46e5"><title>{`Satış: ${money(row.sales)}`}</title></rect>}
                {showCollections && collectionHeight > 0 && <rect x={x + (showSales ? barWidth + 6 : 0)} y={baseline - collectionHeight} width={barWidth} height={collectionHeight} rx="4" fill="#0f766e"><title>{`Tahsilat: ${money(row.collections)}`}</title></rect>}
                {labels.filter((label) => label.key === `${row.period}-sales`).map((label) => <text key={label.key} x={label.x} y={label.y} textAnchor="middle" fill="#3730a3" fontSize={rows.length > 12 ? 10 : 12} fontWeight="600"><title>{`Satış: ${money(label.value)}`}</title>{label.text}</text>)}
                {labels.filter((label) => label.key === `${row.period}-collections`).map((label) => <text key={label.key} x={label.x} y={label.y} textAnchor="middle" fill="#0f766e" fontSize={rows.length > 12 ? 10 : 12} fontWeight="600"><title>{`Tahsilat: ${money(label.value)}`}</title>{label.text}</text>)}
                <text x={groupCenter} y="300" textAnchor="middle" fill="#64748b" fontSize={rows.length > 12 ? 10 : 12}>{row.label}</text>
              </g>
            )
          })}
        </svg>
        </div>
        </>}
    </div>
  )
}

function SmallMetric({ title, value, detail, tone = 'neutral', onClick, control, belowControl }) {
  const Container = onClick ? 'button' : 'article'
  const valueTone = {
    positive: 'text-emerald-700',
    negative: 'text-rose-700',
    debt: 'text-rose-700',
    expense: 'text-rose-700',
    neutral: 'text-slate-900'
  }[tone] || 'text-slate-900'
  return (
    <Container type={onClick ? 'button' : undefined} onClick={onClick} className={`rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm sm:p-5 ${onClick ? 'w-full transition hover:border-indigo-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500' : ''}`}>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {control}
      </div>
      <p className={`mt-2 text-xl font-semibold tabular-nums sm:text-2xl ${valueTone}`}>{value}</p>
      {(detail?.trim() || belowControl) && <div className="mt-1 flex items-center justify-between gap-2"><p className="min-w-0 text-sm text-slate-400">{detail}</p>{belowControl}</div>}
    </Container>
  )
}

function ProfitInfo() {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef(null)
  const popoverId = 'gross-profit-explanation'

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event) => {
      if (!popoverRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <span ref={popoverRef} className="relative inline-flex">
      <button type="button" aria-label="Brüt kâr hakkında bilgi" aria-expanded={open} aria-controls={popoverId} onClick={() => setOpen((value) => !value)} className="rounded-full text-slate-400 transition hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        <Info size={14} />
      </button>
      {open && <span id={popoverId} role="dialog" aria-label="Brüt kâr açıklaması" className="absolute bottom-6 left-0 z-30 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-3 text-xs font-normal leading-relaxed text-slate-600 shadow-xl sm:w-80">
        Brüt kâr, satış tutarından satılan ürünlerin alış maliyeti çıkarılarak hesaplanır. İşletme giderleri düşülmemiştir. Alış maliyeti bilinmeyen satışlar hesaplamaya katılmaz. Bu nedenle gösterilen tutar toplam kârınız olmayabilir.
      </span>}
    </span>
  )
}

function MainMetric({ title, value, detail, icon: Icon, negative = false }) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-medium text-slate-500 sm:text-lg">{title}</p>
          <p className={`mt-2 break-words text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl ${negative ? 'text-rose-700' : 'text-slate-900'}`}>{value}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${negative ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}><Icon size={21} strokeWidth={1.8} /></span>
      </div>
      <p className="mt-2 text-base text-slate-500">{detail}</p>
    </article>
  )
}

export default function Dashboard({ onNavigate }) {
  const now = new Date()
  const [rangePreset, setRangePreset] = useState('7days')
  const [startDate, setStartDate] = useState(() => dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)))
  const [endDate, setEndDate] = useState(() => dateKey(now))
  const [showSalesSeries, setShowSalesSeries] = useState(true)
  const [showCollectionsSeries, setShowCollectionsSeries] = useState(true)
  const [stockPurchasePeriod, setStockPurchasePeriod] = useState('month')
  const [stockPurchaseStartDate, setStockPurchaseStartDate] = useState(() => dateKey(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [stockPurchaseEndDate, setStockPurchaseEndDate] = useState(() => dateKey(now))
  const [isStockRangeOpen, setIsStockRangeOpen] = useState(false)
  const stockRangePickerRef = useRef(null)
  const [grossProfitPeriod, setGrossProfitPeriod] = useState('today')
  const [grossProfitStartDate, setGrossProfitStartDate] = useState(() => dateKey(now))
  const [grossProfitEndDate, setGrossProfitEndDate] = useState(() => dateKey(now))
  const [isGrossProfitRangeOpen, setIsGrossProfitRangeOpen] = useState(false)
  const grossProfitRangePickerRef = useRef(null)
  const [showCategories, setShowCategories] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [hasLoadedData, setHasLoadedData] = useState(false)
  const requestNumber = useRef(0)
  const [stats, setStats] = useState({
    totalProducts: 0, lowStockProducts: 0,
    categoryInventory: [], lowStockItems: [], salesStats: [], paymentsStats: [],
    financialTrendStats: []
  })

  const grouping = groupForRange(startDate, endDate)

  useEffect(() => {
    if (!isStockRangeOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!stockRangePickerRef.current?.contains(event.target)) setIsStockRangeOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsStockRangeOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isStockRangeOpen])

  useEffect(() => {
    if (!isGrossProfitRangeOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!grossProfitRangePickerRef.current?.contains(event.target)) setIsGrossProfitRangeOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsGrossProfitRangeOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isGrossProfitRangeOpen])

  const loadDashboardData = useCallback(async () => {
    const thisRequest = ++requestNumber.current
    try {
      const data = await window.electronAPI.getDashboardStats({
        paymentGrouping: grouping,
        paymentRangeStart: startDate,
        paymentRangeEnd: endDate,
        stockPurchasePeriod,
        stockPurchaseStartDate,
        stockPurchaseEndDate,
        grossProfitPeriod,
        grossProfitStartDate,
        grossProfitEndDate
      })
      if (!data) throw new Error('Dashboard verisi alınamadı.')
      if (thisRequest === requestNumber.current) {
        setStats(data)
        setLoadError(false)
        setHasLoadedData(true)
      }
    } catch (error) {
      console.error('Dashboard verileri yüklenemedi:', error)
      if (thisRequest === requestNumber.current) setLoadError(true)
    } finally {
      if (thisRequest === requestNumber.current) setIsLoading(false)
    }
  }, [grouping, startDate, endDate, stockPurchasePeriod, stockPurchaseStartDate, stockPurchaseEndDate, grossProfitPeriod, grossProfitStartDate, grossProfitEndDate])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadDashboardData() }, 0)
    const interval = setInterval(loadDashboardData, 30000)
    window.addEventListener('dashboard:refresh', loadDashboardData)
    return () => {
      requestNumber.current += 1
      window.clearTimeout(initialLoad)
      clearInterval(interval)
      window.removeEventListener('dashboard:refresh', loadDashboardData)
    }
  }, [loadDashboardData])

  const chartRows = useMemo(
    () => makeChartRows(startDate, endDate, grouping, stats.financialTrendStats),
    [startDate, endDate, grouping, stats.financialTrendStats]
  )

  const setPreset = (preset) => {
    const today = new Date()
    let start
    if (preset === '7days') start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
    else if (preset === '30days') start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)
    else start = new Date(today.getFullYear(), 0, 1)
    setRangePreset(preset)
    setStartDate(dateKey(start))
    setEndDate(dateKey(today))
    setIsLoading(true)
    setLoadError(false)
  }

  const sales = (stats.salesStats || []).find((item) => item.currency === 'USD') || {}
  const payments = (stats.paymentsStats || []).find((item) => item.currency === 'USD') || {}
  const saleCount = Number(sales.salesCount || 0)
  const itemCount = Number(sales.totalItemsSold || 0)
  const verifiedGrossProfit = Number(stats.grossProfitTotal ?? sales.totalProfit ?? 0)
  const stockAlertCount = Number(stats.lowStockProducts || 0)
  const rangeSalesTotal = chartRows.reduce((sum, row) => sum + Number(row.sales || 0), 0)
  const rangeCollectionsTotal = chartRows.reduce((sum, row) => sum + Number(row.collections || 0), 0)
  const rangeLabel = `${parseDate(startDate).toLocaleDateString('tr-TR')} – ${parseDate(endDate).toLocaleDateString('tr-TR')}`
  const stockPurchaseRangeLabel = `${parseDate(stockPurchaseStartDate).toLocaleDateString('tr-TR')} – ${parseDate(stockPurchaseEndDate).toLocaleDateString('tr-TR')}`
  const grossProfitRangeLabel = `${parseDate(grossProfitStartDate).toLocaleDateString('tr-TR')} – ${parseDate(grossProfitEndDate).toLocaleDateString('tr-TR')}`
  const dateTitle = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
  const totalUnits = (stats.categoryInventory || []).reduce((sum, category) => sum + Number(category.unitCount || 0), 0)
  const dataUnavailable = isLoading || (loadError && !hasLoadedData)

  return (
    <div className="mx-auto max-w-[1680px] space-y-7 sm:space-y-8">
      <header className="flex flex-col gap-2 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium capitalize text-indigo-700">{dateTitle}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Günlük özet</h1>
        </div>
      </header>

      {loadError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <CircleAlert size={18} className="shrink-0" />
          Veriler yenilenemedi. Gösterilen değerler eski olabilir; uygulama bağlantısını kontrol et.
        </div>
      )}

      <section aria-label="Bugünkü satış ve kasaya giren ödeme özeti">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <MainMetric
            title="Bugünkü Satış"
            value={dataUnavailable ? '—' : money(sales.totalRevenue)}
            detail={dataUnavailable ? ' ' : saleCount ? `${saleCount} satış işlemi · ${itemCount} ürün satıldı` : 'Bugün henüz satış yapılmadı.'}
            icon={ShoppingBag}
          />
          <MainMetric
            title="Bugün Kasaya Giren"
            value={dataUnavailable ? '—' : money(payments.totalPaid)}
            detail={dataUnavailable ? ' ' : 'Bugün alınan nakit tahsilat'}
            icon={Wallet}
          />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SmallMetric
            title="Brüt kâr"
            value={dataUnavailable ? '—' : money(verifiedGrossProfit)}
            detail={grossProfitPeriod === 'today' ? 'Bugün' : grossProfitPeriod === 'week' ? 'Bu hafta' : grossProfitPeriod === 'month' ? 'Bu ay' : grossProfitPeriod === 'custom' ? grossProfitRangeLabel : 'Tüm zamanlar'}
            control={<div ref={grossProfitRangePickerRef} className="relative flex shrink-0 items-center gap-1">
              <select aria-label="Brüt kâr dönem filtresi" value={grossProfitPeriod} onChange={(event) => { setGrossProfitPeriod(event.target.value); if (event.target.value === 'custom') setIsGrossProfitRangeOpen(true) }} onClick={(event) => event.stopPropagation()} className="max-w-[128px] rounded-md border-0 bg-slate-50 px-2 py-1.5 text-sm text-slate-600 outline-none focus:ring-1 focus:ring-indigo-300">
                <option value="today">Bugün</option><option value="week">Bu hafta</option><option value="month">Bu ay</option><option value="all">Tüm zamanlar</option><option value="custom">Tarih aralığı</option>
              </select>
              {grossProfitPeriod === 'custom' && <button type="button" aria-label="Brüt kâr tarih aralığını seç" aria-expanded={isGrossProfitRangeOpen} onClick={() => setIsGrossProfitRangeOpen((open) => !open)} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600"><CalendarDays size={14} /></button>}
              {grossProfitPeriod === 'custom' && isGrossProfitRangeOpen && <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl" role="group" aria-label="Brüt kâr tarih aralığı">
                <label className="mb-2 block text-[11px] font-medium text-slate-500">Başlangıç tarihi<input aria-label="Brüt kâr başlangıç tarihi" type="date" value={grossProfitStartDate} max={grossProfitEndDate} onChange={(event) => { if (event.target.value) setGrossProfitStartDate(event.target.value) }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400" /></label>
                <label className="block text-[11px] font-medium text-slate-500">Bitiş tarihi<input aria-label="Brüt kâr bitiş tarihi" type="date" value={grossProfitEndDate} min={grossProfitStartDate} onChange={(event) => { if (event.target.value) setGrossProfitEndDate(event.target.value) }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400" /></label>
              </div>}
            </div>}
            belowControl={<ProfitInfo />}
            tone={dataUnavailable ? 'neutral' : verifiedGrossProfit > 0 ? 'positive' : verifiedGrossProfit < 0 ? 'negative' : 'neutral'}
          />
          <SmallMetric title="Müşterilerden kalan borç" value={dataUnavailable ? '—' : money(stats.outstandingBalance?.amount)} detail={`${Number(stats.outstandingBalance?.customerCount || 0)} müşterinin açık borcu · Müşterileri aç`} tone={!dataUnavailable && Number(stats.outstandingBalance?.amount || 0) > 0 ? 'debt' : 'neutral'} onClick={() => onNavigate?.('customers')} />
          <SmallMetric
            title="Mal alımı"
            value={dataUnavailable ? '—' : money(stats.stockPurchaseTotal ?? stats.allTimeStats?.totalStockExpenses)}
            detail={stockPurchasePeriod === 'today' ? 'Bugün' : stockPurchasePeriod === 'week' ? 'Bu hafta' : stockPurchasePeriod === 'month' ? 'Bu ay' : stockPurchasePeriod === 'custom' ? stockPurchaseRangeLabel : 'Tüm zamanlar'}
            tone={!dataUnavailable && Number(stats.stockPurchaseTotal || 0) > 0 ? 'expense' : 'neutral'}
            control={<div ref={stockRangePickerRef} className="relative flex shrink-0 items-center gap-1">
              <select aria-label="Mal alımı dönem filtresi" value={stockPurchasePeriod} onChange={(event) => { setStockPurchasePeriod(event.target.value); if (event.target.value === 'custom') setIsStockRangeOpen(true) }} onClick={(event) => event.stopPropagation()} className="max-w-[128px] rounded-md border-0 bg-slate-50 px-2 py-1.5 text-sm text-slate-600 outline-none focus:ring-1 focus:ring-indigo-300">
                <option value="today">Bugün</option><option value="week">Bu hafta</option><option value="month">Bu ay</option><option value="all">Tüm zamanlar</option><option value="custom">Tarih aralığı</option>
              </select>
              {stockPurchasePeriod === 'custom' && <button type="button" aria-label="Mal alımı tarih aralığını seç" aria-expanded={isStockRangeOpen} onClick={() => setIsStockRangeOpen((open) => !open)} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600"><CalendarDays size={14} /></button>}
              {stockPurchasePeriod === 'custom' && isStockRangeOpen && <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl" role="group" aria-label="Mal alımı tarih aralığı">
                <label className="mb-2 block text-[11px] font-medium text-slate-500">Başlangıç tarihi<input aria-label="Mal alımı başlangıç tarihi" type="date" value={stockPurchaseStartDate} max={stockPurchaseEndDate} onChange={(event) => { if (event.target.value) setStockPurchaseStartDate(event.target.value) }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400" /></label>
                <label className="block text-[11px] font-medium text-slate-500">Bitiş tarihi<input aria-label="Mal alımı bitiş tarihi" type="date" value={stockPurchaseEndDate} min={stockPurchaseStartDate} onChange={(event) => { if (event.target.value) setStockPurchaseEndDate(event.target.value) }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400" /></label>
              </div>}
            </div>}
          />
        </div>
      </section>

      <section aria-label="Satış ve tahsilat analizi" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Satış ve Tahsilat Analizi</h2>
            <p className="mt-1 text-base text-slate-500">{rangeLabel}</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-base sm:text-lg">
              <span className="font-semibold text-indigo-700">Satışlar {money(rangeSalesTotal)}</span>
              <span className="font-semibold text-teal-700">Kasaya giren {money(rangeCollectionsTotal)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2" role="group" aria-label="Grafikte gösterilecek veriler">
              <button type="button" aria-pressed={showSalesSeries} disabled={showSalesSeries && !showCollectionsSeries} onClick={() => setShowSalesSeries((shown) => !shown)} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${showSalesSeries ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500'}`}>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-indigo-600" />Satış
              </button>
              <button type="button" aria-pressed={showCollectionsSeries} disabled={showCollectionsSeries && !showSalesSeries} onClick={() => setShowCollectionsSeries((shown) => !shown)} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${showCollectionsSeries ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-500'}`}>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-teal-700" />Tahsilat
              </button>
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Grafikte gösterilecek dönem">
              {[['7days', '7 gün'], ['30days', '30 gün'], ['year', 'Bu yıl']].map(([value, label]) => (
                <button key={value} type="button" aria-pressed={rangePreset === value} onClick={() => setPreset(value)} className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${rangePreset === value ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2 text-sm text-slate-600">
              <CalendarDays size={15} className="text-slate-400" />
              <input aria-label="Grafik başlangıç tarihi" type="date" value={startDate} max={endDate} onChange={(event) => { if (event.target.value) { setRangePreset('custom'); setStartDate(event.target.value); setIsLoading(true); setLoadError(false) } }} className="w-[140px] bg-transparent text-sm outline-none" />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2 text-sm text-slate-600">
              <input aria-label="Grafik bitiş tarihi" type="date" value={endDate} min={startDate} onChange={(event) => { if (event.target.value) { setRangePreset('custom'); setEndDate(event.target.value); setIsLoading(true); setLoadError(false) } }} className="w-[140px] bg-transparent text-sm outline-none" />
            </label>
          </div>
        </div>
        <div className="mt-4">
          {loadError && !stats.financialTrendStats?.length
            ? <div className="flex h-64 items-center justify-center text-sm text-slate-400">Grafik verisi şu anda alınamıyor.</div>
            : <SalesChart rows={chartRows} loading={isLoading} showSales={showSalesSeries} showCollections={showCollectionsSeries} />}
        </div>
      </section>

      <section aria-label="Envanter ve stok durumu" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <button type="button" aria-expanded={showCategories} onClick={() => setShowCategories((value) => !value)} className="flex w-full items-center justify-between gap-3 p-5 text-left transition hover:bg-slate-50 sm:p-6">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Package size={19} /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">Envanter</span>
                <span className="mt-0.5 block text-sm text-slate-500">{Number(stats.totalProducts).toLocaleString('tr-TR')} ürün çeşidi · {totalUnits.toLocaleString('tr-TR')} adet</span>
              </span>
            </span>
            {showCategories ? <ChevronDown size={19} className="shrink-0 text-slate-400" /> : <ChevronRight size={19} className="shrink-0 text-slate-400" />}
          </button>
          {showCategories && (
            <div className="border-t border-slate-100 px-5 py-2 sm:px-6">
              {stats.categoryInventory?.length ? stats.categoryInventory.map((category) => (
                <div key={category.category} className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
                  <span className="truncate text-sm font-medium text-slate-700">{category.category}</span>
                  <span className="shrink-0 text-right text-sm tabular-nums text-slate-500"><strong className="font-semibold text-slate-800">{Number(category.productCount).toLocaleString('tr-TR')}</strong> çeşit · {Number(category.unitCount).toLocaleString('tr-TR')} adet</span>
                </div>
              )) : <p className="py-3 text-sm text-slate-500">{isLoading ? 'Envanter yükleniyor…' : loadError ? 'Envanter bilgisi alınamadı.' : 'Henüz ürün eklenmemiş.'}</p>}
            </div>
          )}
        </div>

        <section aria-label="Stok durumu" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-800">Stok Durumu</h2>
            {stockAlertCount > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{stockAlertCount} ürün</span>}
          </div>
          {isLoading ? <p className="mt-4 text-sm text-slate-400">Stoklar kontrol ediliyor…</p> : loadError ? <p className="mt-4 text-sm text-rose-700">Stok bilgisi alınamadı.</p> : (
            <div className="mt-3 divide-y divide-slate-100">
              {(stats.lowStockItems || []).map((product) => (
                <button key={product.id} type="button" onClick={() => onNavigate?.('products')} className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-slate-50">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <AlertTriangle size={17} className={`shrink-0 ${Number(product.currentQuantity) <= 0 ? 'text-rose-600' : 'text-amber-600'}`} />
                    <span className="min-w-0 truncate text-sm font-medium text-slate-700">{product.name}</span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold tabular-nums ${Number(product.currentQuantity) <= 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                    {Number(product.currentQuantity) < 0 ? `Stok eksi: ${Number(product.currentQuantity)}` : Number(product.currentQuantity) === 0 ? 'Tükendi' : `Kritik · ${Number(product.currentQuantity)} kaldı · sınır ${Number(product.minQuantity)}`}
                  </span>
                </button>
              ))}
              {stockAlertCount > (stats.lowStockItems || []).length && <button type="button" onClick={() => onNavigate?.('products')} className="py-3 text-xs font-semibold text-indigo-700 hover:underline">Tüm stok uyarılarını gör</button>}
              {stockAlertCount === 0 && <p className="flex items-center gap-2 py-3 text-sm text-slate-600"><CheckCircle2 size={17} className="text-emerald-600" />Stoklar normal seviyede</p>}
            </div>
          )}
        </section>
      </section>
    </div>
  )
}
