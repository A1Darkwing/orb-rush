const SAVE_KEY = "orbrush-save";

type YtLike = NonNullable<typeof ytgame>;

function makeStub(): YtLike {
  return {
    IN_PLAYABLES_ENV: false,
    SDK_VERSION: "local-stub",
    game: {
      firstFrameReady() {},
      gameReady() {},
      async loadData() {
        return localStorage.getItem(SAVE_KEY) ?? "";
      },
      async saveData(data: string) {
        localStorage.setItem(SAVE_KEY, data);
      },
    },
    ads: {
      async requestInterstitialAd() {},
      async requestRewardedAd() {
        return true;
      },
    },
    engagement: {
      async sendScore() {},
    },
    system: {
      async getLanguage() {
        return navigator.language || "vi";
      },
      isAudioEnabled() {
        return true;
      },
      onAudioEnabledChange() {
        return () => {};
      },
      onPause() {
        return () => {};
      },
      onResume() {
        return () => {};
      },
    },
    health: {
      logError() {},
      logWarning() {},
    },
  };
}

export function resolvePlatform(): YtLike {
  const stub = makeStub();
  if (typeof ytgame === "undefined" || !ytgame) return stub;
  if (ytgame.IN_PLAYABLES_ENV) return { ...ytgame, ads: ytgame.ads ?? stub.ads };
  return { ...ytgame, ads: stub.ads };
}

export const AD_REWARD_ID = "orbrush-coins-50";
export const AD_REWARD_COINS = 50;

export async function watchRewardedAd(api: YtLike): Promise<boolean> {
  try {
    return await api.ads.requestRewardedAd(AD_REWARD_ID);
  } catch {
    api.health.logWarning();
    return false;
  }
}

export function inPlayables(api: YtLike): boolean {
  return Boolean(api.IN_PLAYABLES_ENV);
}

export type Account = {
  youtube: boolean;
  id: string;
};

export function resolveAccount(api: YtLike): Account {
  if (inPlayables(api)) return { youtube: true, id: "youtube" };
  return { youtube: false, id: "guest" };
}

export async function loadSave(api: YtLike): Promise<string> {
  if (inPlayables(api)) {
    try {
      return (await api.game.loadData()) ?? "";
    } catch {
      api.health.logWarning();
      return "";
    }
  }
  return localStorage.getItem(SAVE_KEY) ?? "";
}

export async function persistSave(api: YtLike, data: string): Promise<void> {
  if (inPlayables(api)) {
    try {
      await api.game.saveData(data);
    } catch {
      api.health.logWarning();
    }
    return;
  }
  localStorage.setItem(SAVE_KEY, data);
}

export async function submitBestScore(api: YtLike, value: number): Promise<void> {
  if (!inPlayables(api)) return;
  try {
    await api.engagement.sendScore({ value: Math.floor(value) });
  } catch {
    api.health.logWarning();
  }
}
