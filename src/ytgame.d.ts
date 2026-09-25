export {};

declare global {
  const ytgame:
    | {
        IN_PLAYABLES_ENV: boolean;
        SDK_VERSION: string;
        game: {
          firstFrameReady: () => void;
          gameReady: () => void;
          loadData: () => Promise<string>;
          saveData: (data: string) => Promise<void>;
        };
        engagement: {
          sendScore: (score: { value: number }) => Promise<void>;
        };
        system: {
          getLanguage: () => Promise<string>;
          isAudioEnabled: () => boolean;
          onAudioEnabledChange: (cb: (enabled: boolean) => void) => () => void;
          onPause: (cb: () => void) => () => void;
          onResume: (cb: () => void) => () => void;
        };
        health: {
          logError: () => void;
          logWarning: () => void;
        };
      }
    | undefined;
}
