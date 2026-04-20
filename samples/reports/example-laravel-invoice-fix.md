# AI Dev Bot — project change report

- **Generated**: 2026-04-20T14:22:00.000Z
- **Task**: ACME-1842 — Invoice PDF shows 0€ when stacked percentage discounts apply
- **Project root**: `/path/to/sample-laravel`
- **Detected flavor**: laravel
- **laravel/framework**: ^11.0

## Structural inventory

| Area | Count |
| --- | ---: |
| Route files | 2 |
| Controllers | 1 |
| Models | 1 |
| Migrations | 1 |
| Blade views | 1 |
| Config files | 1 |
| Policies | 0 |
| Middleware | 0 |
| Service providers | 0 |

## Implementation plan

### Laravel implementation plan

#### Task

- **ID**: ACME-1842
- **Title**: Invoice PDF shows 0€ when stacked percentage discounts apply
- **Framework**: ^11.0

#### Acceptance criteria

- **AC-1**: PDF totals match the web invoice view for stacked discounts.
- **AC-2**: Regression test covers two percentage discounts + VAT.

#### Problem statement

Reproduce on staging: create invoice with two percentage discounts. Subtotal is correct in the UI but the generated PDF totals show 0.00 for VAT and total. Suspect rounding or double application in the PDF pipeline.

#### Repository map (detected)

- Routes under `routes/web.php`, `routes/api.php`.
- Primary touch points: `InvoiceController`, `Invoice` model, `invoice.blade.php` PDF view.

#### Suggested touch points (convention-safe)

- **controllers**: `app/Http/Controllers/Billing/InvoiceController.php` — keep HTTP thin; delegate to a dedicated builder/service for PDF amounts.
- **views**: `resources/views/pdf/invoice.blade.php` — avoid recomputing totals differently than the HTML invoice; prefer passing a single DTO/array of resolved line items.
- **models**: `app/Models/Invoice.php` — centralize discount math accessors used by both HTML and PDF paths.

#### Laravel-specific verification

1. `php artisan route:list` — confirm the PDF download route and middleware.
2. `php artisan test` — run the new regression in `tests/Feature`.
3. `php artisan migrate --pretend` — only if schema changes are required (prefer none for a pure calculation bug).

## Command execution

_No commands were executed in this static example. In a real run, stdout/stderr blocks from `route:list`, `test`, and `migrate --pretend` appear here after `--approve-checksum`._
