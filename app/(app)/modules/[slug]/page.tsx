import { notFound } from "next/navigation";
import { ModuleView } from "@/components/module-view";
import { MODULE_BY_SLUG, MODULES } from "@/data/modules";
import { MODULE_PAGES } from "@/data/module-pages";

export function generateStaticParams() {
  return MODULES.map((m) => ({ slug: m.slug }));
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = MODULE_BY_SLUG[slug];
  const page = MODULE_PAGES[slug];
  if (!mod || !page) notFound();

  return <ModuleView mod={mod} page={page} />;
}
