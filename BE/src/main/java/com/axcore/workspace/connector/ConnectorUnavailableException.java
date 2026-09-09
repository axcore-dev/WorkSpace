package com.axcore.workspace.connector;

/** 토큰 키가 없거나 제공자 자격증명이 없다. 503. 사용자 잘못이 아니라 배포 설정 문제다. */
public class ConnectorUnavailableException extends RuntimeException {
    public ConnectorUnavailableException(String message) {
        super(message);
    }
}
