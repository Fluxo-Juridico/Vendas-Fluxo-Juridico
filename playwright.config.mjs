import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./tests/e2e",
  timeout:30_000,
  fullyParallel:false,
  workers:1,
  reporter:[["list"],["html",{open:"never"}]],
  use:{
    baseURL:"http://127.0.0.1:4174",
    trace:"retain-on-failure",
    screenshot:"only-on-failure",
    video:"retain-on-failure"
  },
  webServer:{
    command:"node scripts/serve-site.mjs",
    url:"http://127.0.0.1:4174",
    reuseExistingServer:false,
    timeout:15_000
  }
});
