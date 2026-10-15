import { AlertCircle, Archive, CheckCircle2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SectionHelp } from "@/components/help/SectionHelp";
import { TicketDialog } from "@/components/sales/TicketDialog";
import { SaleNoteDialog } from "./SaleNoteDialog";
import { SalesHistoryFilters } from "./SalesHistoryFilters";
import { SalesHistoryMetrics } from "./SalesHistoryMetrics";
import { SalesHistoryTable } from "./SalesHistoryTable";
import { useSalesHistory } from "./useSalesHistory";
import { useSaleDocuments } from "./useSaleDocuments";
import { useSaleReturns } from "./useSaleReturns";
import { SaleReturnDialog } from "./SaleReturnDialog";

export default function SalesHistoryScreen() {
  const history = useSalesHistory();
  const documents = useSaleDocuments();
  const returns = useSaleReturns(history.refresh);
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Historial de Ventas (Notas de Venta)
            </h1>
            <SectionHelp topic="sales-history" />
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Busca transacciones guardadas, reimprime tickets de compra o emite
            notas de venta formateadas para clientes.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={history.reset}
          disabled={history.loading}
          title="Consultar todo el historial y actualizar los registros"
          className="w-full self-start sm:w-auto"
        >
          <Archive data-icon="inline-start" />
          REGISTRO HISTÓRICO
        </Button>
      </header>
      <SalesHistoryMetrics
        summary={history.result?.summary}
        loading={history.loading}
      />
      {returns.success && (
        <Alert role="status">
          <CheckCircle2 />
          <AlertTitle>Devolución registrada</AlertTitle>
          <AlertDescription>{returns.success}</AlertDescription>
        </Alert>
      )}
      <section
        className="min-w-0 overflow-hidden rounded-xl border bg-card"
        aria-label="Registro de ventas"
      >
        <SalesHistoryFilters
          search={history.search}
          payment={history.payment}
          date={history.date}
          count={history.result?.totalRecords ?? null}
          loading={history.loading}
          onSearch={history.changeSearch}
          onPayment={history.changePayment}
          onDate={history.changeDate}
        />
        {history.error ? (
          <div className="p-5">
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>No se pudo cargar el historial</AlertTitle>
              <AlertDescription>
                {history.error}
                <Button variant="outline" size="sm" onClick={history.refresh}>
                  <RefreshCw data-icon="inline-start" />
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <SalesHistoryTable
            result={history.result}
            loading={history.loading}
            filtered={history.filtered}
            loadingId={documents.loadingId}
            onOpen={(id, format) => {
              void documents.open(id, format);
            }}
            onPage={history.setPage}
            onReset={history.reset}
            onReturn={(row) => {
              documents.close();
              void returns.open(row);
            }}
            returnLoading={returns.loading || returns.submitting}
          />
        )}
      </section>
      {documents.error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>No se pudo abrir el comprobante</AlertTitle>
          <AlertDescription>{documents.error}</AlertDescription>
        </Alert>
      )}
      <TicketDialog
        open={documents.format === "ticket"}
        onOpenChange={(open) => {
          if (!open) documents.close();
        }}
        payload={documents.payload}
        onPrint={() => {
          void documents.print();
        }}
        printing={documents.printing}
        printDisabled={
          documents.payload?.items.length === 0 && !documents.payload.returns
        }
        printFeedback={
          documents.payload?.items.length === 0 && !documents.payload.returns
            ? {
                kind: "error",
                text: "Esta venta histórica no tiene artículos guardados. No se puede imprimir un comprobante incompleto.",
              }
            : documents.feedback
        }
      />
      <SaleNoteDialog
        open={documents.format === "note"}
        payload={documents.payload}
        onClose={documents.close}
        onPrint={() => {
          void documents.print();
        }}
        printing={documents.printing}
        feedback={documents.feedback}
      />
      <SaleReturnDialog returns={returns} />
    </main>
  );
}
