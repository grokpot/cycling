/**
 * Pre-ride page screenshots
 */
import { test } from '@playwright/test'

test.describe('Pre-ride Screenshots', () => {
  test('Pre-ride page - desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    
    // Go to welcome and start demo
    await page.goto('/welcome')
    await page.waitForLoadState('networkidle')
    
    const startDemoBtn = page.locator('button:has-text("Start Demo")')
    await startDemoBtn.click()
    await page.waitForTimeout(2000)
    
    // Should now be on pre-ride page
    await page.screenshot({ path: 'screenshots/preride-desktop.png', fullPage: true })
  })

  test('Pre-ride page - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/welcome')
    await page.waitForLoadState('networkidle')
    
    const startDemoBtn = page.locator('button:has-text("Start Demo")')
    await startDemoBtn.click()
    await page.waitForTimeout(2000)
    
    await page.screenshot({ path: 'screenshots/preride-mobile.png', fullPage: true })
  })
})
