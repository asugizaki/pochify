function detectDealType(deal) {
  const text = `${deal.name} ${deal.description} ${deal.meta_description || ""}`.toLowerCase();

  if (text.includes("lifetime")) return "lifetime";
  if (text.includes("discount") || text.includes("% off") || text.includes("save")) return "discount";
  if (text.includes("free trial")) return "trial";
  if (text.includes("free")) return "free";
  if (deal.votes_count > 200) return "early";

  return "none";
}

function buildValueHook(deal) {
  switch (deal.deal_type) {
    case "lifetime":
      return "Lifetime deal — pay once instead of monthly.";
    case "discount":
      return "Discount available — worth checking pricing before it changes.";
    case "trial":
      return "Free trial available — you can test it before committing.";
    case "free":
      return "Free tier available — you can start without paying.";
    case "early":
      return "Still early — tools like this often raise prices later.";
    default:
      return "Worth checking if this fits your workflow.";
  }
}

export function enrichWithValue(deal) {
  const deal_type = detectDealType(deal);

  return {
    ...deal,
    deal_type,
    value_hook: buildValueHook({ ...deal, deal_type })
  };
}
