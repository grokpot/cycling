/** Screenshots for UX fixes: library player + interval graph */

import { test, Page } from '@playwright/test'

async function setupDemo(page: Page) {
  await page.goto('http://localhost:3000/welcome')
  await page.waitForLoadState('networkidle')
  
  const startButton = page.locator('button:has-text("Start Demo")')
  if (await startButton.isVisible()) {
    await startButton.click()
    await page.waitForURL('**/workouts/**', { timeout: 10000 })
  } else {
    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')
    const demoLink = page.locator('a:has-text("Demo:")').first()
    if (await demoLink.isVisible()) {
      await demoLink.click()
      await page.waitForURL('**/workouts/**', { timeout: 10000 })
    }
  }
}

test('library page with audio player', async ({ page }) => {
  await setupDemo(page)
  
  await page.goto('http://localhost:3000/library')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  
  await page.screenshot({
    path: 'screenshots/library-with-player.png',
    fullPage: true,
  })
  
  console.log('✓ Saved library-with-player.png')
})

test('pre-ride with interval graph', async ({ page }) => {
  await page.goto('http://localhost:3000/welcome')
  await page.waitForLoadState('networkidle')
  
  const startButton = page.locator('button:has-text("Start Demo")')
  await startButton.click()
  await page.waitForURL('**/workouts/**', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  
  await page.screenshot({
    path: 'screenshots/pre-ride-graph.png',
    fullPage: true,
  })
  
  console.log('✓ Saved pre-ride-graph.png')
})
