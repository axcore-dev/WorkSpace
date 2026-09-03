import { AdminSettings } from "@/components/settings/admin-settings";

export default function Page() {
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight text-slate-900">관리</h1>
      <div className="mt-6">
        <AdminSettings />
      </div>
    </>
  );
}
