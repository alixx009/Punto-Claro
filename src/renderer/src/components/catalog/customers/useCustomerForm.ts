import { useCallback, useRef, useState } from "react";
import type { CustomerWithBalance } from "../../../../../shared/ipc";
import { addCustomer, updateCustomer } from "@/data/customersStore";
import {
  emptyCustomerForm,
  type CustomerFormData,
  type CustomerFormErrors,
} from "./constants";
import { nextCustomerCode, validateCustomerForm } from "./helpers";

export function useCustomerForm(customers: CustomerWithBalance[]) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"crear" | "editar">("crear");
  const [data, setData] = useState<CustomerFormData>(emptyCustomerForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [errors, setErrors] = useState<CustomerFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const change = useCallback((next: CustomerFormData) => {
    setData(next);
    setSubmitError(null);
  }, []);

  const clearError = useCallback((field: keyof CustomerFormData) => {
    setErrors((previous) =>
      previous[field] ? { ...previous, [field]: undefined } : previous,
    );
  }, []);

  const openCreate = useCallback(() => {
    setMode("crear");
    setEditingId(null);
    setData({ ...emptyCustomerForm, code: nextCustomerCode(customers) });
    setErrors({});
    setSubmitError(null);
    setOpen(true);
  }, [customers]);

  const openEdit = useCallback((customer: CustomerWithBalance) => {
    setMode("editar");
    setEditingId(customer.id);
    setData({
      code: customer.code,
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
    });
    setErrors({});
    setSubmitError(null);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    if (savingRef.current) return;
    setOpen(false);
    setErrors({});
    setSubmitError(null);
  }, []);

  const save = useCallback(async () => {
    if (savingRef.current) return;
    const validation = validateCustomerForm(data);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    savingRef.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      const input = {
        code: data.code.trim(),
        name: data.name.trim(),
        phone: data.phone.trim() || null,
        email: data.email.trim() || null,
      };
      if (editingId !== null) {
        const updated = await updateCustomer(editingId, input);
        if (!updated) throw new Error("El cliente ya no está disponible.");
      } else {
        await addCustomer(input);
      }
      setOpen(false);
      setErrors({});
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo guardar el cliente.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [data, editingId]);

  return {
    open,
    mode,
    data,
    errors,
    submitError,
    saving,
    setData: change,
    clearError,
    openCreate,
    openEdit,
    close,
    save,
  };
}
