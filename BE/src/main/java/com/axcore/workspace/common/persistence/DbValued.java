package com.axcore.workspace.common.persistence;

/**
 * DB 에 저장되는 문자열 값을 자바 이름과 따로 갖는 열거형.
 *
 * <p>스키마의 CHECK 제약이 소문자 스네이크(`email_verification`)로 적혀 있는데 자바 열거형 상수는
 * 대문자다. {@code @Enumerated(STRING)} 은 상수 이름을 그대로 쓰므로 둘이 어긋난다. 제약을
 * 대문자로 바꾸는 대신 이 인터페이스를 두는 이유는, V2 가 이미 소문자로 여러 테이블을 만들어
 * 두었고 DB 쪽 표기가 섞이는 편이 더 나쁘기 때문이다.
 */
public interface DbValued {

    /** DB 에 저장되는 문자열. CHECK 제약에 적힌 값과 정확히 같아야 한다. */
    String dbValue();
}
