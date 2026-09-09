package com.axcore.workspace.connector;

/** 제공자가 실패를 돌려줬다(교환 · 갱신 · API 호출). 502. 원인은 로그에만 남기고 응답에는 담지 않는다. */
public class ConnectorProviderException extends RuntimeException {
    public ConnectorProviderException(String message, Throwable cause) {
        super(message, cause);
    }

    public ConnectorProviderException(String message) {
        super(message);
    }
}
