-- AlterTable
ALTER TABLE "MarkAudit" ADD COLUMN     "component" TEXT,
ADD COLUMN     "studentId" TEXT;

-- AlterTable
ALTER TABLE "MarkComponent" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION markaudit_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'MarkAudit is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER markaudit_no_change
BEFORE UPDATE OR DELETE ON "MarkAudit"
FOR EACH ROW EXECUTE FUNCTION markaudit_immutable();