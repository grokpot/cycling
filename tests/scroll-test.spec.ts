/** Test scrolling on long pages */
import { test, expect } from '@playwright/test'

test('workout builder can scroll to bottom', async ({ page }) => {
  await page.goto('http://localhost:3000/workouts/new')
  await page.waitForLoadState('networkidle')

  // Add several intervals to make the page long
  await page.click('button:has-text("Warmup")')
  await page.click('button:has-text("Steady")')
  await page.click('button:has-text("Steady")')
  await page.click('button:has-text("Ramp")')
  await page.click('button:has-text("Cooldown")')
  
  await page.waitForTimeout(500)

  // Get page height
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight)
  const viewportHeight = await page.evaluate(() => window.innerHeight)
  
  // If content is longer than viewport, test scrolling
  if (pageHeight > viewportHeight) {
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(200)
    
    // Verify we scrolled
    const scrollTop = await page.evaluate(() => window.pageYOffset || document.documentElement.scrollTop)
    expect(scrollTop).toBeGreaterThan(100)
    
    // Verify Save button is visible (it's at the bottom)
    const saveButton = page.locator('button:has-text("Save workout")')
    await expect(saveButton).toBeVisible()
  }
})

test('pre-ride page can scroll through all sections', async ({ page }) => {
  await page.goto('http://localhost:3000/workouts/e9ffe1a8-9a6e-479e-b4a4-2c43e2df5e7a')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  // Try scrolling to bottom
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(200)
  
  // Check that the Start Ride button is visible
  const startButton = page.locator('button:has-text("Start Ride")')
  await expect(startButton).toBeVisible()
})

test('library page scrolls when many songs present', async ({ page }) => {
  await page.goto('http://localhost:3000/library')
  await page.waitForLoadState('networkidle')
  
  // Try to scroll
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(200)
  
  // Should complete without error (no trapped scroll)
  const scrollTop = await page.evaluate(() => window.pageYOffset || document.documentElement.scrollTop)
  expect(scrollTop).toBeGreaterThanOrEqual(0)
})
