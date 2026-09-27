import { defineConfig, devices } from '@playwright/test';

/* O app e um HTML unico, sem build. Servimos por http:// para que o manifest e
   o service worker se comportem como em producao, e assim o Playwright tem um
   baseURL. O servidor e o tools/serve.mjs, sem dependencias. */
const PORT = Number(process.env.PORT || 4173);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // o service worker nao cacheia nada e só atrapalharia a determinacao dos testes
    serviceWorkers: 'block',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `node tools/serve.mjs ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
