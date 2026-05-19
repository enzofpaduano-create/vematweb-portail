-- =============================================================================
-- Vemat — Migration de durcissement RLS
-- =============================================================================
-- Idempotent : peut être réexécuté sans casser l'existant.
-- À tester sur projet Supabase de staging avant prod.
--
-- Hypothèses sur le schéma `profiles` :
--   - `profiles.id` = `auth.users.id`
--   - `profiles.role` ∈ ('client', 'vemat_admin', 'vemat_dg', ...)
--
-- Pour les rôles `commercial` et `technicien`, l'appartenance se vérifie
-- via les tables `commercials` et `technicians` (colonne `user_id`).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 : helpers de rôle (SECURITY DEFINER pour bypasser RLS)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'vemat_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_dg()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'vemat_dg'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_commercial_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM commercials WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_commercial()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_commercial_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.current_technician_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM technicians WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_technician()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_technician_id() IS NOT NULL;
$$;

-- Liste centrale des catégories considérées comme "machines".
-- ⚠️ Si tu modifies cette liste, modifie aussi src/lib/constants.ts (MACHINE_CATEGORIES).
CREATE OR REPLACE FUNCTION public.is_machine_category(category text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT category IN (
    'Grues',
    'Nacelles & plateformes élévatrices',
    'Élévateurs télescopiques',
    'Matériaux de construction'
  );
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 : table `commercials` (manquante dans SETUP_SUPABASE.sql)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.commercials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name        text NOT NULL,
  title       text,
  phone       text,
  email       text,
  color       text DEFAULT '#6366f1',
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.commercials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commercials_read_authenticated"    ON public.commercials;
DROP POLICY IF EXISTS "commercials_write_admin_only"      ON public.commercials;

-- Tous les rôles internes peuvent lister les commerciaux (annuaire).
CREATE POLICY "commercials_read_authenticated"
  ON public.commercials FOR SELECT TO authenticated
  USING (is_admin() OR is_dg() OR is_commercial() OR is_technician());

-- Seul l'admin peut créer/modifier/supprimer un commercial.
CREATE POLICY "commercials_write_admin_only"
  ON public.commercials FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 : `technicians` — chaque tech voit uniquement sa fiche
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.technicians ADD CONSTRAINT technicians_user_id_unique UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_technicians"           ON public.technicians;
DROP POLICY IF EXISTS "admin_manage_technicians"   ON public.technicians;
DROP POLICY IF EXISTS "technicians_read_self_or_admin"   ON public.technicians;
DROP POLICY IF EXISTS "technicians_write_admin"          ON public.technicians;

-- Tech voit sa propre fiche. Admin/DG voient tout (annuaire interne pour assignation).
CREATE POLICY "technicians_read_self_or_admin"
  ON public.technicians FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin() OR is_dg());

-- Seul l'admin peut créer/modifier/supprimer.
CREATE POLICY "technicians_write_admin"
  ON public.technicians FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4 : `form_devis` — INSERT public, SELECT/UPDATE par rôle + catégorie
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.form_devis ENABLE ROW LEVEL SECURITY;

-- Retire les GRANTS trop larges potentiellement laissés par supabase-machine-devis.sql
REVOKE ALL ON public.form_devis FROM authenticated;
REVOKE ALL ON public.form_devis FROM anon;
GRANT INSERT ON public.form_devis TO anon;
GRANT SELECT, INSERT, UPDATE ON public.form_devis TO authenticated;

DROP POLICY IF EXISTS "form_devis_anon_insert"        ON public.form_devis;
DROP POLICY IF EXISTS "form_devis_select_by_role"     ON public.form_devis;
DROP POLICY IF EXISTS "form_devis_update_by_role"     ON public.form_devis;

-- Anonyme : peut créer une demande de devis depuis le site public.
CREATE POLICY "form_devis_anon_insert"
  ON public.form_devis FOR INSERT TO anon
  WITH CHECK (true);

-- Lecture :
--   - DG voit tout
--   - Manager (admin) voit les pièces de rechange (NON-machines)
--   - Commercial voit les machines (et seulement)
--   - Technicien : aucun accès
CREATE POLICY "form_devis_select_by_role"
  ON public.form_devis FOR SELECT TO authenticated
  USING (
    is_dg()
    OR (is_admin()      AND NOT is_machine_category(product_category))
    OR (is_commercial() AND     is_machine_category(product_category))
  );

-- Écriture (mise à jour de statut, conversion) : mêmes règles que la lecture.
CREATE POLICY "form_devis_update_by_role"
  ON public.form_devis FOR UPDATE TO authenticated
  USING (
    is_dg()
    OR (is_admin()      AND NOT is_machine_category(product_category))
    OR (is_commercial() AND     is_machine_category(product_category))
  )
  WITH CHECK (
    is_dg()
    OR (is_admin()      AND NOT is_machine_category(product_category))
    OR (is_commercial() AND     is_machine_category(product_category))
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5 : `form_interventions` — INSERT public, SELECT/UPDATE manager+DG
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.form_interventions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.form_interventions FROM authenticated;
REVOKE ALL ON public.form_interventions FROM anon;
GRANT INSERT ON public.form_interventions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.form_interventions TO authenticated;

DROP POLICY IF EXISTS "form_interventions_anon_insert"   ON public.form_interventions;
DROP POLICY IF EXISTS "form_interventions_select_role"   ON public.form_interventions;
DROP POLICY IF EXISTS "form_interventions_update_role"   ON public.form_interventions;

CREATE POLICY "form_interventions_anon_insert"
  ON public.form_interventions FOR INSERT TO anon
  WITH CHECK (true);

-- Manager + DG lisent et modifient. Commercial / technicien : aucun accès direct
-- (le technicien voit la repair_request une fois la mission assignée).
CREATE POLICY "form_interventions_select_role"
  ON public.form_interventions FOR SELECT TO authenticated
  USING (is_admin() OR is_dg());

CREATE POLICY "form_interventions_update_role"
  ON public.form_interventions FOR UPDATE TO authenticated
  USING (is_admin() OR is_dg())
  WITH CHECK (is_admin() OR is_dg());


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6 : tables commerciales — chaque commercial voit les SIENS
--             le DG voit tout ET peut créer pour n'importe quel commercial
-- ─────────────────────────────────────────────────────────────────────────────

-- 6.1 commercial_sales : ventes
ALTER TABLE public.commercial_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read commercial_sales"   ON public.commercial_sales;
DROP POLICY IF EXISTS "authenticated can insert commercial_sales" ON public.commercial_sales;
DROP POLICY IF EXISTS "authenticated can update commercial_sales" ON public.commercial_sales;
DROP POLICY IF EXISTS "authenticated can delete commercial_sales" ON public.commercial_sales;
DROP POLICY IF EXISTS "commercial_sales_select"  ON public.commercial_sales;
DROP POLICY IF EXISTS "commercial_sales_insert"  ON public.commercial_sales;
DROP POLICY IF EXISTS "commercial_sales_update"  ON public.commercial_sales;
DROP POLICY IF EXISTS "commercial_sales_delete"  ON public.commercial_sales;

CREATE POLICY "commercial_sales_select" ON public.commercial_sales
  FOR SELECT TO authenticated
  USING (is_dg() OR commercial_id = current_commercial_id());

CREATE POLICY "commercial_sales_insert" ON public.commercial_sales
  FOR INSERT TO authenticated
  WITH CHECK (is_dg() OR commercial_id = current_commercial_id());

CREATE POLICY "commercial_sales_update" ON public.commercial_sales
  FOR UPDATE TO authenticated
  USING (is_dg() OR commercial_id = current_commercial_id())
  WITH CHECK (is_dg() OR commercial_id = current_commercial_id());

CREATE POLICY "commercial_sales_delete" ON public.commercial_sales
  FOR DELETE TO authenticated
  USING (is_dg() OR commercial_id = current_commercial_id());


-- 6.2 commercial_meeting_reports : rapports de réunion
ALTER TABLE public.commercial_meeting_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read commercial_meeting_reports"   ON public.commercial_meeting_reports;
DROP POLICY IF EXISTS "authenticated can insert commercial_meeting_reports" ON public.commercial_meeting_reports;
DROP POLICY IF EXISTS "authenticated can update commercial_meeting_reports" ON public.commercial_meeting_reports;
DROP POLICY IF EXISTS "authenticated can delete commercial_meeting_reports" ON public.commercial_meeting_reports;
DROP POLICY IF EXISTS "commercial_meeting_reports_select" ON public.commercial_meeting_reports;
DROP POLICY IF EXISTS "commercial_meeting_reports_insert" ON public.commercial_meeting_reports;
DROP POLICY IF EXISTS "commercial_meeting_reports_update" ON public.commercial_meeting_reports;
DROP POLICY IF EXISTS "commercial_meeting_reports_delete" ON public.commercial_meeting_reports;

CREATE POLICY "commercial_meeting_reports_select" ON public.commercial_meeting_reports
  FOR SELECT TO authenticated
  USING (is_dg() OR commercial_id = current_commercial_id());

CREATE POLICY "commercial_meeting_reports_insert" ON public.commercial_meeting_reports
  FOR INSERT TO authenticated
  WITH CHECK (is_dg() OR commercial_id = current_commercial_id());

CREATE POLICY "commercial_meeting_reports_update" ON public.commercial_meeting_reports
  FOR UPDATE TO authenticated
  USING (is_dg() OR commercial_id = current_commercial_id())
  WITH CHECK (is_dg() OR commercial_id = current_commercial_id());

CREATE POLICY "commercial_meeting_reports_delete" ON public.commercial_meeting_reports
  FOR DELETE TO authenticated
  USING (is_dg() OR commercial_id = current_commercial_id());


-- 6.3 commercial_events : agenda + DG peut imposer un événement à un commercial
ALTER TABLE public.commercial_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read commercial_events"   ON public.commercial_events;
DROP POLICY IF EXISTS "authenticated can insert commercial_events" ON public.commercial_events;
DROP POLICY IF EXISTS "authenticated can update commercial_events" ON public.commercial_events;
DROP POLICY IF EXISTS "authenticated can delete commercial_events" ON public.commercial_events;
DROP POLICY IF EXISTS "commercial_events_select" ON public.commercial_events;
DROP POLICY IF EXISTS "commercial_events_insert" ON public.commercial_events;
DROP POLICY IF EXISTS "commercial_events_update" ON public.commercial_events;
DROP POLICY IF EXISTS "commercial_events_delete" ON public.commercial_events;

-- SELECT : commercial voit son agenda. DG voit tout.
CREATE POLICY "commercial_events_select" ON public.commercial_events
  FOR SELECT TO authenticated
  USING (is_dg() OR commercial_id = current_commercial_id());

-- INSERT : un commercial pose un événement sur SON agenda. Le DG peut poser
-- un événement sur n'importe quel agenda commercial (cas : réunion imposée).
CREATE POLICY "commercial_events_insert" ON public.commercial_events
  FOR INSERT TO authenticated
  WITH CHECK (is_dg() OR commercial_id = current_commercial_id());

-- UPDATE / DELETE : DG = tout. Commercial = ses propres événements.
-- (Si DG a posé un événement, le commercial peut le modifier sur son agenda.)
CREATE POLICY "commercial_events_update" ON public.commercial_events
  FOR UPDATE TO authenticated
  USING (is_dg() OR commercial_id = current_commercial_id())
  WITH CHECK (is_dg() OR commercial_id = current_commercial_id());

CREATE POLICY "commercial_events_delete" ON public.commercial_events
  FOR DELETE TO authenticated
  USING (is_dg() OR commercial_id = current_commercial_id());


-- 6.4 commercial_targets : cibles fixées par le DG
ALTER TABLE public.commercial_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dg can manage targets"          ON public.commercial_targets;
DROP POLICY IF EXISTS "authenticated can read targets" ON public.commercial_targets;
DROP POLICY IF EXISTS "commercial_targets_select"      ON public.commercial_targets;
DROP POLICY IF EXISTS "commercial_targets_write_dg"    ON public.commercial_targets;

-- Le commercial voit sa propre cible. Le DG voit/modifie tout.
CREATE POLICY "commercial_targets_select" ON public.commercial_targets
  FOR SELECT TO authenticated
  USING (is_dg() OR commercial_id = current_commercial_id());

CREATE POLICY "commercial_targets_write_dg" ON public.commercial_targets
  FOR ALL TO authenticated
  USING (is_dg())
  WITH CHECK (is_dg());


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7 : Storage — bucket `quotes` privatisé
-- ─────────────────────────────────────────────────────────────────────────────
-- Pour les emails clients, l'app devra générer une URL signée à l'envoi
-- (`supabase.storage.from('quotes').createSignedUrl(path, expiresIn)`).
-- Les écrans admin/DG/manager peuvent toujours lire en passant par
-- `createSignedUrl` ou via le SDK authentifié.

UPDATE storage.buckets SET public = false WHERE id = 'quotes';

DROP POLICY IF EXISTS "public read quotes"        ON storage.objects;
DROP POLICY IF EXISTS "auth users can read quotes" ON storage.objects;
DROP POLICY IF EXISTS "auth users can upload quotes" ON storage.objects;
DROP POLICY IF EXISTS "quotes_select_internal"    ON storage.objects;
DROP POLICY IF EXISTS "quotes_insert_internal"    ON storage.objects;
DROP POLICY IF EXISTS "quotes_delete_internal"    ON storage.objects;

CREATE POLICY "quotes_select_internal"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'quotes' AND (is_admin() OR is_dg()));

CREATE POLICY "quotes_insert_internal"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quotes' AND (is_admin() OR is_dg()));

CREATE POLICY "quotes_delete_internal"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'quotes' AND (is_admin() OR is_dg()));


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8 : Storage — bucket `repair-photos` (à créer + sécuriser)
-- ─────────────────────────────────────────────────────────────────────────────
-- Convention de path : `<repair_request_id>/<filename>`. Le 1er segment du
-- path est l'UUID de la repair_request, ce qui permet de filtrer par mission.

INSERT INTO storage.buckets (id, name, public)
VALUES ('repair-photos', 'repair-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "repair_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "repair_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "repair_photos_delete" ON storage.objects;

-- Lecture : technicien assigné à la mission + admin + DG.
CREATE POLICY "repair_photos_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'repair-photos' AND (
      is_admin() OR is_dg()
      OR (
        is_technician()
        AND ((storage.foldername(name))[1])::uuid IN (
          SELECT id FROM repair_requests WHERE technician_id = current_technician_id()
        )
      )
    )
  );

-- Écriture : technicien sur ses propres missions + admin + DG.
CREATE POLICY "repair_photos_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'repair-photos' AND (
      is_admin() OR is_dg()
      OR (
        is_technician()
        AND ((storage.foldername(name))[1])::uuid IN (
          SELECT id FROM repair_requests WHERE technician_id = current_technician_id()
        )
      )
    )
  );

-- Suppression : admin/DG seulement (le tech ne supprime pas ses preuves).
CREATE POLICY "repair_photos_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'repair-photos' AND (is_admin() OR is_dg()));


-- ─────────────────────────────────────────────────────────────────────────────
-- FIN — vérifications
-- ─────────────────────────────────────────────────────────────────────────────
-- Pour vérifier l'état des RLS après exécution :
--
--   SELECT schemaname, tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
--
--   SELECT tablename, policyname, cmd, roles
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, cmd;
-- =============================================================================
