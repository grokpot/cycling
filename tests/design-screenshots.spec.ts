/** Screenshots of ride and pre-ride pages at desktop and mobile sizes */
import { test } from '@playwright/test'

const DEMO_ID = 'e9ffe1a8-9a6e-479e-b4a4-2c43e2df5e7a'

test('desktop ride page screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`http://localhost:3000/ride/${DEMO_ID}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  await page.screenshot({ 
    path: '/tmp/ride-desktop.png',
    fullPage: false,
  })
})

test('mobile ride page screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`http://localhost:3000/ride/${DEMO_ID}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  await page.screenshot({ 
    path: '/tmp/ride-mobile.png',
    fullPage: false,
  })
})

test('desktop pre-ride page screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`http://localhost:3000/workouts/${DEMO_ID}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  await page.screenshot({ 
    path: '/tmp/pre-ride-desktop.png',
    fullPage: false,
  })
})

test('mobile pre-ride page screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`http://localhost:3000/workouts/${DEMO_ID}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  await page.screenshot({ 
    path: '/tmp/pre-ride-mobile.png',
    fullPage: false,
  })
})
