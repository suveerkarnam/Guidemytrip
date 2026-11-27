export type GuideRankInput = { languageMatches: number; preferenceCount: number; rating: number; experienceYears: number; hasAvailability: boolean };

export function rankGuide(input: GuideRankInput) {
  const languageScore = input.preferenceCount ? input.languageMatches / input.preferenceCount : 0;
  return languageScore * 1000 + input.rating * 100 + input.experienceYears * 2 + (input.hasAvailability ? 10 : 0);
}

export function rankGuides<T extends GuideRankInput>(guides: T[]) { return [...guides].sort((left, right) => rankGuide(right) - rankGuide(left)); }
