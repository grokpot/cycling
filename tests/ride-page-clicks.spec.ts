/** Test that ride page controls are clickable (diagnose blocking overlay) */

import { test, expect } from '@playwright/test'

async function navigateToRide(page: any) {
  await page.goto('http://localhost:3000/welcome')
  await page.waitForLoadState('networkidle')
  
  const startButton = page.locator('button:has-text("Start Demo")')
  await startButton.click()
  await page.waitForURL('**/workouts/**', { timeout: 10000 })
  
  const startRideButton = page.locator('button:has-text("Start Ride")')
  await startRideButton.click()
  await page.waitForURL('**/ride/**', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
}

async function checkForOverlays(page: any) {
  return await page.evaluate(() => {
    const overlays: Array<{ tag: string; className: string; zIndex: string; pointerEvents: string; position: string; opacity: string; display: string }> = []
    
    const checkElement = (el: Element) => {
      const style = window.getComputedStyle(el)
      const zIndex = parseInt(style.zIndex || '0', 10)
      
      if (
        (zIndex > 10 || style.position === 'fixed' || style.position === 'absolute') &&
        (style.pointerEvents !== 'none') &&
        (style.display !== 'none') &&
        (parseFloat(style.opacity) > 0)
      ) {
        overlays.push({
          tag: el.tagName,
          className: el.className,
          zIndex: style.zIndex,
          pointerEvents: style.pointerEvents,
          position: style.position,
          opacity: style.opacity,
          display: style.display,
        })
      }
    }
    
    document.querySelectorAll('*').forEach(checkElement)
    return overlays
  })
}

test.describe('Ride page interactions', () => {
  test('desktop (1440x900): all controls should be clickable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await navigateToRide(page)
    
    const overlays = await checkForOverlays(page)
    console.log(`Found ${overlays.length} potential overlay elements`)
    if (overlays.length > 0) {
      console.log('Overlays:', overlays.slice(0, 5))
    }
    
    const dimensions = await page.evaluate(() => ({
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      pageHeight: document.documentElement.scrollHeight,
    }))
    console.log('Page dimensions:', dimensions)
    
    const pauseButton = page.locator('button[aria-label*="Pause"], button[aria-label*="Resume"]').first()
    const skipButton = page.locator('button:has-text("Skip")').first()
    const controlButton = page.locator('button:has-text("Control")')
    
    const pauseBox = await pauseButton.boundingBox()
    if (pauseBox) {
      const centerX = pauseBox.x + pauseBox.width / 2
      const centerY = pauseBox.y + pauseBox.height / 2
      console.log(`Pause button at (${centerX}, ${centerY})`)
      
      const elementAtButton = await page.evaluate((p) => {
        const el = document.elementFromPoint(p.x, p.y)
        return el ? {
          tag: el.tagName,
          isButton: el.tagName === 'BUTTON',
          ariaLabel: el.getAttribute('aria-label'),
          className: el.className,
        } : null
      }, { x: centerX, y: centerY })
      
      console.log('Element at pause button:', elementAtButton)
      
      expect(elementAtButton?.isButton).toBe(true)
      expect(elementAtButton?.ariaLabel).toContain('Pause')
    }
    
    await pauseButton.click({ timeout: 5000 })
    console.log('✓ Pause button clicked')
    
    await skipButton.click({ timeout: 5000 })
    console.log('✓ Skip button clicked')
    
    await controlButton.click({ timeout: 5000 })
    console.log('✓ Control button clicked')
  })
  
  test('mobile (390x844): all controls should be clickable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await navigateToRide(page)
    
    const overlays = await checkForOverlays(page)
    console.log(`Found ${overlays.length} potential overlay elements (mobile)`)
    
    const dimensions = await page.evaluate(() => ({
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      pageHeight: document.documentElement.scrollHeight,
    }))
    console.log('Mobile dimensions:', dimensions)
    
    const pauseButton = page.locator('button[aria-label*="Pause"], button[aria-label*="Resume"]').first()
    
    const pauseBox = await pauseButton.boundingBox()
    if (pauseBox) {
      const centerX = pauseBox.x + pauseBox.width / 2
      const centerY = pauseBox.y + pauseBox.height / 2
      
      console.log(`Mobile pause button at (${centerX}, ${centerY}), viewport height: ${dimensions.viewportHeight}`)
      expect(centerY).toBeLessThan(dimensions.viewportHeight)
      
      const elementAtButton = await page.evaluate((p) => {
        const el = document.elementFromPoint(p.x, p.y)
        return el ? { tag: el.tagName, isButton: el.tagName === 'BUTTON' } : null
      }, { x: centerX, y: centerY })
      
      expect(elementAtButton?.isButton).toBe(true)
    }
    
    await pauseButton.click({ timeout: 5000 })
    await page.locator('button:has-text("Skip")').first().click({ timeout: 5000 })
    await page.locator('button:has-text("Control")').click({ timeout: 5000 })
    console.log('✓ All mobile controls clicked')
  })
  
  test('pre-ride page: controls should be clickable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:3000/welcome')
    await page.waitForLoadState('networkidle')
    
    const startButton = page.locator('button:has-text("Start Demo")')
    await startButton.click()
    await page.waitForURL('**/workouts/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    
    const overlays = await checkForOverlays(page)
    console.log(`Pre-ride page: ${overlays.length} potential overlays`)
    
    const startRideButton = page.locator('button:has-text("Start Ride")')
    const box = await startRideButton.boundingBox()
    
    if (box) {
      const centerX = box.x + box.width / 2
      const centerY = box.y + box.height / 2
      
      const elementAtButton = await page.evaluate((p) => {
        const el = document.elementFromPoint(p.x, p.y)
        return el ? { tag: el.tagName, isButton: el.tagName === 'BUTTON' } : null
      }, { x: centerX, y: centerY })
      
      console.log('Element at Start Ride button:', elementAtButton)
      expect(elementAtButton?.isButton).toBe(true)
    }
    
    await startRideButton.click({ timeout: 5000 })
    console.log('✓ Start Ride button clicked')
  })
})
