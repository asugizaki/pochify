const {
  GITHUB_TOKEN,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_WORKFLOW_FILE = "regenerate-deals.yml",
  GITHUB_BRANCH = "main"
} = process.env;

export async function triggerRegenerateWorkflow({ mode = "outdated" } = {}) {
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    console.warn("⚠️ GitHub workflow dispatch skipped: missing GitHub env vars");
    return {
      triggered: false,
      reason: "Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO"
    };
  }

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_FILE}/dispatches`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({
      ref: GITHUB_BRANCH,
      inputs: {
        mode
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub workflow dispatch failed: ${response.status} ${body}`);
  }

  return {
    triggered: true,
    workflow: GITHUB_WORKFLOW_FILE,
    branch: GITHUB_BRANCH,
    mode
  };
}
