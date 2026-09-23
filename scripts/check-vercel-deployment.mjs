const repository = String(process.env.GITHUB_REPOSITORY || "").trim();
const expectedSha = String(process.env.EXPECTED_SHA || "").trim();
const token = String(process.env.GITHUB_TOKEN || "").trim();
const apiBase = String(process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");

if (!repository.includes("/") || !expectedSha || !token) {
  throw new Error("GitHub/Vercel release status check is not configured.");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (let attempt = 1; attempt <= 36; attempt += 1) {
  const response = await fetch(
    `${apiBase}/repos/${repository}/commits/${encodeURIComponent(expectedSha)}/status`,
    {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
        "user-agent": "fluxo-juridico-vercel-release-gate/1.0"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub commit status lookup failed with ${response.status}.`);
  }

  const body = await response.json();
  const vercel = (body.statuses || []).find((item) => item.context === "Vercel");

  if (vercel?.state === "success") {
    console.log(
      JSON.stringify({
        ok: true,
        commitSha: expectedSha,
        vercelState: vercel.state,
        description: vercel.description || ""
      })
    );
    process.exit(0);
  }

  if (vercel?.state === "failure" || vercel?.state === "error") {
    throw new Error(
      `Vercel deployment failed for ${expectedSha}: ${vercel.description || vercel.state}`
    );
  }

  if (attempt < 36) await sleep(5000);
}

throw new Error(`Vercel deployment did not reach success for ${expectedSha}.`);
