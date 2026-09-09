package com.axcore.workspace.connector;

/** 이 앱이 연결돼 있지 않거나 토큰을 잃었다. 409 CONNECTOR_NOT_CONNECTED. 화면은 「다시 연결」로 안내한다. */
public class ConnectorNotConnectedException extends RuntimeException {
    public ConnectorNotConnectedException(String message) {
        super(message);
    }
}
