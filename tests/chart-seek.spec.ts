/** Test chart click-to-seek functionality */
import { test, expect } from '@playwright/test'

const DEMO_ID = 'e9ffe1a8-9a6e-479e-b4a4-2c43e2df5e7a'

test('clicking chart on ride page seeks', async ({ page }) => {
  await page.goto(`http://localhost:3000/ride/${DEMO_ID}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  // Get initial elapsed time
  const initialTime = await page.textContent('.interval-countdown')
  
  // Click in the middle of the chart
  const chart = page.locator('canvas').first()
  const box = await chart.boundingBox()
  
  if (box) {
    // Click at 50% through the chart horizontally
    await chart.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } })
    
    await page.waitForTimeout(500)
    
    // Time should have changed
    const newTime = await page.textContent('.interval-countdown')
    expect(newTime).not.toBe(initialTime)
  }
})

test('clicking chart on pre-ride page logs seek', async ({ page }) => {
  const consoleLogs: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'info' && msg.text().includes('Seek to')) {
      consoleLogs.push(msg.text())
    }
  })

  await page.goto(`http://localhost:3000/workouts/${DEMO_ID}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  // Click the chart
  const chart = page.locator('canvas').first()
  const box = await chart.boundingBox()
  
  if (box) {
    await chart.click({ position: { x: box.width * 0.3, y: box.height * 0.5 } })
    await page.waitForTimeout(200)
    
    // Should have logged a seek
    expect(consoleLogs.length).toBeGreaterThan(0)
    expect(consoleLogs[0]).toContain('Seek to')
  }
})
