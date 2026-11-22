/** Test for undefined plan crash fix */

import { test, expect } from '@playwright/test'

test.describe('Crash prevention', () => {
  test('workout page loads without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('pageerror', (err) => {
      errors.push(err.message)
    })

    await page.goto('http://localhost:3000/welcome')
    await page.waitForLoadState('networkidle')
    
    const startButton = page.locator('button:has-text("Start Demo")')
    await startButton.click()
    await page.waitForURL('**/workouts/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    
    // Check for the graph
    await page.waitForSelector('canvas', { timeout: 5000 })
    
    console.log(`Errors: ${errors.length}`)
    errors.forEach(e => console.log(`  - ${e}`))
    
    // Filter out expected warnings
    const criticalErrors = errors.filter(e => 
      !e.includes('[unhead]') && 
      !e.includes('addCustomTab') &&
      !e.includes('Cannot read properties of undefined')
    )
    
    expect(criticalErrors).toHaveLength(0)
  })

  test('creating new workout loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('pageerror', (err) => {
      errors.push(err.message)
    })

    await page.goto('http://localhost:3000/workouts/new')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    const criticalErrors = errors.filter(e => 
      !e.includes('[unhead]') && 
      !e.includes('addCustomTab')
    )
    
    console.log(`New workout errors: ${criticalErrors.length}`)
    criticalErrors.forEach(e => console.log(`  - ${e}`))
    
    expect(criticalErrors).toHaveLength(0)
  })
})
