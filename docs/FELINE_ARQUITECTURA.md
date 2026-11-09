# FELINE ERP · arquitectura

Fastify sirve dos superficies. El dashboard de demostración usa el almacén en memoria. El panel /finanzas accede a servicios persistentes con sesión y membresía por empresa. La API v1 documental usa clientes de integración, el orquestador, el vault, el despachador y webhooks. Los servicios financieros usan Prisma y PostgreSQL.

## Modelos Prisma

- `Tenant`
- `AccountAccount`
- `CertificadoDigital`
- `ClienteReceptor`
- `L10nLatamDocumentType`
- `AccountJournal`
- `AccountTax`
- `AccountMove`
- `AccountMoveLine`
- `L10nClAccountReference`
- `AccountPayment`
- `CafFolio`
- `DocumentoDTE`
- `EnvioDteLote`
- `ApiClient`
- `ApiIdempotencia`
- `WebhookEvento`
- `FolioSinUso`
- `FinanceUser`
- `FinanceMembership`
- `FinanceSession`
- `FinancePeriod`
- `FinanceEntry`
- `FinanceEntryLine`
- `FinanceAuditEvent`
- `FinanceConfiguration`
- `FinancePostingJob`
- `FinanceReceivable`
- `FinanceReceipt`
- `FinanceReceiptReversal`
- `FinanceCreditAllocation`
- `FinanceCreditAllocationReversal`
- `FinanceVendor`
- `FinancePurchaseOrder`
- `FinancePurchaseOrderItem`
- `FinancePayable`
- `FinanceVendorPayment`
- `FinanceVendorPaymentReversal`
- `FinanceVendorCreditAllocation`
- `FinanceVendorCreditAllocationReversal`
- `FinanceCashBox`
- `FinanceCashShift`
- `FinanceDirectMovement`
- `FinanceDirectMovementReversal`
- `FinanceInternalTransfer`
- `FinancePaymentRequest`
- `FinanceBankAccount`
- `FinanceBankStatement`
- `FinanceBankStatementLine`
- `FinanceBankReconciliation`
- `FinanceBankReconciliationReversal`
- `FinanceBankRule`
- `FinanceCostCenter`
- `FinanceCustomAccount`
- `FinanceFiscalYear`
- `FinanceReceivedDte`
- `FinanceTaxF29Declaration`
- `FinanceBudget`
- `FinanceBudgetItem`
- `FinanceFixedAsset`
- `FinancePayrollEmployee`
- `FinancePayrollSlip`
- `FinanceFeeReceipt`
- `FinanceCurrencyRate`
- `FinanceTaxSetting`

## Rutas declaradas estáticamente

Las rutas están agrupadas por archivo. Los prefijos registrados por plugins se resuelven en Fastify.

### src/api/v1/documentos.routes.ts

- `GET /v1/openapi.json`
- `GET /empresa`
- `POST /webhooks/prueba`
- `POST /documentos`
- `GET /documentos`
- `GET /documentos/:id`
- `GET /documentos/:id/pdf`
- `GET /documentos/:id/xml`

### src/auth/panel-auth.ts

- `POST /api/v1/panel/login`
- `GET /api/v1/panel/acceso-desarrollo`
- `POST /api/v1/panel/logout`
- `GET /api/v1/panel/sesion`
- `POST /api/v1/panel/clave`

### src/finance/accounting.routes.ts

- `GET /dashboard/overview`
- `GET /chart-of-accounts`
- `POST /custom-accounts`
- `PUT /custom-accounts/:id`
- `GET /cost-centers`
- `POST /cost-centers`
- `DELETE /cost-centers/:id`
- `GET /general-ledger`
- `POST /opening-entry`
- `POST /fiscal-years/:year/close`
- `GET /reports/balance-general`
- `GET /reports/estado-resultados`
- `GET /reports/balance-ocho-columnas`

### src/finance/admin-audit-currency.routes.ts

- `GET /audit/logs`
- `GET /tax-settings`
- `PUT /tax-settings`
- `GET /currency-rates`
- `POST /currency-rates`
- `GET /users/memberships`
- `PATCH /users/:userId/role`

### src/finance/banking.routes.ts

- `GET /bank-accounts`
- `POST /bank-accounts`
- `PUT /bank-accounts/:id`
- `POST /bank-statements/import`
- `GET /bank-accounts/:id/lines`
- `GET /bank-lines/:id/candidates`
- `POST /bank-reconciliations/manual`
- `POST /bank-reconciliations/adjustment`
- `POST /bank-lines/:id/unidentified`
- `POST /bank-reconciliations/:id/undo`
- `GET /bank-rules`
- `POST /bank-rules`
- `PUT /bank-rules/:id`
- `DELETE /bank-rules/:id`
- `POST /bank-accounts/:id/apply-rules`

### src/finance/budgets-assets-payroll.routes.ts

- `GET /budgets`
- `POST /budgets`
- `POST /budgets/:id/approve`
- `GET /budgets/:id/execution`
- `GET /fixed-assets`
- `POST /fixed-assets`
- `POST /fixed-assets/depreciate`
- `GET /payroll/employees`
- `POST /payroll/employees`
- `GET /payroll/slips`
- `POST /payroll/slips/generate`
- `GET /fee-receipts`
- `POST /fee-receipts`

### src/finance/payables.routes.ts

- `GET /vendors`
- `POST /vendors`
- `PUT /vendors/:id`
- `GET /vendors/:id/statement`
- `GET /purchase-orders`
- `POST /purchase-orders`
- `PATCH /purchase-orders/:id/status`
- `GET /payables`
- `POST /payables`
- `POST /payables/:id/schedule`
- `POST /payables/:id/approve`
- `POST /payables/:id/pay`
- `POST /payables/advance-pay`
- `POST /vendor-payments/:id/reverse`
- `POST /payables/allocate-credit`

### src/finance/receivables.routes.ts

- `GET /customers`
- `POST /customers`
- `PUT /customers/:id`
- `GET /receivables`
- `GET /receivables/:id`
- `POST /receivables/:id/receipts`
- `POST /receipts/:id/reverse`
- `POST /credit-allocations`
- `POST /credit-allocations/:id/reverse`

### src/finance/routes.ts

- `GET /setup-state`
- `POST /setup`
- `POST /login`
- `GET /session`
- `POST /logout`
- `GET /accounts`
- `GET /periods`
- `POST /periods`
- `POST /periods/:month/close`
- `GET /entries`
- `POST /entries`
- `POST /entries/:id/reverse`
- `GET /report`
- `GET /centralization`
- `POST /centralization/:id`
- `PUT /centralization/configuration`
- `GET /audit`

### src/finance/tax-dte.routes.ts

- `GET /tax/received-dtes`
- `POST /tax/received-dtes`
- `POST /tax/received-dtes/:id/respond`
- `POST /tax/received-dtes/:id/convert-to-payable`
- `GET /tax/f29/calculate`
- `POST /tax/f29/declare`
- `POST /dte/issue-extended`

### src/finance/treasury.routes.ts

- `GET /cash-boxes`
- `POST /cash-boxes`
- `PUT /cash-boxes/:id`
- `POST /cash-boxes/shifts/open`
- `POST /cash-boxes/shifts/:id/close`
- `GET /treasury/direct-movements`
- `POST /treasury/direct-movements`
- `POST /treasury/direct-movements/:id/reverse`
- `GET /treasury/transfers`
- `POST /treasury/transfers`
- `GET /treasury/payment-requests`
- `POST /treasury/payment-requests`
- `POST /treasury/payment-requests/:id/approve`
- `POST /treasury/payment-requests/:id/reject`
- `GET /treasury/liquidity-projection`

### src/server.ts

- `GET /`
- `GET /finanzas`
- `GET /dashboard`
- `GET /rocas`
- `GET /feline`
- `GET /api/v1/status`
- `GET /api/v1/dashboard/state`
- `POST /api/v1/dashboard/tenants`
- `POST /api/v1/dashboard/users`
- `PUT /api/v1/dashboard/users/:userId`
- `DELETE /api/v1/dashboard/users/:userId`
- `POST /api/v1/dashboard/accounting/entries`
- `POST /api/v1/dashboard/certificates/upload`
- `POST /api/v1/dashboard/purchases`
- `POST /api/v1/dashboard/moves`
- `POST /api/v1/dashboard/moves/:moveId/post`
- `POST /api/v1/dashboard/moves/:moveId/reverse`
- `POST /api/v1/dashboard/moves/:moveId/payment`
- `POST /api/v1/dashboard/sii/send-batch`
- `POST /api/v1/dashboard/cafs/generate`
- `POST /api/v1/dashboard/expenses`
- `POST /api/v1/dashboard/expense-sheets`
- `POST /api/v1/dashboard/expense-sheets/:sheetId/submit`
- `POST /api/v1/dashboard/expense-sheets/:sheetId/approve`
- `POST /api/v1/dashboard/expense-sheets/:sheetId/post`
- `POST /api/v1/dashboard/expense-sheets/:sheetId/pay`
- `POST /api/v1/dashboard/expense-sheets/:sheetId/refuse`
- `POST /api/v1/tenants`
- `GET /api/v1/odoo/document-types`

