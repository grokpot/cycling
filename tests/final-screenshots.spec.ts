/** Final screenshots for PR: library, pre-ride, expanded suggestions */

import { test, Page } from '@playwright/test'

test('library with audio player', async ({ page }) => {
  await page.goto('http://localhost:3000/welcome')
  await page.waitForLoadState('networkidle')
  
  const startButton = page.locator('button:has-text("Start Demo")')
  await startButton.click()
  await page.waitForURL('**/workouts/**', { timeout: 10000 })
  
  await page.goto('http://localhost:3000/library')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  
  await page.screenshot({
    path: 'screenshots/library-player-final.png',
    fullPage: true,
  })
  
  console.log('✓ Saved library-player-final.png')
})

test('pre-ride with graph', async ({ page }) => {
  await page.goto('http://localhost:3000/welcome')
  await page.waitForLoadState('networkidle')
  
  const startButton = page.locator('button:has-text("Start Demo")')
  await startButton.click()
  await page.waitForURL('**/workouts/**', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  
  await page.screenshot({
    path: 'screenshots/pre-ride-final.png',
    fullPage: true,
  })
  
  console.log('✓ Saved pre-ride-final.png')
})

test('pre-ride with expanded suggestions', async ({ page }) => {
  await page.goto('http://localhost:3000/welcome')
  await page.waitForLoadState('networkidle')
  
  const startButton = page.locator('button:has-text("Start Demo")')
  await startButton.click()
  await page.waitForURL('**/workouts/**', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  
  // Click suggestions accordion
  const suggestions = page.locator('button:has-text("Suggestions")')
  if (await suggestions.isVisible()) {
    await suggestions.click()
    await page.waitForTimeout(500)
  }
  
  await page.screenshot({
    path: 'screenshots/suggestions-expanded.png',
    fullPage: true,
  })
  
  console.log('✓ Saved suggestions-expanded.png')
})
