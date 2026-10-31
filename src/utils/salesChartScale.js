export function getSalesChartWidth(containerWidth, rowCount) {
  const measuredWidth = Number.isFinite(Number(containerWidth)) ? Number(containerWidth) : 0
  const minimumWidthForLabels = Math.max(0, Number(rowCount) || 0) * 52 + 56
  return Math.max(480, measuredWidth, minimumWidthForLabels)
}

export function getSalesChartLayout(chartWidth, rowCount, margin = 32) {
  const count = Math.max(0, Math.trunc(Number(rowCount) || 0))
  const left = margin
  const right = Math.max(left, chartWidth - margin)
  const gap = count ? (right - left) / count : 0
  return {
    left,
    right,
    gap,
    categoryCenters: Array.from({ length: count }, (_, index) => left + (index + 0.5) * gap)
  }
}

export function getSalesChartDomain(maxValue) {
  const safeMaxValue = Math.max(0, Number(maxValue) || 0)
  return safeMaxValue > 0 ? safeMaxValue / 0.8 : 1
}

export function layoutSalesChartLabels(candidates, { minY = 44, lineHeight = 12 } = {}) {
  const placed = []
  const sorted = [...candidates].sort((left, right) => left.y - right.y || left.x - right.x)

  for (const candidate of sorted) {
    const width = Math.max(18, String(candidate.text).length * 6.2)
    let y = candidate.y
    while (y >= minY && placed.some((other) => {
      const overlapsHorizontally = Math.abs(candidate.x - other.x) < (width + other.width) / 2 + 3
      const overlapsVertically = y - lineHeight < other.y + 2 && y + 2 > other.y - lineHeight
      return overlapsHorizontally && overlapsVertically
    })) y -= lineHeight

    if (y >= minY) placed.push({ ...candidate, y, width })
  }

  return placed
}
