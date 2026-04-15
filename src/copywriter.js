function pickAudience(deal) {
  const text = `${deal.name} ${deal.description} ${deal.meta_description || ""}`.toLowerCase();

  if (text.includes("marketing")) return "Marketing teams, creators, and founders";
  if (text.includes("developer") || text.includes("code")) return "Developers, technical founders, and builders";
  if (text.includes("design")) return "Designers, creators, and product teams";
  if (text.includes("productivity") || text.includes("notes")) return "Professionals, students, and operators";
  if (text.includes("automation")) return "Operators, founders, and workflow-heavy teams";
  return "Founders, builders, creators, and early adopters";
}

function buildBenefits(deal) {
  const text = `${deal.name} ${deal.description} ${deal.meta_description || ""}`.toLowerCase();

  if (text.includes("notes") || text.includes("docs") || text.includes("writing")) {
    return [
      "Helps speed up writing and summarization",
      "Useful if you already work in documents or notes all day",
      "Can reduce repetitive drafting work"
    ];
  }

  if (text.includes("marketing") || text.includes("copy")) {
    return [
      "Can help produce content faster",
      "Useful for drafting campaigns and messaging",
      "Worth testing if your team needs more output with less manual effort"
    ];
  }

  if (text.includes("automation") || text.includes("workflow")) {
    return [
      "May reduce repetitive workflow steps",
      "Useful for teams trying to move faster with less manual work",
      "Worth checking if process bottlenecks slow you down"
    ];
  }

  if (text.includes("code") || text.includes("developer")) {
    return [
      "Can help developers move faster in daily work",
      "Useful if you want less repetitive technical work",
      "Worth testing if it fits your existing workflow"
    ];
  }

  return [
    "Useful if this category is relevant to your workflow",
    "Worth checking before the space gets crowded",
    "Good early-adoption candidate if it fits your stack"
  ];
}

function buildHook(deal) {
  const text = `${deal.name} ${deal.description} ${deal.meta_description || ""}`.toLowerCase();

  if (text.includes("notes") || text.includes("docs") || text.includes("writing")) {
    return `If you spend a lot of time writing or organizing ideas, ${deal.name} looks worth a closer look.`;
  }

  if (text.includes("marketing") || text.includes("copy")) {
    return `${deal.name} could be worth checking if you need faster content output without adding more manual work.`;
  }

  if (text.includes("automation") || text.includes("workflow")) {
    return `${deal.name} stands out if you are trying to reduce workflow friction and move faster.`;
  }

  if (text.includes("code") || text.includes("developer")) {
    return `${deal.name} may be interesting if you want to speed up technical work without changing your whole stack.`;
  }

  return `${deal.name} looks worth a closer look if this category is relevant to the way you work.`;
}

function buildWhyNow(deal) {
  if ((deal.votes_count || 0) >= 300) {
    return "This already has strong traction, which usually makes it worth reviewing before the category gets even noisier.";
  }

  if ((deal.votes_count || 0) >= 100) {
    return "This is getting attention early, which makes it a good time to evaluate whether it fits your workflow.";
  }

  return "This is still early enough that checking it now may give you an edge before everyone starts talking about it.";
}

function buildCaution(deal) {
  const text = `${deal.name} ${deal.description} ${deal.meta_description || ""}`.toLowerCase();

  if (text.includes("ai")) {
    return "As with most AI tools, the real value will depend on how well it fits your existing workflow.";
  }

  return "This may be worth testing first before you fully commit it into your workflow.";
}

export function enhanceCopy(deal) {
  const richerDescription =
    deal.meta_description && deal.meta_description.length > deal.description.length
      ? deal.meta_description
      : deal.description;

  return {
    ...deal,
    description: richerDescription || deal.description,
    audience: pickAudience(deal),
    benefits: buildBenefits(deal),
    hook: buildHook(deal),
    why_now: buildWhyNow(deal),
    caution: buildCaution(deal)
  };
}
