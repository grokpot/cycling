/** Test that ride page controls are clickable (diagnose blocking overlay) */

import { test, expect } from '@playwright/test'

test.describe('Ride page interactions', () => {
  test('should identify what element is at click points', async ({ page }) => {
    // Load demo data and start a ride
    await page.goto('http://localhost:3000/welcome')
    await page.waitForLoadState('networkidle')
    
    const startButton = page.locator('button:has-text("Start Demo")')
    await startButton.click()
    await page.waitForURL('**/workouts/**', { timeout: 10000 })
    
    // Click Start Ride
    const startRideButton = page.locator('button:has-text("Start Ride")')
    await startRideButton.click()
    await page.waitForURL('**/ride/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Check what elements are at various points on the page
    const points = [
      { x: 100, y: 100, label: 'top-left' },
      { x: 400, y: 200, label: 'center-ish' },
      { x: 200, y: 400, label: 'mid-page' },
      { x: 300, y: 600, label: 'bottom-area' },
    ]
    
    for (const point of points) {
      const element = await page.evaluate((p) => {
        const el = document.elementFromPoint(p.x, p.y)
        if (!el) return null
        return {
          tag: el.tagName,
          id: el.id,
          className: el.className,
          text: el.textContent?.slice(0, 50),
          zIndex: window.getComputedStyle(el).zIndex,
          pointerEvents: window.getComputedStyle(el).pointerEvents,
          position: window.getComputedStyle(el).position,
        }
      }, point)
      
      console.log(`Point (${point.x}, ${point.y}) [${point.label}]:`, element)
    }
    
    // Check viewport and page dimensions
    const dimensions = await page.evaluate(() => ({
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      pageHeight: document.documentElement.scrollHeight,
      scrollY: window.scrollY,
    }))
    console.log('\\nPage dimensions:', dimensions)
    
    // Try to click the pause button
    console.log('\\nAttempting to click pause button...')
    const pauseButton = page.locator('button[aria-label*="Pause"], button[aria-label*="Resume"]').first()
    
    const pauseBox = await pauseButton.boundingBox()
    if (pauseBox) {
      const centerX = pauseBox.x + pauseBox.width / 2
      const centerY = pauseBox.y + pauseBox.height / 2
      
      console.log(`Pause button box: x=${pauseBox.x}, y=${pauseBox.y}, width=${pauseBox.width}, height=${pauseBox.height}`)
      console.log(`Pause button center: (${centerX}, ${centerY})`)
      console.log(`Is button below viewport? ${centerY > dimensions.viewportHeight}`)
      
      // Scroll button into view
      await pauseButton.scrollIntoViewIfNeeded()
      console.log('Scrolled button into view')
      
      const elementAtPauseButton = await page.evaluate((p) => {
        const el = document.elementFromPoint(p.x, p.y)
        if (!el) return null
        return {
          tag: el.tagName,
          id: el.id,
          className: el.className,
          text: el.textContent?.slice(0, 50),
          zIndex: window.getComputedStyle(el).zIndex,
          pointerEvents: window.getComputedStyle(el).pointerEvents,
          position: window.getComputedStyle(el).position,
          isButton: el.tagName === 'BUTTON',
          ariaLabel: el.getAttribute('aria-label'),
        }
      }, { x: centerX, y: centerY })
      
      console.log(`Element at pause button center (${centerX}, ${centerY}):`, elementAtPauseButton)
      
      // After scrolling, check again
      if (!elementAtPauseButton) {
        console.warn('Button still not at expected coordinates after scroll - checking if clickable anyway')
      }
    }
    
    // Try to actually click the pause button
    await pauseButton.click({ timeout: 5000 })
    console.log('✓ Pause button clicked successfully')
    
    // Try clicking Skip button
    const skipButton = page.locator('button:has-text("Skip")').first()
    await skipButton.click({ timeout: 5000 })
    console.log('✓ Skip button clicked successfully')
    
    // Try clicking Control button
    const controlButton = page.locator('button:has-text("Control")')
    await controlButton.click({ timeout: 5000 })
    console.log('✓ Control button clicked successfully')
  })
})
