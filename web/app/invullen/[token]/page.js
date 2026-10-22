import Invullen from "./Invullen";

// Publieke pagina voor een invuller. Niet op te zoeken door zoekmachines.
export const metadata = {
  title: "AI-volwassenheid — vragenlijst",
  robots: { index: false, follow: false },
};

export default async function InvullenPage({ params }) {
  const { token } = await params;
  return <Invullen token={token} />;
}
