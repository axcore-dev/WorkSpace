package com.axcore.workspace.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/** {@code POST /items/import} — 엑셀 업로드. 갱신과 신규를 한 번에 받는다(오류 행은 화면이 이미 뺐다). */
public record ItemsImportRequest(@NotEmpty @Valid List<ItemDto> items) {}
