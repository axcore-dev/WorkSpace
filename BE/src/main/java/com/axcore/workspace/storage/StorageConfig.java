package com.axcore.workspace.storage;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** {@link StorageProperties} 를 바인딩한다. {@code MailConfig} 와 같은 모양이다. */
@Configuration
@EnableConfigurationProperties(StorageProperties.class)
public class StorageConfig {}
