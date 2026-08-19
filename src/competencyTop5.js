/**
 * Berekent, op basis van de taak-competentie tagging en het aandeel (tijdsbesteding)
 * per taak, welke competenties nu het meest dominant zijn en welke dat na de
 * transformatie zijn (realistisch scenario). Puur rekenwerk, geen Claude-call — zo
 * kan dit ook client-side live herberekend worden als de gebruiker aandelen aanpast.
 */
export function calculateCompetentieTop5(takenRealistisch, taakCompetenties) {
  const scoresNu = new Map();
  const scoresNa = new Map();

  for (const tag of taakCompetenties ?? []) {
    const taak = takenRealistisch[tag.taakIndex];
    if (!taak) continue;
    const overgeblevenFractie = 1 - taak.automatiseringspercentage;
    for (const competentie of tag.competenties) {
      scoresNu.set(competentie, (scoresNu.get(competentie) ?? 0) + taak.aandeel);
      scoresNa.set(competentie, (scoresNa.get(competentie) ?? 0) + taak.aandeel * overgeblevenFractie);
    }
  }

  const toTop5 = (scores) => {
    const max = Math.max(0, ...scores.values());
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([naam, score]) => ({ naam, score, relatiefPct: max > 0 ? Math.round((score / max) * 100) : 0 }));
  };

  return { top5Nu: toTop5(scoresNu), top5Na: toTop5(scoresNa) };
}
