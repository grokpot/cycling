/** Nuxt UI theming for dark-first cycling app */

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'zinc',
    },
    variables: {
      dark: {
        background: '10 10 10',
        foreground: '255 255 255',
      },
    },
  },
})
