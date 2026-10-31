import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getSalesChartDomain,
  getSalesChartLayout,
  getSalesChartWidth,
  layoutSalesChartLabels
} from '../src/utils/salesChartScale.js'

test('automatic vertical domain keeps the maximum bar at 80% for small and large amounts', () => {
  for (const maxValue of [1, 100, 100_000_000]) {
    const domain = getSalesChartDomain(maxValue)
    assert.equal((maxValue / domain) * 220, 176)
  }
  assert.equal(getSalesChartDomain(0), 1)
})

test('chart viewport fills wide layouts and keeps enough room for narrow date ranges', () => {
  for (const rowCount of [7, 12, 30, 52]) {
    const minimumWidth = getSalesChartWidth(0, rowCount)
    assert.ok(minimumWidth >= rowCount * 52 + 56)
    assert.equal(getSalesChartWidth(1440, rowCount), Math.max(1440, minimumWidth))
    assert.ok(getSalesChartWidth(360, rowCount) >= 360)
  }
})

test('dense daily series retain every compact value label without collisions', () => {
  const chartWidth = getSalesChartWidth(1280, 30)
  const { left, gap, categoryCenters } = getSalesChartLayout(chartWidth, 30)
  const barWidth = Math.min(42, gap * 0.3)
  const candidates = categoryCenters.flatMap((center, index) => [
    { key: `${index}-sales`, text: '$988', x: center - (barWidth / 2 + 3), y: 120 },
    { key: `${index}-collections`, text: '$745', x: center + (barWidth / 2 + 3), y: 120 }
  ])
  const labels = layoutSalesChartLabels(candidates)
  assert.equal(labels.length, 60)
  assert.ok(labels.every((label) => label.y >= 44 && label.x >= left))
})

test('seven dates are evenly distributed across both wide and narrow chart viewports', () => {
  for (const viewportWidth of [360, 1280]) {
    const chartWidth = getSalesChartWidth(viewportWidth, 7)
    const { left, right, gap, categoryCenters } = getSalesChartLayout(chartWidth, 7)
    assert.equal(categoryCenters.length, 7)
    assert.ok(categoryCenters[0] > left)
    assert.ok(categoryCenters.at(-1) < right)
    for (let index = 1; index < categoryCenters.length; index += 1) {
      assert.ok(Math.abs((categoryCenters[index] - categoryCenters[index - 1]) - gap) < 1e-9)
    }
    if (viewportWidth > 480) assert.equal(chartWidth, viewportWidth)
  }
})

test('value labels move with bars and avoid collisions without leaving the plot', () => {
  const labels = layoutSalesChartLabels([
    { key: 'a', text: '$120.00', x: 100, y: 110 },
    { key: 'b', text: '$120.00', x: 100, y: 110 },
    { key: 'c', text: '$99.00', x: 145, y: 112 },
    { key: 'd', text: '$4.00', x: 300, y: 280 }
  ])
  assert.equal(labels.length, 4)
  assert.ok(labels.every((label) => label.y >= 44))
  for (let left = 0; left < labels.length; left += 1) {
    for (let right = left + 1; right < labels.length; right += 1) {
      const a = labels[left]
      const b = labels[right]
      const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 3
      const overlapY = a.y - 12 < b.y + 2 && a.y + 2 > b.y - 12
      assert.ok(!(overlapX && overlapY), `${a.key} and ${b.key} labels overlap`)
    }
  }
})
