import { MetricsHeader } from "./MetricsHeader";
import { Toolbar } from "./Toolbar";
import { CustomersTable } from "./CustomersTable";
import { CustomerFormDialog } from "./CustomerFormDialog";
import { StatementDialog } from "./StatementDialog";
import { PaymentDialog } from "./PaymentDialog";
import { SaleDetailDialog } from "./SaleDetailDialog";
import { DeleteCustomerDialog } from "./DeleteCustomerDialog";
import { Toast } from "./Toast";
import { useCustomersController } from "./useCustomersController";

export function CustomersScreen() {
  const c = useCustomersController();

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-canvas lg:overflow-hidden">
      <MetricsHeader
        totalCustomers={c.metrics.totalCustomers}
        debtorCount={c.metrics.debtorCount}
        totalDebt={c.metrics.totalDebt}
        shift={c.shift}
      />

      <Toolbar
        search={c.search}
        onSearchChange={c.setSearch}
        filter={c.filter}
        onFilterChange={c.setFilter}
        totalCustomers={c.metrics.totalCustomers}
        debtorCount={c.metrics.debtorCount}
        onCreate={c.form.openCreate}
      />

      <CustomersTable
        customers={c.filtered}
        shift={c.canCollect}
        canDelete={c.canDeleteCustomers}
        onOpenStatement={c.statement.openWith}
        onOpenPayment={c.payment.openWith}
        onEdit={c.form.openEdit}
        onAskDelete={c.deleteTarget.ask}
      />

      <CustomerFormDialog
        open={c.form.open}
        mode={c.form.mode}
        data={c.form.data}
        errors={c.form.errors}
        submitError={c.form.submitError}
        saving={c.form.saving}
        onChange={c.form.setData}
        onClearError={c.form.clearError}
        onSave={c.form.save}
        onClose={c.form.close}
      />

      <StatementDialog
        open={c.statement.open}
        customer={c.statement.customer}
        movements={c.statement.movements}
        loading={c.statement.loading}
        paperSize={c.statement.paperSize}
        onPaperSizeChange={c.statement.setPaperSize}
        onClose={c.statement.close}
        onOpenSaleDetail={c.saleDetail.openWith}
      />

      <PaymentDialog
        open={c.payment.open}
        customer={c.payment.customer}
        amount={c.payment.amount}
        method={c.payment.method}
        error={c.payment.error}
        saving={c.payment.saving}
        canConfirm={c.payment.canConfirm}
        onAmountChange={c.payment.setAmount}
        onMethodChange={c.payment.setMethod}
        onConfirm={c.payment.confirm}
        onClose={c.payment.close}
      />

      <SaleDetailDialog
        movement={c.saleDetail.movement}
        items={c.saleDetail.items}
        loading={c.saleDetail.loading}
        onClose={c.saleDetail.close}
      />

      {c.canDeleteCustomers ? (
        <DeleteCustomerDialog
          target={c.deleteTarget.target}
          onCancel={c.deleteTarget.cancel}
          onConfirm={c.deleteTarget.confirm}
        />
      ) : null}

      {c.toast && <Toast toast={c.toast} />}
    </main>
  );
}
