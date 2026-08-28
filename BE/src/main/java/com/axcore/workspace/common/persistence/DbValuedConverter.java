package com.axcore.workspace.common.persistence;

import jakarta.persistence.AttributeConverter;

import java.util.Arrays;

/**
 * {@link DbValued} 열거형 ↔ 문자열 변환의 공통 구현.
 *
 * <p>열거형마다 컨버터를 새로 쓰면 같은 코드가 그대로 복제된다. 하위 클래스는 자기 타입만
 * 알려 주면 된다.
 *
 * <p>읽을 때 모르는 값을 만나면 예외를 던진다. 조용히 null 로 떨어뜨리면 CHECK 제약을 우회해
 * 들어온 값이나 마이그레이션 누락이 화면에서야 드러난다.
 */
public abstract class DbValuedConverter<E extends Enum<E> & DbValued>
        implements AttributeConverter<E, String> {

    private final Class<E> type;

    protected DbValuedConverter(Class<E> type) {
        this.type = type;
    }

    @Override
    public String convertToDatabaseColumn(E attribute) {
        return attribute == null ? null : attribute.dbValue();
    }

    @Override
    public E convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        return Arrays.stream(type.getEnumConstants())
                .filter(constant -> constant.dbValue().equals(dbData))
                .findFirst()
                .orElseThrow(
                        () ->
                                new IllegalStateException(
                                        "%s 에 없는 값이다: %s".formatted(type.getSimpleName(), dbData)));
    }
}
