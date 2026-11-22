/** Test edit button navigation */
import { test, expect } from '@playwright/test'

const DEMO_ID = 'e9ffe1a8-9a6e-479e-b4a4-2c43e2df5e7a'

test('edit button on workout detail page navigates to edit', async ({ page }) => {
  await page.goto(`http://localhost:3000/workouts/${DEMO_ID}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  // Click the Edit button
  await page.click('button:has-text("Edit")')
  
  // Should navigate to edit page
  await page.waitForURL(`**/workouts/${DEMO_ID}/edit`)
  
  expect(page.url()).toContain(`/workouts/${DEMO_ID}/edit`)
})

test('edit button on workouts list navigates to edit', async ({ page }) => {
  await page.goto('http://localhost:3000/')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  // Click first Edit button
  const editButton = page.locator('button:has-text("Edit")').first()
  await editButton.click()
  
  // Should navigate to an edit page
  await page.waitForURL('**/workouts/*/edit')
  
  expect(page.url()).toContain('/workouts/')
  expect(page.url()).toContain('/edit')
})
