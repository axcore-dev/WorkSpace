package com.axcore.workspace.workspace.admin.dto;

/**
 * 상세 수정 응답. 회사 정보와 함께 <b>담당자 변경이 무엇을 일으켰는지</b>를 돌려준다.
 *
 * <p>담당자 이메일이 바뀌면 서버가 그 자리에서 후속 처리를 한다(소유자 이전 또는 초대 발급). 화면은
 * 그 결과를 알아야 "권한을 넘겼어요" 와 "링크를 복사해 보내 주세요" 를 구분해 보여 줄 수 있다.
 *
 * @param workspace 수정된 회사 정보(구성원 목록은 비어 있다 — 화면은 부분 갱신으로 병합한다)
 * @param contactChange 담당자 변경 결과. 담당자가 바뀌지 않았으면 {@code NONE}
 */
public record WorkspaceUpdateResponse(WorkspaceResponse workspace, ContactChange contactChange) {

    /**
     * @param type 무슨 일이 일어났나
     * @param email 새 담당자 이메일(정규화). NONE 이면 null
     * @param inviteLink INVITED 일 때 발급된 링크 원문. <b>이 응답에만 실리고 다시 조회할 수 없다.</b>
     * @param invitation INVITED 일 때 초대 정보(만료 시각 등)
     * @param demotedOwners PROMOTED 일 때 관리자로 내려간 이전 소유자 수
     */
    public record ContactChange(
            Type type, String email, String inviteLink, InvitationResponse invitation, int demotedOwners) {

        public enum Type {
            /** 담당자 이메일이 바뀌지 않았다 */
            NONE,
            /** 새 담당자가 이미 구성원이라 소유자 권한을 바로 넘겼다 */
            PROMOTED,
            /** 새 담당자가 구성원이 아니라 초대 링크를 발급했다. 수락하면 소유자가 된다 */
            INVITED,
            /** 회사가 운영 중이 아니라 초대를 낼 수 없었다. 담당자 정보만 저장했다 */
            DEFERRED
        }

        public static ContactChange none() {
            return new ContactChange(Type.NONE, null, null, null, 0);
        }

        public static ContactChange promoted(String email, int demotedOwners) {
            return new ContactChange(Type.PROMOTED, email, null, null, demotedOwners);
        }

        public static ContactChange invited(String email, InvitationIssuedResponse issued) {
            return new ContactChange(Type.INVITED, email, issued.link(), issued.invitation(), 0);
        }

        public static ContactChange deferred(String email) {
            return new ContactChange(Type.DEFERRED, email, null, null, 0);
        }
    }
}
