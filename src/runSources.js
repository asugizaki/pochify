import { loadSourcePages } from "./loadSourcePages.js";
import { fetchStackSocialDeals } from "./sources/stackSocialSource.js";
import { fetchAppsumoDeals } from "./sources/appsumoSource.js";
import { fetchDealmirrorDeals } from "./sources/dealmirrorSource.js";
import { fetchDealifyDeals } from "./sources/dealifySource.js";

function groupPagesBySource(items = []) {
  const grouped = new Map();

  for (const item of items) {
    if (!grouped.has(item.source_key)) {
      grouped.set(item.source_key, []);
    }
    grouped.get(item.source_key).push(item);
  }

  return grouped;
}

export async function runSources(settings = {}) {
  const sourcePages = await loadSourcePages();
  const grouped = groupPagesBySource(sourcePages);

  const jobs = [];

  if (settings.enable_stacksocial_source && grouped.has("stacksocial")) {
    jobs.push(
      fetchStackSocialDeals(grouped.get("stacksocial"), {
        maxDeals: 120,
        limitPerCollection: 80,
        lifetimeScoreBonus: Number(settings.lifetime_score_bonus || 0),
        enableScoringDebug: !!settings.enable_scoring_debug
      })
    );
  }

  if (grouped.has("appsumo")) {
    jobs.push(
      fetchAppsumoDeals(grouped.get("appsumo"), {
        lifetimeScoreBonus: Number(settings.lifetime_score_bonus || 0),
        enableScoringDebug: !!settings.enable_scoring_debug
      })
    );
  }

  if (grouped.has("dealmirror")) {
    jobs.push(
      fetchDealmirrorDeals(grouped.get("dealmirror"), {
        lifetimeScoreBonus: Number(settings.lifetime_score_bonus || 0),
        enableScoringDebug: !!settings.enable_scoring_debug
      })
    );
  }

  if (grouped.has("dealify")) {
    jobs.push(
      fetchDealifyDeals(grouped.get("dealify"), {
        lifetimeScoreBonus: Number(settings.lifetime_score_bonus || 0),
        enableScoringDebug: !!settings.enable_scoring_debug
      })
    );
  }

  const results = await Promise.all(jobs);
  return results.flat();
}
