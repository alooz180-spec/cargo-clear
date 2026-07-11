CREATE OR REPLACE FUNCTION public.create_default_documents()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.case_documents (case_id, doc_type, sort_order) VALUES
    (NEW.id, 'Swift (Bank Transfer)', 1),
    (NEW.id, 'البيان الكمركي المسبق', 2),
    (NEW.id, 'Invoice', 3),
    (NEW.id, 'Packing List', 4),
    (NEW.id, 'Certificate of Origin', 5),
    (NEW.id, 'Shipping Documents', 6),
    (NEW.id, 'البيان الكمركي', 7),
    (NEW.id, 'Exit Permission', 8);
  RETURN NEW;
END;
$function$;

-- Reorder existing default documents (and any copies of them) to match the new manifest order.
-- Custom extra documents with non-standard names are left untouched.
UPDATE public.case_documents
SET sort_order = CASE doc_type
  WHEN 'Swift (Bank Transfer)' THEN 1
  WHEN 'البيان الكمركي المسبق' THEN 2
  WHEN 'Invoice' THEN 3
  WHEN 'Packing List' THEN 4
  WHEN 'Certificate of Origin' THEN 5
  WHEN 'Shipping Documents' THEN 6
  WHEN 'البيان الكمركي' THEN 7
  WHEN 'Exit Permission' THEN 8
  ELSE sort_order
END
WHERE doc_type IN (
  'Swift (Bank Transfer)',
  'البيان الكمركي المسبق',
  'Invoice',
  'Packing List',
  'Certificate of Origin',
  'Shipping Documents',
  'البيان الكمركي',
  'Exit Permission'
);