"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/admin/breadcrumb";
import { Field, SiteFields } from "@/components/admin/form-parts";
import { IconCheck, IconInfo, IconPlus, IconSearch, IconX } from "@/components/icons";
import { Button, Card, FIELD, FIELD_ERROR, SectionHeader } from "@/components/ui";
import {
  ADMIN_WORKSPACES,
  PLANS,
  formatBizNumber,
  isValidBizNumber,
  clearDraft,
  isValidSlug,
  readDraft,
  saveDraft,
  type Draft,
  type Plan,
  type Site,
} from "@/data/admin";

/** 사업자번호 조회 결과 — 지금은 형식·중복만 본다 (외부 연동 미도입) */
type Lookup =
  | { kind: "idle" }
  | { kind: "invalid" }
  | { kind: "taken"; slug: string; company: string }
  | { kind: "ok" };

export default function AdminCreatePage() {
  const router = useRouter();

  // 사업자 정보
  const [bizNumber, setBizNumber] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ kind: "idle" });
  const [company, setCompany] = useState("");
  const [corpNumber, setCorpNumber] = useState("");
  const [bizType, setBizType] = useState("");
  const [bizItem, setBizItem] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [website, setWebsite] = useState("");

  // 종사업장
  const [sites, setSites] = useState<Site[]>([]);

  // 담당자 — 접속 링크 받는 사람과 연락 담당을 나눈다
  const [linkName, setLinkName] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [sameContact, setSameContact] = useState(true);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [cc, setCc] = useState<string[]>([]);

  // 워크스페이스 설정
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState<Plan>("Growth");
  const [memo, setMemo] = useState("");

  /** 이 브라우저에 남아 있던 작성분 — 배너로 물어보고 사용자가 고른다 */
  const [found, setFound] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<"idle" | "ok" | "fail">("idle");

  // 첫 진입에 한 번만 본다. 자동으로 채우지 않는다 — 남의 작성분을 덮어쓸 수 있다.
  // localStorage 는 서버에 없다. 마운트 뒤 마이크로태스크로 읽어야 프리렌더 결과와 어긋나지
  // 않고, effect 안에서 동기 setState 를 호출하지 않게 된다.
  useEffect(() => {
    queueMicrotask(() => setFound(readDraft()));
  }, []);

  function collect() {
    return {
      bizNumber, company, corpNumber, bizType, bizItem, address, addressDetail, website,
      sites, linkName, linkEmail, sameContact, contactName, contactEmail, contactPhone, cc,
      slug, plan, memo,
    };
  }

  function restore(d: Draft) {
    setBizNumber(d.bizNumber);
    setCompany(d.company);
    setCorpNumber(d.corpNumber);
    setBizType(d.bizType);
    setBizItem(d.bizItem);
    setAddress(d.address);
    setAddressDetail(d.addressDetail);
    setWebsite(d.website);
    setSites(d.sites);
    setLinkName(d.linkName);
    setLinkEmail(d.linkEmail);
    setSameContact(d.sameContact);
    setContactName(d.contactName);
    setContactEmail(d.contactEmail);
    setContactPhone(d.contactPhone);
    setCc(d.cc);
    setSlug(d.slug);
    setPlan(d.plan);
    setMemo(d.memo);
    // 사업자번호는 조회를 다시 거치게 한다 — 그 사이 다른 사람이 같은 번호로 개설했을 수 있다.
    setLookup({ kind: "idle" });
    clearDraft();
    setFound(null);
  }

  const bizOk = lookup.kind === "ok";
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkEmail.trim());
  const slugOk = isValidSlug(slug);
  const slugTaken = ADMIN_WORKSPACES.some((w) => w.slug === slug.trim());

  const canSubmit =
    bizOk &&
    !!company.trim() &&
    !!address.trim() &&
    !!linkName.trim() &&
    emailOk &&
    slugOk &&
    !slugTaken;

  function runLookup() {
    const digits = bizNumber.replace(/\D/g, "");
    if (!isValidBizNumber(digits)) {
      setLookup({ kind: "invalid" });
      return;
    }
    const dup = ADMIN_WORKSPACES.find((w) => w.bizNumber.replace(/\D/g, "") === digits);
    if (dup) {
      setLookup({ kind: "taken", slug: dup.slug, company: dup.company });
      return;
    }
    setLookup({ kind: "ok" });
  }


  // 폼은 상한을 둔다 — 입력칸이 1900px로 늘어나면 라벨과 값이 멀어져 오타를 놓친다
  return (
    <div className="max-w-5xl">
      <Breadcrumb items={[{ label: "워크스페이스", href: "/admin/workspaces" }, { label: "만들기" }]} />

      <h1 className="text-xl font-bold tracking-tight text-slate-900">워크스페이스 만들기</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        사업자 정보를 등록하면 접속 링크 받는 담당자에게 메일이 나가요.
      </p>

      {found && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5">
          <IconInfo size={16} className="shrink-0 text-slate-500" />
          <p className="min-w-0 flex-1 text-sm text-slate-700">
            {found.savedAt}에 임시 저장한 내용이 있어요
            {found.company && <> · {found.company}</>}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearDraft();
                setFound(null);
              }}
            >
              버리기
            </Button>
            <Button variant="secondary" size="sm" onClick={() => restore(found)}>
              이어서 작성
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        {/* ── 왼쪽: 사업자 정보 + 종사업장 ── */}
        <div className="space-y-4">
          <Card>
            <SectionHeader title="사업자 정보" />

            <Field
              id="biz"
              label="사업자등록번호"
              required
              error={
                lookup.kind === "invalid"
                  ? "사업자등록번호 형식이 맞지 않아요. 10자리를 다시 확인해 주세요."
                  : lookup.kind === "taken"
                    ? `이미 등록된 사업자예요. ${lookup.company}(${lookup.slug})에서 확인해 주세요.`
                    : undefined
              }
              hint={
                bizOk
                  ? undefined
                  : "숫자 10자리. 조회하면 형식과 중복 등록만 확인해요 (국세청 연동은 아직 없어요)."
              }
            >
              <div className="flex gap-2">
                <input
                  id="biz"
                  inputMode="numeric"
                  value={bizNumber}
                  placeholder="000-00-00000"
                  onChange={(e) => {
                    setBizNumber(formatBizNumber(e.target.value));
                    setLookup({ kind: "idle" });
                  }}
                  aria-invalid={lookup.kind === "invalid" || lookup.kind === "taken" || undefined}
                  className={`${lookup.kind === "invalid" || lookup.kind === "taken" ? FIELD_ERROR : FIELD} flex-1 tabular-nums`}
                />
                <Button variant="secondary" onClick={runLookup} disabled={!bizNumber}>
                  <IconSearch size={15} />
                  조회
                </Button>
              </div>
            </Field>

            {bizOk && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <IconCheck size={13} />
                등록할 수 있는 사업자등록번호예요. 아래 항목은 계약서를 보고 입력해 주세요.
              </p>
            )}

            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="company" label="회사명" required>
                  <input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="주식회사 OOO"
                    className={FIELD}
                  />
                </Field>
                <Field id="corp" label="법인등록번호">
                  <input
                    id="corp"
                    value={corpNumber}
                    onChange={(e) => setCorpNumber(e.target.value)}
                    placeholder="000000-0000000"
                    className={`${FIELD} tabular-nums`}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="bizType" label="업태">
                  <input
                    id="bizType"
                    value={bizType}
                    onChange={(e) => setBizType(e.target.value)}
                    placeholder="제조업"
                    className={FIELD}
                  />
                </Field>
                <Field id="bizItem" label="업종">
                  <input
                    id="bizItem"
                    value={bizItem}
                    onChange={(e) => setBizItem(e.target.value)}
                    placeholder="1차 철강 제조"
                    className={FIELD}
                  />
                </Field>
              </div>

              <Field id="address" label="본사 주소" required>
                <input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="도로명 주소"
                  className={FIELD}
                />
                <input
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                  aria-label="상세 주소"
                  placeholder="상세 주소"
                  className={`${FIELD} mt-2`}
                />
              </Field>

              <Field id="website" label="웹사이트">
                <input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                  className={FIELD}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionHeader title="종사업장" desc="본사 외 사업장이 있으면 추가해 주세요." />

            <SiteFields sites={sites} onChange={setSites} />
          </Card>
        </div>

        {/* ── 오른쪽: 담당자 + 설정 + 안내 ── */}
        <div className="space-y-4">
          <Card>
            <SectionHeader
              title="담당자"
              desc="접속 링크 받는 사람과 연락 담당을 따로 둘 수 있어요."
            />

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-700">접속 링크 받는 사람</p>
              <p className="mt-0.5 text-xs text-slate-500">
                이 주소로 접속 링크가 나가고, 링크를 연 사람이 첫 관리자가 돼요.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field id="link-name" label="이름" required>
                  <input
                    id="link-name"
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder="홍길동"
                    className={FIELD}
                  />
                </Field>
                <Field
                  id="link-email"
                  label="이메일"
                  required
                  error={linkEmail && !emailOk ? "이메일 형식을 확인해 주세요." : undefined}
                >
                  <input
                    id="link-email"
                    type="email"
                    value={linkEmail}
                    onChange={(e) => setLinkEmail(e.target.value)}
                    placeholder="name@company.co.kr"
                    aria-invalid={(!!linkEmail && !emailOk) || undefined}
                    className={linkEmail && !emailOk ? FIELD_ERROR : FIELD}
                  />
                </Field>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={sameContact}
                onChange={(e) => setSameContact(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-slate-800"
              />
              연락 담당도 같은 사람이에요
            </label>

            {!sameContact && (
              <div className="mt-3 rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-700">연락 담당</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  계약·정산 연락을 받는 사람이에요. 접속 링크는 이 주소로 가지 않아요.
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field id="c-name" label="이름">
                    <input
                      id="c-name"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="김담당"
                      className={FIELD}
                    />
                  </Field>
                  <Field id="c-phone" label="연락처">
                    <input
                      id="c-phone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="010-0000-0000"
                      className={`${FIELD} tabular-nums`}
                    />
                  </Field>
                </div>
                <div className="mt-4">
                  <Field id="c-email" label="이메일">
                    <input
                      id="c-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="name@company.co.kr"
                      className={FIELD}
                    />
                  </Field>
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className="mb-1.5 text-sm font-medium text-slate-700">참조 수신</p>
              <p className="mb-2 text-xs text-slate-400">발송 메일에 CC로 함께 들어가요.</p>
              <div className="space-y-2">
                {cc.map((v, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="email"
                      value={v}
                      onChange={(e) => setCc((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                      aria-label={`참조 수신 ${i + 1}`}
                      placeholder="추가 이메일"
                      className={`${FIELD} flex-1`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`참조 수신 ${i + 1} 삭제`}
                      onClick={() => setCc((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <IconX size={14} />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className={cc.length > 0 ? "mt-2" : undefined}
                onClick={() => setCc((prev) => [...prev, ""])}
              >
                <IconPlus size={13} />
                한 줄 더
              </Button>
            </div>
          </Card>

          <Card>
            <SectionHeader title="워크스페이스 설정" />
            <div className="space-y-4">
              <Field
                id="slug"
                label="워크스페이스 이름"
                required
                error={
                  slug && !slugOk
                    ? "영문 소문자·숫자·하이픈만, 3~40자로 지어 주세요."
                    : slugTaken
                      ? "이미 쓰는 이름이에요. 다른 이름을 지어 주세요."
                      : undefined
                }
                hint="영문 소문자와 하이픈만. 만든 뒤에는 바꿀 수 없어요."
              >
                <input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="hanbit-prod"
                  aria-invalid={(!!slug && (!slugOk || slugTaken)) || undefined}
                  className={slug && (!slugOk || slugTaken) ? FIELD_ERROR : FIELD}
                />
              </Field>

              <Field id="plan" label="요금제">
                <select
                  id="plan"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as Plan)}
                  className={`${FIELD} cursor-pointer`}
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>

              <Field id="memo" label="메모" hint="내부용이에요. 고객에게는 보이지 않아요.">
                <textarea
                  id="memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={3}
                  placeholder="계약 특이사항, 후속 처리 등"
                  className={FIELD}
                />
              </Field>
            </div>
          </Card>

          <Card className="bg-slate-50">
            <SectionHeader title="만들면 이렇게 됩니다" />
            <ol className="space-y-1.5 text-sm text-slate-600">
              <li>1. 워크스페이스가 <span className="font-semibold text-slate-900">초대 메일 발송함</span> 상태로 생성돼요.</li>
              <li>2. 접속 링크 받는 사람에게 메일이 나가요{cc.length > 0 && ` (참조 ${cc.length}명)`}.</li>
              <li>3. 링크를 연 사람이 첫 관리자로 등록돼요.</li>
              <li>4. ERP·MES 연동은 상세 화면의 <span className="font-semibold text-slate-900">외부 시스템 연동</span> 탭에서 따로 진행해요.</li>
            </ol>
          </Card>

          <p className="text-xs text-slate-400">
            임시 저장은 <span className="font-medium text-slate-600">이 브라우저에만</span> 남아요.
            다른 PC에서는 보이지 않고, 이어서 작성하면 저장분은 지워집니다.
          </p>

          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200 bg-white/95 p-4 backdrop-blur">
            <Button variant="secondary" href="/admin/workspaces">
              취소
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const at = new Date().toLocaleString("ko-KR");
                setSaved(saveDraft(collect(), at) ? "ok" : "fail");
                setTimeout(() => setSaved("idle"), 2600);
              }}
            >
              {saved === "ok" ? "저장했어요" : saved === "fail" ? "저장 못 했어요" : "임시 저장"}
            </Button>
            <Button
              disabled={!canSubmit}
              title={canSubmit ? undefined : "필수 항목을 모두 채우면 만들 수 있어요"}
              onClick={() => router.push("/admin/workspaces")}
            >
              만들고 메일 보내기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
