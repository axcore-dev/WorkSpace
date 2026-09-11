import { notFound } from "next/navigation";
import { ManagementModule } from "@/components/management/management-module";
import { ModuleGate } from "@/components/module-gate";
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

  // 모듈 전환 시 활성 탭·필터 등 내부 상태를 초기화하기 위해 slug로 리마운트
  return (
    <ModuleGate key={slug} mod={mod}>
      {slug === "management" ? (
        <ManagementModule key={slug} mod={mod} page={page} />
      ) : (
        <ModuleView key={slug} mod={mod} page={page} />
      )}
    </ModuleGate>
  );
}
