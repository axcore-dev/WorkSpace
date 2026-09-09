package com.axcore.workspace.connector;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** {@link ConnectorProperties} 를 바인딩한다. {@code MailConfig} 와 같은 모양이다. */
@Configuration
@EnableConfigurationProperties(ConnectorProperties.class)
public class ConnectorConfig {}
