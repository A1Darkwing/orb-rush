import { loadArt } from "./art";
import { OrbRush } from "./game";
import { resolveLang, t } from "./i18n";
import { inPlayables, loadSave, resolvePlatform } from "./platform";

async function start(): Promise<void> {
  const canvas = document.getElementById("game");
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const api = resolvePlatform();
  api.game.firstFrameReady();

  let langTag = "vi";
  if (inPlayables(api)) {
    try {
      langTag = await api.system.getLanguage();
    } catch {
      langTag = "vi";
    }
  }

  const art = await loadArt();
  const game = new OrbRush(canvas, t(resolveLang(langTag)), art);
  (window as Window & { __orb?: OrbRush }).__orb = game;

  try {
    game.setAudioEnabled(api.system.isAudioEnabled());
  } catch {
    game.setAudioEnabled(true);
  }

  api.system.onAudioEnabledChange((on) => game.setAudioEnabled(on));
  if (inPlayables(api)) {
    api.system.onPause(() => game.pause());
    api.system.onResume(() => game.resume());
  }

  const save = await loadSave(api);
  await game.boot(save);
}

void start();
