import {
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHelp } from "@/components/help/SectionHelp";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { KardexDialog } from "./KardexDialog";
import { useAuth } from "@/auth/useAuth";
import type { ProductExcelOperation } from "./import/useProductImport";

interface ProductsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onDownloadTemplate: () => void;
  onImportExcel: () => void;
  onExportExcel: () => void;
  excelOperation: ProductExcelOperation;
}

export function ProductsToolbar({
  search,
  onSearchChange,
  onCreate,
  onDownloadTemplate,
  onImportExcel,
  onExportExcel,
  excelOperation,
}: ProductsToolbarProps) {
  const { isAdmin } = useAuth();
  return (
    <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-3 border-b border-border p-3 sm:p-4">
      <InputGroup className="min-w-0 basis-full flex-1 xl:basis-64">
        <InputGroupInput
          id="products-search"
          aria-label="Buscar productos"
          placeholder="Buscar por SKU, nombre, catálogo o marca..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
      </InputGroup>

      <div className="grid w-full min-w-0 grid-cols-2 gap-2 [&_[data-slot=button]]:h-auto [&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:min-w-0 [&_[data-slot=button]]:whitespace-normal sm:flex sm:flex-wrap sm:items-center xl:w-auto">
        <SectionHelp topic="products" />
        <KardexDialog />
        {isAdmin ? (
          <>
            <Button
              variant="outline"
              onClick={onDownloadTemplate}
              disabled={excelOperation !== null}
            >
              {excelOperation === "download" ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <Download data-icon="inline-start" />
              )}
              {excelOperation === "download"
                ? "Descargando..."
                : "Descargar plantilla"}
            </Button>
            <Button
              variant="outline"
              onClick={onImportExcel}
              disabled={excelOperation !== null}
            >
              {excelOperation === "preview" ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <FileSpreadsheet data-icon="inline-start" />
              )}
              {excelOperation === "preview"
                ? "Leyendo archivo..."
                : "Importar Excel"}
            </Button>
            <Button
              variant="outline"
              onClick={onExportExcel}
              disabled={excelOperation !== null}
            >
              {excelOperation === "export" ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <FileSpreadsheet data-icon="inline-start" />
              )}
              {excelOperation === "export" ? "Exportando..." : "Exportar Excel"}
            </Button>
          </>
        ) : null}
        {isAdmin ? (
          <Button onClick={onCreate} disabled={excelOperation !== null}>
            <Plus data-icon="inline-start" />
            Nuevo Producto
          </Button>
        ) : null}
      </div>
    </div>
  );
}
