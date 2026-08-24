import { notFound } from "next/navigation";
import { ExternalSystemView } from "@/components/external-system-view";
import { EXTERNAL_SYSTEMS } from "@/data/org";

export function generateStaticParams() {
  return EXTERNAL_SYSTEMS.map((s) => ({ slug: s.slug }));
}

export default async function ExternalSystemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const system = EXTERNAL_SYSTEMS.find((s) => s.slug === slug);
  if (!system) notFound();

  return <ExternalSystemView key={slug} system={system} />;
}
