ALTER TABLE "FinanceEntry" ADD COLUMN "createdTransaction" TEXT NOT NULL DEFAULT (txid_current())::text;

CREATE FUNCTION finance_guard_line_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original_tx text;
BEGIN
  SELECT "createdTransaction" INTO original_tx FROM "FinanceEntry" WHERE id=NEW."entryId";
  IF original_tx IS DISTINCT FROM txid_current()::text THEN
    RAISE EXCEPTION 'No se pueden agregar líneas a un asiento ya publicado';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_line_insert_guard BEFORE INSERT ON "FinanceEntryLine" FOR EACH ROW EXECUTE FUNCTION finance_guard_line_insert();
