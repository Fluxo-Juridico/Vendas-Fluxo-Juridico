const base = String(process.env.PRODUCTION_BASE_URL || "").replace(/\/$/, "");
const expectedSha = String(process.env.EXPECTED_SHA || "").trim();
const expectedService = "fluxo-juridico-vendas";
const requiredPaths = ["/", "/termos.html", "/privacidade.html"];

if (!base.startsWith("https://")) {
  throw new Error("PRODUCTION_BASE_URL must be an https URL.");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(path) {
  return fetch(base + path, {
    redirect: "follow",
    headers: { "user-agent": "fluxo-juridico-production-smoke/1.0" }
  });
}

async function waitForRelease() {
  let last = "";
  for (let attempt = 1; attempt <= 36; attempt += 1) {
    try {
      const response = await get("/api/health");
      const text = await response.text();
      last = `${response.status} ${text.slice(0, 500)}`;
      if (response.ok) {
        const body = JSON.parse(text);
        const servedSha = String(body?.release?.commitSha || "");
        if (
          body?.status === "ok" &&
          body?.service === expectedService &&
          (!expectedSha || servedSha === expectedSha)
        ) {
          return body;
        }
      }
    } catch (error) {
      last = String(error?.message || error);
    }
    if (attempt < 36) await sleep(5000);
  }
  throw new Error(`Production did not converge to the expected release: ${last}`);
}

const health = await waitForRelease();

for (const path of requiredPaths) {
  const response = await get(path);
  if (!response.ok) {
    throw new Error(`Smoke path failed: ${path} returned ${response.status}`);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      service: expectedService,
      base,
      commitSha: health.release.commitSha,
      migrationVersion: health.release.migrationVersion,
      billingContract: health.release.billingContract,
      checkedPaths: requiredPaths
    },
    null,
    2
  )
);
