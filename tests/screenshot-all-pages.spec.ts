/** Screenshot all pages for dark mode audit */
import { test } from '@playwright/test'

const DEMO_ID = 'e9ffe1a8-9a6e-479e-b4a4-2c43e2df5e7a'

test('screenshot workouts list page', async ({ page }) => {
  await page.goto('http://localhost:3000/')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  await page.screenshot({ 
    path: 'docs/screenshots/workouts-list.png',
    fullPage: true
  })
})

test('screenshot workout detail page', async ({ page }) => {
  await page.goto(`http://localhost:3000/workouts/${DEMO_ID}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  await page.screenshot({ 
    path: 'docs/screenshots/workout-detail.png',
    fullPage: true
  })
})

test('screenshot workout edit page', async ({ page }) => {
  await page.goto(`http://localhost:3000/workouts/${DEMO_ID}/edit`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  
  // Add a few intervals
  await page.click('button:has-text("Warmup")')
  await page.click('button:has-text("Steady")')
  await page.waitForTimeout(500)
  
  await page.screenshot({ 
    path: 'docs/screenshots/workout-edit.png',
    fullPage: true
  })
})

test('screenshot workout builder page', async ({ page }) => {
  await page.goto('http://localhost:3000/workouts/new')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  
  // Add intervals
  await page.click('button:has-text("Warmup")')
  await page.click('button:has-text("Steady")')
  await page.click('button:has-text("Ramp")')
  await page.waitForTimeout(500)
  
  await page.screenshot({ 
    path: 'docs/screenshots/workout-builder.png',
    fullPage: true
  })
})

test('screenshot ride page', async ({ page }) => {
  await page.goto(`http://localhost:3000/ride/${DEMO_ID}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await page.screenshot({ 
    path: 'docs/screenshots/ride.png',
    fullPage: false
  })
})

test('screenshot library page', async ({ page }) => {
  await page.goto('http://localhost:3000/library')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  await page.screenshot({ 
    path: 'docs/screenshots/library.png',
    fullPage: true
  })
})

test('screenshot settings page', async ({ page }) => {
  await page.goto('http://localhost:3000/settings')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  await page.screenshot({ 
    path: 'docs/screenshots/settings.png',
    fullPage: true
  })
})
