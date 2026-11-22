/**
 * UI verification screenshots for PR #3
 */
import { test } from '@playwright/test'

test.describe('UI Screenshots', () => {
  test('Welcome page - desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/welcome')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'screenshots/welcome-desktop.png', fullPage: true })
  })

  test('Welcome page - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/welcome')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'screenshots/welcome-mobile.png', fullPage: true })
  })

  test('Workouts list - desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    
    // Load demo data first
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Click Load Demo button if it exists
    const loadDemoBtn = page.locator('button:has-text("Load Demo")')
    if (await loadDemoBtn.isVisible()) {
      await loadDemoBtn.click()
      await page.waitForTimeout(1000)
    }
    
    await page.screenshot({ path: 'screenshots/workouts-desktop.png', fullPage: true })
  })

  test('Workouts list - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'screenshots/workouts-mobile.png', fullPage: true })
  })

  test('Pre-ride page - desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    
    // Navigate to demo workout
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Click first workout
    const workout = page.locator('[role="article"], .cursor-pointer').first()
    if (await workout.isVisible()) {
      await workout.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: 'screenshots/preride-desktop.png', fullPage: true })
    }
  })

  test('Pre-ride page - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const workout = page.locator('[role="article"], .cursor-pointer').first()
    if (await workout.isVisible()) {
      await workout.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: 'screenshots/preride-mobile.png', fullPage: true })
    }
  })

  test('Library page - desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/library')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'screenshots/library-desktop.png', fullPage: true })
  })

  test('Library page - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/library')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'screenshots/library-mobile.png', fullPage: true })
  })
})
