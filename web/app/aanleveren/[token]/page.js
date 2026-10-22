import Aanleveren from "./Aanleveren";

// Publieke pagina om bestanden aan te leveren. Niet op te zoeken door zoekmachines.
export const metadata = {
  title: "Gegevens aanleveren",
  robots: { index: false, follow: false },
};

export default async function AanleverenPage({ params }) {
  const { token } = await params;
  return <Aanleveren token={token} />;
}
