// De kleur van elke bestemming van vrijgekomen capaciteit in Word en PDF. Op één plek, zodat de twee
// rapporten niet uit elkaar lopen. De app gebruikt Tailwind-klassen (app/app/klant/[id]/bestemmingStijl.js);
// daar is kwaliteitsverbetering HoD-cyaan, op wit papier is dat te licht en blijft het groen.
export const BESTEMMING_HEX = {
  kostenreductie: "#9d9bbd",
  capaciteitsgroei: "#7b4feb",
  kwaliteitsverbetering: "#10b981",
  onbepaald: "#d5c9fb",
};

/** Dezelfde kleuren zoals Word ze wil: hoofdletters, zonder #. */
export const BESTEMMING_WORD = Object.fromEntries(Object.entries(BESTEMMING_HEX).map(([k, v]) => [k, v.slice(1).toUpperCase()]));
