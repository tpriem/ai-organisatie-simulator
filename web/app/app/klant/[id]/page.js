import ClientWorkspace from "./ClientWorkspace";

export default async function KlantPage({ params, searchParams }) {
  const { id } = await params;
  const { nieuw } = await searchParams;
  return <ClientWorkspace id={id} nieuw={nieuw === "1"} />;
}
