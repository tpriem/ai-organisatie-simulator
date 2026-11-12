/**
 * Voert fn uit voor elk item, met hooguit `aantal` tegelijk, en geeft de uitkomsten in dezelfde volgorde
 * terug. Een voor een duurt bij tientallen bestanden te lang: elke opslagaanroep kost een rondje naar de
 * opslag. Bij de eerste fout worden geen nieuwe items meer gestart, en de fout gaat door naar de aanroeper.
 */
export async function parallel(items, aantal, fn) {
  const uit = new Array(items.length);
  let volgende = 0;
  let gestopt = false;
  async function werker() {
    while (!gestopt) {
      const i = volgende++;
      if (i >= items.length) return;
      try {
        uit[i] = await fn(items[i], i);
      } catch (err) {
        gestopt = true;
        throw err;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, aantal), items.length) }, werker));
  return uit;
}
