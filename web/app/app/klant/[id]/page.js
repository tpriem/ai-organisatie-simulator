import ClientWorkspace from "./ClientWorkspace";

export default async function KlantPage({ params }) {
  const { id } = await params;
  return <ClientWorkspace id={id} />;
}
