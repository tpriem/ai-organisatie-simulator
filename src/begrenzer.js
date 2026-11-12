/**
 * Een eenvoudige begrenzer: hoe vaak één sleutel (een afzender, een e-mailadres) iets mag doen per tijdvak.
 * Bewust in het geheugen: op serverless is dat een best-effort rem per instantie, geen harde garantie, maar
 * het houdt een foutieve lus, een misbruikt account of het raden van wachtwoorden binnen de perken zonder
 * extra opslag.
 */
export function maakBegrenzer({ limiet = 10, tijdvakMs = 60 * 60 * 1000, nu = () => Date.now() } = {}) {
  const per = new Map();
  return function toegestaan(sleutel) {
    const t = nu();
    const recent = (per.get(sleutel) ?? []).filter((x) => t - x < tijdvakMs);
    if (recent.length >= limiet) {
      per.set(sleutel, recent);
      return false;
    }
    recent.push(t);
    per.set(sleutel, recent);
    // De kaart mag niet onbegrensd groeien als iemand eindeloos nieuwe sleutels probeert.
    if (per.size > 5000) {
      for (const [k, v] of per) if (v.every((x) => t - x >= tijdvakMs)) per.delete(k);
    }
    return true;
  };
}
