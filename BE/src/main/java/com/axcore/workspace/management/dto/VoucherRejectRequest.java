package com.axcore.workspace.management.dto;

import jakarta.validation.constraints.Size;

public record VoucherRejectRequest(@Size(max = 200) String reason) {}
