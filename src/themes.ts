export type ThemeId = "candy" | "soccer" | "egg";

export const THEME_IDS: ThemeId[] = ["candy", "soccer", "egg"];

export const THEME_PRICE: Record<ThemeId, number> = {
  candy: 0,
  soccer: 150,
  egg: 350,
};

export function isThemeId(value: string | undefined): value is ThemeId {
  return value === "candy" || value === "soccer" || value === "egg";
}

export function parseTheme(value: string | undefined): ThemeId {
  return isThemeId(value) ? value : "candy";
}

export function defaultOwned(): ThemeId[] {
  return ["candy"];
}

export function normalizeOwned(raw: string[] | undefined): ThemeId[] {
  const owned = new Set<ThemeId>(["candy"]);
  for (const id of raw ?? []) if (isThemeId(id)) owned.add(id);
  return THEME_IDS.filter((id) => owned.has(id));
}
