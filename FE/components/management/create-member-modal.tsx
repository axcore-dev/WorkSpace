"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { Button, FIELD } from "@/components/ui";
import type { Member } from "@/data/types";

/** 인사 작업대 — 구성원 등록 팝업. 저장 시 입사일은 오늘(로컬 날짜). */
export function CreateMemberModal({
  open,
  teams,
  defaultTeam,
  onSave,
  onClose,
}: {
  open: boolean;
  teams: string[];
  defaultTeam?: string;
  onSave: (team: string, member: Member) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [team, setTeam] = useState(defaultTeam && teams.includes(defaultTeam) ? defaultTeam : teams[0] ?? "");
  const [rank, setRank] = useState("사원");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  function save() {
    if (!name.trim()) return;
    const now = new Date();
    const joined = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    onSave(team, {
      name: name.trim(),
      rank,
      phone: phone.trim() || "010-0000-0000",
      email: email.trim() || "new@democompany.co.kr",
      joined,
    });
    onClose();
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="구성원 등록"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={save} disabled={!name.trim()}>
            등록하기
          </Button>
        </div>
      }
    >
      <form
        className="grid gap-4 p-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <label htmlFor="cm-name" className="mb-1.5 block text-sm font-medium text-slate-700">
            이름 <span className="text-red-500">*</span>
          </label>
          <input id="cm-name" value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label htmlFor="cm-team" className="mb-1.5 block text-sm font-medium text-slate-700">
            소속 팀
          </label>
          <select id="cm-team" value={team} onChange={(e) => setTeam(e.target.value)} className={`${FIELD} cursor-pointer`}>
            {teams.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cm-rank" className="mb-1.5 block text-sm font-medium text-slate-700">
            직급
          </label>
          <select id="cm-rank" value={rank} onChange={(e) => setRank(e.target.value)} className={`${FIELD} cursor-pointer`}>
            {["사원", "주임", "선임", "책임", "팀장"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cm-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
            연락처
          </label>
          <input id="cm-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className={FIELD} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cm-email" className="mb-1.5 block text-sm font-medium text-slate-700">
            이메일
          </label>
          <input id="cm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@democompany.co.kr" className={FIELD} />
        </div>
      </form>
    </Modal>
  );
}
