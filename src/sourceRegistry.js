export const SOURCE_REGISTRY = {
  stacksocial: {
    key: "stacksocial",
    name: "StackSocial",
    home_url: "https://www.stacksocial.com",
    logo_path: "/assets/sources/stacksocial.png"
  },
  appsumo: {
    key: "appsumo",
    name: "AppSumo",
    home_url: "https://appsumo.com",
    logo_path: "/assets/sources/appsumo.png"
  },
  dealmirror: {
    key: "dealmirror",
    name: "DealMirror",
    home_url: "https://dealmirror.com",
    logo_path: "/assets/sources/dealmirror.png"
  },
  dealify: {
    key: "dealify",
    name: "Dealify",
    home_url: "https://dealify.com",
    logo_path: "/assets/sources/dealify.png"
  }
};

export function getSourceMeta(sourceKey) {
  return SOURCE_REGISTRY[sourceKey] || {
    key: sourceKey || "unknown",
    name: sourceKey || "Unknown Source",
    home_url: "",
    logo_path: "/assets/sources/default-source.png"
  };
}
