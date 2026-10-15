import type { Supplier, SupplierInput } from "../../shared/suppliers";
import { SUPPLIER_LIMITS } from "../../shared/suppliers";
import { getDb } from "./database";

type SupplierRow = {
  id: number;
  name: string;
  rfc: string | null;
  phone: string | null;
  contact_name: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

class SupplierInputError extends Error {}

const SELECT_COLUMNS = `
  id, name, rfc, phone, contact_name, email, address, created_at, updated_at
`;
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function validateId(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    throw new SupplierInputError(
      "El identificador del proveedor no es válido.",
    );
  return value;
}

function optionalText(
  value: unknown,
  label: string,
  maximum: number,
  multiline = false,
): string | null {
  if (value == null) return null;
  if (typeof value !== "string")
    throw new SupplierInputError(`${label} no es válido.`);
  const text = value.trim();
  if (!text) return null;
  const invalidControl = multiline
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
    : CONTROL_CHARACTERS;
  if (text.length > maximum || invalidControl.test(text))
    throw new SupplierInputError(
      `${label} debe tener un máximo de ${maximum} caracteres y no contener caracteres de control.`,
    );
  return text;
}

function normalizeInput(input: unknown): Required<SupplierInput> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new SupplierInputError("Los datos del proveedor no son válidos.");
  const values = input as Record<string, unknown>;
  const name = optionalText(
    values.name,
    "La empresa o razón social",
    SUPPLIER_LIMITS.name,
  );
  if (!name)
    throw new SupplierInputError(
      "Introduce la empresa o razón social del proveedor.",
    );
  const email = optionalText(values.email, "El correo", SUPPLIER_LIMITS.email);
  if (email && !EMAIL_FORMAT.test(email))
    throw new SupplierInputError(
      "Introduce un correo válido o deja el campo vacío.",
    );
  return {
    name,
    rfc: optionalText(
      typeof values.rfc === "string" ? values.rfc.toUpperCase() : values.rfc,
      "El RFC",
      SUPPLIER_LIMITS.rfc,
    ),
    phone: optionalText(values.phone, "El teléfono", SUPPLIER_LIMITS.phone),
    contactName: optionalText(
      values.contactName,
      "El nombre de contacto",
      SUPPLIER_LIMITS.contactName,
    ),
    email,
    address: optionalText(
      values.address,
      "La dirección",
      SUPPLIER_LIMITS.address,
      true,
    ),
  };
}

function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    rfc: row.rfc,
    phone: row.phone,
    contactName: row.contact_name,
    email: row.email,
    address: row.address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readSupplier(id: number): Supplier {
  const row = getDb()
    .prepare(
      `
    SELECT ${SELECT_COLUMNS} FROM suppliers WHERE id = ? AND deleted_at IS NULL
  `,
    )
    .get(id) as SupplierRow | undefined;
  if (!row)
    throw new SupplierInputError(
      "El proveedor ya no existe en el catálogo. Actualiza la lista.",
    );
  return mapSupplier(row);
}

function safeOperation<T>(message: string, operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof SupplierInputError) throw error;
    console.error("[suppliers]", error);
    throw new Error(message);
  }
}

export function listSuppliers(): Supplier[] {
  return safeOperation("No se pudo cargar el catálogo de proveedores.", () => {
    const rows = getDb()
      .prepare(
        `
      SELECT ${SELECT_COLUMNS} FROM suppliers
      WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE, id
    `,
      )
      .all() as SupplierRow[];
    return rows.map(mapSupplier);
  });
}

export function createSupplier(input: SupplierInput): Supplier {
  const values = normalizeInput(input);
  return safeOperation(
    "No se pudo registrar el proveedor. Inténtalo de nuevo.",
    () =>
      getDb()
        .transaction(() => {
          const result = getDb()
            .prepare(
              `
        INSERT INTO suppliers (name, rfc, phone, contact_name, email, address)
        VALUES (@name, @rfc, @phone, @contactName, @email, @address)
      `,
            )
            .run(values);
          return readSupplier(Number(result.lastInsertRowid));
        })
        .immediate(),
  );
}

export function updateSupplier(id: number, input: SupplierInput): Supplier {
  validateId(id);
  const values = normalizeInput(input);
  return safeOperation(
    "No se pudo actualizar el proveedor. Inténtalo de nuevo.",
    () =>
      getDb()
        .transaction(() => {
          const result = getDb()
            .prepare(
              `
        UPDATE suppliers SET name = @name, rfc = @rfc, phone = @phone,
          contact_name = @contactName, email = @email, address = @address, updated_at = app_now()
        WHERE id = @id AND deleted_at IS NULL
      `,
            )
            .run({ ...values, id });
          if (!result.changes)
            throw new SupplierInputError(
              "El proveedor ya no existe en el catálogo. Actualiza la lista.",
            );
          return readSupplier(id);
        })
        .immediate(),
  );
}

export function deleteSupplier(id: number): boolean {
  validateId(id);
  return safeOperation(
    "No se pudo eliminar el proveedor. Inténtalo de nuevo.",
    () => {
      const result = getDb()
        .prepare(
          `
      UPDATE suppliers SET deleted_at = app_now(), updated_at = app_now()
      WHERE id = ? AND deleted_at IS NULL
    `,
        )
        .run(id);
      return result.changes > 0;
    },
  );
}
