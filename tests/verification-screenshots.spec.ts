/**
 * Verification screenshots for P0 fixes and UX improvements.
 * Uses demo data for reliable, fast verification.
 */

import { test, expect } from '@playwright/test'

test.describe('Verification screenshots', () => {
  test.beforeEach(async ({ page }) => {
    // Clear IndexedDB before each test
    await page.goto('http://localhost:3000')
    await page.evaluate(() => {
      indexedDB.deleteDatabase('cycling')
    })
    await page.reload()
  })

  test('capture all pages with demo data', async ({ page }) => {
    // 1. Load demo data from welcome page
    await page.goto('http://localhost:3000/welcome')
    await page.waitForSelector('text=Welcome to Cycling')
    
    await page.click('button:has-text("Start demo ride")')
    await page.waitForURL(/\/workouts\/[^/]+$/, { timeout: 15000 })

    // 2. Workout detail page
    await page.waitForSelector('text=Demo', { timeout: 10000 })
    await page.waitForSelector('text=songs', { timeout: 10000 })
    
    // Verify songs loaded (should not be 0)
    const footerText = await page.textContent('.action-info')
    expect(footerText).toContain('song')
    expect(footerText).not.toContain('0 songs')

    // Screenshot: Detail page with music ready
    await page.screenshot({ 
      path: 'docs/screenshots/workout-detail.png',
      fullPage: true 
    })

    // 3. Start ride and capture mid-workout
    await page.click('button:has-text("Start Ride")')
    await page.waitForURL(/\/ride\//)
    
    // Wait for ride to start
    await page.waitForSelector('text=Demo', { timeout: 5000 })
    await page.waitForSelector('.interval-countdown', { timeout: 5000 })
    
    // Wait for the ride to progress (3 seconds)
    await page.waitForTimeout(3000)
    
    // Verify interval remaining is not 00:00
    const remaining = await page.textContent('.interval-countdown')
    expect(remaining).not.toBe('00:00')
    
    // Verify power target is shown (not "— W")
    const details = await page.textContent('.interval-details')
    expect(details).not.toContain('— W')

    // Screenshot: Ride mid-workout with playhead
    await page.screenshot({ 
      path: 'docs/screenshots/ride-active.png',
      fullPage: true 
    })

    // 4. Go back to workout list
    await page.click('[aria-label="Leave ride"]')
    await page.waitForURL(/\/workouts\/[^/]+$/)
    await page.goto('http://localhost:3000')
    await page.waitForSelector('text=Demo')
    
    // Screenshot: Workout list
    await page.screenshot({ 
      path: 'docs/screenshots/workout-list.png',
      fullPage: true 
    })

    // 5. Library page
    await page.goto('http://localhost:3000/library')
    await page.waitForSelector('text=Library')
    await page.waitForSelector('text=Demo Track', { timeout: 5000 })
    
    // Screenshot: Library with demo songs
    await page.screenshot({ 
      path: 'docs/screenshots/library.png',
      fullPage: true 
    })

    // 6. Builder page
    await page.goto('http://localhost:3000/workouts/new')
    await page.waitForSelector('text=Workout builder')
    
    // Add some intervals to show the builder in action
    await page.fill('input[type="text"]', 'New Workout')
    await page.click('text=Warmup')
    await page.waitForSelector('text=Step 1')
    await page.click('text=Steady')
    await page.waitForSelector('text=Step 2')
    
    // Screenshot: Builder
    await page.screenshot({ 
      path: 'docs/screenshots/builder.png',
      fullPage: true 
    })

    // 7. Settings page
    await page.goto('http://localhost:3000/settings')
    await page.waitForSelector('text=Settings')
    
    // Screenshot: Settings
    await page.screenshot({ 
      path: 'docs/screenshots/settings.png',
      fullPage: true 
    })

    console.info('✓ All screenshots captured successfully')
  })

  test('verify Edit button works', async ({ page }) => {
    // Create a workout first
    await page.goto('http://localhost:3000/workouts/new')
    await page.fill('input[type="text"]', 'Edit Test')
    await page.click('text=Steady')
    await page.click('button:has-text("Save workout")')
    await page.waitForURL(/\/workouts\/[^/]+$/)

    // Click Edit button
    await page.click('button:has-text("Edit")')
    
    // Verify we're on the edit page
    await page.waitForURL(/\/workouts\/[^/]+\/edit$/)
    await page.waitForSelector('text=Edit workout')
    expect(await page.title()).toContain('Edit')

    console.info('✓ Edit button works')
  })
})
