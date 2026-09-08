package com.axcore.workspace.storage;

/** 오브젝트 스토리지 설정이 없거나 스토리지가 응답하지 않는다. 503 으로 나간다. */
public class StorageUnavailableException extends RuntimeException {

    public StorageUnavailableException(String message) {
        super(message);
    }

    public StorageUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
