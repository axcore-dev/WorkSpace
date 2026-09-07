import { IconLock } from "@/components/icons";
import { Button } from "@/components/ui";

/**
 * 권한 관리에 들어올 수 없을 때.
 *
 * **왜 못 들어오는지와 다음에 할 일을 함께 적는다.** 「권한이 없습니다」만 있으면 화면이
 * 고장 난 것처럼 보이고, 누구에게 물어야 하는지도 모른다.
 *
 * 내비에는 이 항목이 아예 안 보인다 — 여기까지 온 사람은 주소를 직접 쳤거나 옛 링크를 열었다.
 */
export function RolesDenied() {
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight text-slate-900">권한 관리</h1>
      <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-6 py-14 text-center">
        <IconLock size={26} className="text-slate-400" />
        <p className="mt-3 text-sm font-semibold text-slate-900">소유자만 볼 수 있는 화면이에요</p>
        <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-slate-500">
          직급과 권한을 정하는 자리라 회사를 대표하는 한 사람에게만 열려 있어요.
          바꿀 게 있으면 소유자에게 알려 주세요.
        </p>
        <Button variant="secondary" size="sm" className="mt-5" href="/settings/company/invites">
          초대 관리로 가기
        </Button>
      </div>
    </>
  );
}
