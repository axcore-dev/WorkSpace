"use client";

/**
 * 소스 문서 — 올리기 · 목록 맞추기 · 지우기 · 열기.
 *
 * 문서는 서버(테넌트 스키마 + Object Storage)에 있고, 화면이 드는 것은 그 사본이다(`use-conversations.ts` 의
 * 저장소). 여기서 하는 일은 서버에 요청을 내고 돌아온 값으로 그 사본을 맞추는 것뿐이다.
 *
 * 어느 문서를 골랐는지는 대화마다 다르므로(`Note.src.selected`) 선택 변경도 여기서 서버에 남긴다.
 */
import { useEffect } from "react";
import { deleteSource, getSourceView, listSources, uploadSources } from "@/lib/ai/sources";
import { updateConversation } from "@/lib/ai/conversations";
import { ApiRequestError } from "@/lib/api";
import type { SourceDoc, SourceState } from "@/data/chat";
import type { Failure } from "./use-ai-chat";
import type { Notebooks } from "./use-conversations";

export interface Sources {
  /** 파일 추가 — 실패하면 같은 파일로 다시 시도할 수 있게 파일을 함께 올린다 */
  add: (files: File[], scope?: "personal" | "company") => Promise<void>;
  remove: (name: string) => void;
  open: (name: string) => Promise<void>;
  /** 선택 변경 — 화면에 바로 반영하고, 대화가 있으면 서버에도 남긴다 */
  changeSelection: (next: (s: SourceState) => string[]) => void;
}

export function useSources(opts: { nb: Notebooks; setError: (f: Failure | null) => void }): Sources {
  const { nb, setError } = opts;
  const { sources } = nb.src;
  /** 업로드 실패에는 파일을 함께 담는다 — 화면이 같은 파일로 다시 시도할 수 있게 */
  const fail = (text: string, files: File[] = []) => setError({ kind: "notice", files, text });

  /**
   * 색인 상태 polling. 업로드 응답은 `indexing` 으로 오고 조각 생성은 서버가 응답 뒤에 이어서 하므로,
   * 화면이 다시 묻지 않으면 '색인 중' 이 영원히 남는다. 표시 중인 소스에 색인 중인 것이 있을 때만
   * 2초마다 목록을 받아 같은 id 의 상태를 갱신하고, 전부 끝나면 멈춘다.
   */
  const indexing = sources.some((d) => d.id && d.status === "indexing");
  useEffect(() => {
    if (!indexing) return;
    let stopped = false;
    const tick = async () => {
      let fresh: SourceDoc[];
      try {
        fresh = await listSources();
      } catch {
        return; // 일시 실패는 다음 tick 에 다시 본다
      }
      if (stopped) return;
      nb.setLibrary(fresh);
      const byId = new Map(fresh.filter((d) => d.id).map((d) => [d.id!, d]));
      nb.patchAllSrc((s) => ({
        ...s,
        sources: s.sources.map((d) => {
          const f = d.id ? byId.get(d.id) : undefined;
          return f && f.status !== d.status ? { ...d, status: f.status, updated: f.updated } : d;
        }),
      }));
    };
    const timer = setInterval(() => void tick(), 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // nb 는 매 렌더 새 객체다. 타이머를 다시 걸 이유는 '색인 중이 있는가' 하나뿐이다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexing]);

  async function add(files: File[], scope: "personal" | "company" = "personal") {
    if (!files.length) return;
    setError(null);
    try {
      // 같은 이름은 교체다 — 서버가 기존 문서(객체·조각)를 지우고 새 것으로 바꿔 다시 색인한다.
      // 화면도 그 항목을 새 id·'색인 중' 으로 갈아 끼우되 자리와 선택 상태는 그대로 둔다.
      const docs = await uploadSources(files, scope);
      const byName = new Map(docs.map((d) => [d.name, d]));
      const added = docs.filter((d) => !nb.src.sources.some((x) => x.name === d.name));
      const nextSelected = [...new Set([...nb.src.selected, ...docs.map((d) => d.name)])];
      nb.patchSrc((s) => ({
        sources: [...added, ...s.sources.map((x) => byName.get(x.name) ?? x)],
        selected: nextSelected,
      }));
      if (nb.active) {
        void updateConversation(nb.active.id, { selectedSources: nextSelected }).catch(() => undefined);
      }
      // 다른 대화·초안이 같은 문서를 들고 있으면 거기도 새 버전으로 맞춘다
      nb.patchAllSrc((s) => ({ ...s, sources: s.sources.map((x) => byName.get(x.name) ?? x) }));
      nb.setLibrary([...docs, ...nb.library().filter((d) => !byName.has(d.name))]);
    } catch (e) {
      fail(e instanceof ApiRequestError ? e.message : "소스를 올리지 못했어요", files);
    }
  }

  /**
   * 삭제 — 목록·선택에서 바로 지우고, 서버 문서(id 있음)면 스토리지·색인도 지운다.
   * 서버 삭제는 기다리지 않는다. 화면에서 사라지는 게 사용자가 기대한 일이고, 실패해도 다음 목록
   * 조회에서 다시 보이는 것 외에 잃는 것이 없다.
   */
  function remove(name: string) {
    const doc = sources.find((d) => d.name === name);
    nb.patchAllSrc((s) => ({
      sources: s.sources.filter((d) => d.name !== name),
      selected: s.selected.filter((n) => n !== name),
    }));
    nb.setLibrary(nb.library().filter((d) => d.name !== name));
    if (doc?.id) void deleteSource(doc.id).catch(() => undefined);
  }

  /** 열기 — 서버가 준 한시적 링크를 새 탭에서 연다 */
  async function open(name: string) {
    const doc = sources.find((d) => d.name === name);
    if (!doc?.id) return;
    // 팝업 차단을 피하려면 클릭 직후에 창을 열어 두고 주소를 나중에 넣어야 한다
    const win = window.open("", "_blank", "noopener,noreferrer");
    try {
      const { url } = await getSourceView(doc.id);
      if (win) win.location.href = url;
    } catch (e) {
      win?.close();
      fail(e instanceof ApiRequestError ? e.message : "문서를 열지 못했어요");
    }
  }

  function changeSelection(next: (s: SourceState) => string[]) {
    const selected = next(nb.src);
    nb.patchSrc((s) => ({ ...s, selected }));
    if (nb.active) {
      void updateConversation(nb.active.id, { selectedSources: selected }).catch(() => undefined);
    }
  }

  return { add, remove, open, changeSelection };
}
