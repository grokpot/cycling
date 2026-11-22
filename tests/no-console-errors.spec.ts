/** Verify no console errors on all pages */
import { test, expect } from '@playwright/test'

const DEMO_ID = 'e9ffe1a8-9a6e-479e-b4a4-2c43e2df5e7a'

test('workouts list page - no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  await page.goto('http://localhost:3000/')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  expect(errors).toEqual([])
})

test('pre-ride page (demo) - no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  await page.goto(`http://localhost:3000/workouts/${DEMO_ID}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  expect(errors).toEqual([])
})

test('pre-ride page (new workout) - no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  await page.goto('http://localhost:3000/workouts/new')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  expect(errors).toEqual([])
})

test('ride page (demo) - no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  await page.goto(`http://localhost:3000/ride/${DEMO_ID}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  expect(errors).toEqual([])
})

test('library page - no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  await page.goto('http://localhost:3000/library')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  expect(errors).toEqual([])
})

test('settings page - no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  await page.goto('http://localhost:3000/settings')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  expect(errors).toEqual([])
})
