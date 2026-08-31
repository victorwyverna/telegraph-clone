-- Existing articles deliberately receive no token: their old public edit links
-- stop working instead of creating a predictable secret from existing data.
ALTER TABLE "Article" ADD COLUMN "editToken" TEXT;

CREATE UNIQUE INDEX "Article_editToken_key" ON "Article"("editToken");
