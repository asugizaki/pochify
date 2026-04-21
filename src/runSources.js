import { fetchStackSocialDeals } from "./sources/stackSocialSource.js";

export async function runSources(settings = {}) {
  const jobs = [];

  if (settings.enable_stacksocial_source) {
    jobs.push(
      fetchStackSocialDeals({
        maxDeals: 120,
        limitPerCollection: 80,
        lifetimeScoreBonus: Number(settings.lifetime_score_bonus || 0),
        enableScoringDebug: !!settings.enable_scoring_debug,
        enableSourceDebug: !!settings.enable_source_debug
      }).then((items) => ({
        source: "stacksocial",
        items
      }))
    );
  }

  const results = await Promise.all(jobs);
  return results.flatMap((result) => result.items || []);
}
