-- Cases table
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  ref text NOT NULL DEFAULT '',
  company text NOT NULL,
  bank text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'in_progress',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cases" ON public.cases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cases" ON public.cases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cases" ON public.cases FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cases" ON public.cases FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Case documents table
CREATE TABLE public.case_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  file_name text,
  file_path text,
  verified boolean NOT NULL DEFAULT false,
  is_extra boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_documents TO authenticated;
GRANT ALL ON public.case_documents TO service_role;

ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own case documents" ON public.case_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.user_id = auth.uid()));
CREATE POLICY "Users can insert own case documents" ON public.case_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.user_id = auth.uid()));
CREATE POLICY "Users can update own case documents" ON public.case_documents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.user_id = auth.uid()));
CREATE POLICY "Users can delete own case documents" ON public.case_documents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.user_id = auth.uid()));

CREATE INDEX idx_case_documents_case_id ON public.case_documents(case_id);

-- Auto-generate case ref: TT-{year}-{zero-padded sequence per user per year}
CREATE OR REPLACE FUNCTION public.generate_case_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr int;
  seq int;
BEGIN
  IF NEW.ref IS NULL OR NEW.ref = '' THEN
    yr := EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int;
    SELECT COALESCE(MAX((split_part(ref, '-', 3))::int), 0) + 1 INTO seq
    FROM public.cases
    WHERE user_id = NEW.user_id AND ref LIKE 'TT-' || yr || '-%';
    NEW.ref := 'TT-' || yr || '-' || lpad(seq::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_case_ref
BEFORE INSERT ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.generate_case_ref();

-- Auto-create the 7 standard document rows for every new case
CREATE OR REPLACE FUNCTION public.create_default_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.case_documents (case_id, doc_type, sort_order) VALUES
    (NEW.id, 'Swift (Bank Transfer)', 1),
    (NEW.id, 'Invoice', 2),
    (NEW.id, 'Packing List', 3),
    (NEW.id, 'Certificate of Origin', 4),
    (NEW.id, 'Shipping Documents', 5),
    (NEW.id, 'Board Document', 6),
    (NEW.id, 'Exit Permission', 7);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_documents
AFTER INSERT ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.create_default_documents();