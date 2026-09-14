package com.axcore.workspace.inventory;

import com.axcore.workspace.inventory.dto.AdjustRequest;
import com.axcore.workspace.inventory.dto.CreateOrdersRequest;
import com.axcore.workspace.inventory.dto.DiscontinueRequest;
import com.axcore.workspace.inventory.dto.DocRulesDto;
import com.axcore.workspace.inventory.dto.ItemDto;
import com.axcore.workspace.inventory.dto.ItemStandardDto;
import com.axcore.workspace.inventory.dto.ItemsImportRequest;
import com.axcore.workspace.inventory.dto.MovementDto;
import com.axcore.workspace.inventory.dto.PurchaseOrderDto;
import com.axcore.workspace.inventory.dto.ReceiptRequest;
import com.axcore.workspace.inventory.dto.SafetyStandardDto;
import com.axcore.workspace.inventory.dto.SettingsResponse;
import com.axcore.workspace.inventory.dto.VendorCreateRequest;
import com.axcore.workspace.inventory.dto.VendorDto;
import com.axcore.workspace.security.JwtPrincipal;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 재고·물류. 회사를 고른 토큰(wsid)이어야 하고, 탭 권한과 기능 켜짐은 {@link InventoryAccess} 가 본다 —
 * 읽기는 모듈 단위, 쓰기는 탭 단위다(그 이유는 {@code InventoryAccess} 주석에 있다).
 *
 * <p>경로와 본문은 {@code FE/lib/inventory-api.ts} 가 이미 부르고 있는 그대로다. 쓰기는 본문 없이 204 를
 * 돌려준다 — 화면은 성공 뒤 {@code getAll} 로 전부 다시 받는다(낙관적 갱신 없음).
 */
@RestController
@RequestMapping("/api/workspace/inventory")
public class InventoryController {

    private final InventoryReadService read;
    private final InventoryOrderService orders;
    private final InventoryCatalogService catalog;
    private final InventorySettingsService settings;

    public InventoryController(
            InventoryReadService read,
            InventoryOrderService orders,
            InventoryCatalogService catalog,
            InventorySettingsService settings) {
        this.read = read;
        this.orders = orders;
        this.catalog = catalog;
        this.settings = settings;
    }

    // ---------------------------------------------------------------- 읽기

    @GetMapping("/orders")
    public List<PurchaseOrderDto> orders(@AuthenticationPrincipal Jwt jwt) {
        return read.orders(JwtPrincipal.of(jwt));
    }

    @GetMapping("/movements")
    public List<MovementDto> movements(@AuthenticationPrincipal Jwt jwt) {
        return read.movements(JwtPrincipal.of(jwt));
    }

    @GetMapping("/items")
    public List<ItemDto> items(@AuthenticationPrincipal Jwt jwt) {
        return read.items(JwtPrincipal.of(jwt));
    }

    @GetMapping("/vendors")
    public List<VendorDto> vendors(@AuthenticationPrincipal Jwt jwt) {
        return read.vendors(JwtPrincipal.of(jwt));
    }

    @GetMapping("/settings")
    public SettingsResponse settings(@AuthenticationPrincipal Jwt jwt) {
        return read.settings(JwtPrincipal.of(jwt));
    }

    // ---------------------------------------------------------------- 발주 · 입고

    @PostMapping("/orders")
    public ResponseEntity<Void> createOrders(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateOrdersRequest request) {
        orders.create(JwtPrincipal.of(jwt), request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/orders/{poNo}/receipts")
    public ResponseEntity<Void> receive(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String poNo, @Valid @RequestBody ReceiptRequest request) {
        orders.receive(JwtPrincipal.of(jwt), poNo, request);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- 재고

    @PostMapping("/adjustments")
    public ResponseEntity<Void> adjust(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody AdjustRequest request) {
        settings.adjust(JwtPrincipal.of(jwt), request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/items/{code}/standard")
    public ResponseEntity<Void> setStandard(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String code, @Valid @RequestBody ItemStandardDto request) {
        settings.setStandard(JwtPrincipal.of(jwt), code, request);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- 품목

    @PutMapping("/items/{code}")
    public ResponseEntity<Void> upsertItem(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String code, @Valid @RequestBody ItemDto item) {
        catalog.upsertItem(JwtPrincipal.of(jwt), code, item);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/items/{code}/discontinued")
    public ResponseEntity<Void> discontinue(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String code, @RequestBody DiscontinueRequest request) {
        catalog.setDiscontinued(JwtPrincipal.of(jwt), code, request.discontinued());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/items/{code}")
    public ResponseEntity<Void> deleteItem(@AuthenticationPrincipal Jwt jwt, @PathVariable String code) {
        catalog.deleteItem(JwtPrincipal.of(jwt), code);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/items/import")
    public ResponseEntity<Void> importItems(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ItemsImportRequest request) {
        catalog.importItems(JwtPrincipal.of(jwt), request.items());
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- 거래처

    @PutMapping("/vendors/{id}")
    public ResponseEntity<Void> upsertVendor(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody VendorDto vendor) {
        catalog.upsertVendor(JwtPrincipal.of(jwt), id, vendor);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/vendors")
    public ResponseEntity<Void> createVendor(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody VendorCreateRequest request) {
        catalog.createVendorInline(JwtPrincipal.of(jwt), request.name());
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- 기준

    @PutMapping("/settings/standard")
    public ResponseEntity<Void> setSafetyStandard(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SafetyStandardDto request) {
        settings.setSafetyStandard(JwtPrincipal.of(jwt), request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/settings/doc-rules")
    public ResponseEntity<Void> setDocRules(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DocRulesDto request) {
        settings.setDocRules(JwtPrincipal.of(jwt), request);
        return ResponseEntity.noContent().build();
    }
}
