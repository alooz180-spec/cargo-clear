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
    (NEW.id, 'Exit Permission', 7);
  RETURN NEW;
END;
$function$;