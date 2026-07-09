CREATE OR REPLACE FUNCTION public.create_default_documents()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.case_documents (case_id, doc_type, sort_order) VALUES
    (NEW.id, 'Swift (Bank Transfer)', 1),
    (NEW.id, 'Invoice', 2),
    (NEW.id, 'Packing List', 3),
    (NEW.id, 'Certificate of Origin', 4),
    (NEW.id, 'Shipping Documents', 5),
    (NEW.id, 'البيان الكمركي', 6),
    (NEW.id, 'Exit Permission', 7),
    (NEW.id, 'البيان الكمركي المسبق', 8);
  RETURN NEW;
END;
$function$;

INSERT INTO public.case_documents (case_id, doc_type, sort_order)
SELECT c.id, 'البيان الكمركي المسبق', 8
FROM public.cases c
WHERE NOT EXISTS (
  SELECT 1 FROM public.case_documents d
  WHERE d.case_id = c.id
    AND d.doc_type = 'البيان الكمركي المسبق'
    AND d.is_extra = false
);