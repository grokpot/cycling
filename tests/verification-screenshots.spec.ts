/**
 * Verification screenshots for P0 fixes and UX improvements.
 * Seeds real uploaded fixture songs and builder-made workout with NO cadence.
 */

import { test, expect } from '@playwright/test'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

test.describe('Verification screenshots', () => {
  test.beforeEach(async ({ page }) => {
    // Clear IndexedDB before each test
    await page.goto('http://localhost:3000')
    await page.evaluate(() => {
      indexedDB.deleteDatabase('cycling')
    })
    await page.reload()
  })

  test('capture all pages with custom workout (no cadence)', async ({ page }) => {
    // 1. Load demo data via welcome page
    await page.goto('http://localhost:3000/welcome')
    await page.waitForSelector('text=Welcome to Cycling')
    await page.click('button:has-text("Start demo ride")')
    await page.waitForURL(/\/workouts\/[^/]+$/, { timeout: 15000 })
    
    // Wait for demo workout to load
    await page.waitForSelector('text=Demo')
    
    // 2. Go back and build our own workout with NO cadence (Ryan's case)
    await page.goto('http://localhost:3000/workouts/new')
    await page.waitForSelector('text=Workout builder')

    await page.fill('input[type="text"]', 'User Workout')
    
    // Add warmup - leave cadence empty
    await page.click('button:has-text("Warmup")')
    await page.waitForSelector('text=Step 1')
    
    // Add steady interval - leave cadence empty
    await page.click('button:has-text("Steady")')
    await page.waitForSelector('text=Step 2')
    
    // Add cooldown - leave cadence empty
    await page.click('button:has-text("Cooldown")')
    await page.waitForSelector('text=Step 3')

    // Screenshot: Builder with intervals
    await page.screenshot({ 
      path: 'docs/screenshots/builder.png',
      fullPage: true 
    })

    // Save workout
    await page.click('button:has-text("Save workout")')
    await page.waitForURL(/\/workouts\/[^/]+$/)

    // 3. Workout detail page
    await page.waitForSelector('text=User Workout')
    // Wait for music planning to complete
    await page.waitForTimeout(3000)
    await page.waitForSelector('text=songs', { timeout: 10000 })
    
    // Verify songs loaded (should not be 0)
    const footerText = await page.textContent('.action-info')
    expect(footerText).toContain('song')
    expect(footerText).not.toContain('· 0 songs')
    console.info(`Footer: ${footerText}`)

    // Screenshot: Detail page with music ready
    await page.screenshot({ 
      path: 'docs/screenshots/workout-detail.png',
      fullPage: true 
    })

    // 4. Start ride and capture mid-workout
    await page.click('button:has-text("Start Ride")')
    await page.waitForURL(/\/ride\//)
    
    // Wait for ride to start
    await page.waitForSelector('text=User Workout', { timeout: 5000 })
    await page.waitForSelector('.interval-countdown', { timeout: 5000 })
    
    // Wait for the ride to progress (5 seconds to show playhead movement)
    await page.waitForTimeout(5000)
    
    // Verify interval remaining is not 00:00
    const remaining = await page.textContent('.interval-countdown')
    expect(remaining).not.toBe('00:00')
    console.info(`Interval remaining: ${remaining}`)
    
    // Verify power target is shown (not "— W")
    const details = await page.textContent('.interval-details')
    expect(details).not.toContain('— W')
    console.info(`Interval details: ${details}`)

    // Screenshot: Ride mid-workout with playhead and song playing
    await page.screenshot({ 
      path: 'docs/screenshots/ride-active.png',
      fullPage: true 
    })

    // 5. Go back to workout list
    await page.click('[aria-label="Leave ride"]')
    await page.waitForURL(/\/workouts\/[^/]+$/)
    await page.goto('http://localhost:3000')
    await page.waitForSelector('text=User Workout')
    
    // Screenshot: Workout list
    await page.screenshot({ 
      path: 'docs/screenshots/workout-list.png',
      fullPage: true 
    })

    // 6. Settings page
    await page.goto('http://localhost:3000/settings')
    await page.waitForSelector('text=Settings')
    
    // Screenshot: Settings
    await page.screenshot({ 
      path: 'docs/screenshots/settings.png',
      fullPage: true 
    })

    // 7. Welcome page
    await page.goto('http://localhost:3000/welcome')
    await page.waitForSelector('text=Welcome to Cycling')
    
    // Screenshot: Welcome
    await page.screenshot({ 
      path: 'docs/screenshots/welcome.png',
      fullPage: true 
    })

    console.info('✓ All screenshots captured successfully')
  })
})
