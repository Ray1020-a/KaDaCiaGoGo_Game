/** 心得字數：不含空白與 Unicode 標點、符號類（與活動「不含標點符號」一致） */
export function countReflectionCharsExcludingPunctuation(raw: string): number {
  const noSpace = raw.replace(/\s/gu, "");
  return noSpace.replace(/[\p{P}\p{S}]/gu, "").length;
}
