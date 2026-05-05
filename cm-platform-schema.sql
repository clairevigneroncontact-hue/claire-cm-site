-- ============================================================
-- CM Platform — Migrations Supabase
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- 1. Ajouter le rôle 'cm' (Community Manager plateforme)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'client', 'cm'));

-- 2. Lier chaque client à son CM
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cm_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_cm_id ON profiles(cm_id);

-- 3. Plan/abonnement du CM
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cm_plan text CHECK (cm_plan IN ('solo','pro','unlimited')) DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cm_plan_active boolean DEFAULT false;

-- 4. RLS : les CMs voient uniquement leurs propres clients
-- (désactiver l'ancienne policy select si elle existe)
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
DROP POLICY IF EXISTS "cm_see_own_clients" ON profiles;

CREATE POLICY "select_own_or_managed" ON profiles
  FOR SELECT USING (
    auth.uid() = id                                          -- son propre profil
    OR cm_id = auth.uid()                                   -- clients du CM
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.email = 'clairevigneron.contact@gmail.com'      -- admin Claire voit tout
    )
  );

-- 5. Les CMs peuvent créer des clients (uniquement liés à eux)
DROP POLICY IF EXISTS "cm_create_clients" ON profiles;
CREATE POLICY "cm_create_clients" ON profiles
  FOR INSERT WITH CHECK (
    cm_id = auth.uid() AND role = 'client'
  );

-- 6. Les CMs peuvent modifier les clients qui leur appartiennent
DROP POLICY IF EXISTS "cm_update_clients" ON profiles;
CREATE POLICY "cm_update_clients" ON profiles
  FOR UPDATE USING (
    cm_id = auth.uid() OR auth.uid() = id
  ) WITH CHECK (
    cm_id = auth.uid() OR auth.uid() = id
  );

-- 7. content_items : le CM voit le contenu de ses clients
DROP POLICY IF EXISTS "cm_see_client_content" ON content_items;
CREATE POLICY "cm_see_client_content" ON content_items
  FOR ALL USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = content_items.client_id AND p.cm_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.email = 'clairevigneron.contact@gmail.com'
    )
  );

-- 8. documents : même logique
DROP POLICY IF EXISTS "cm_see_client_docs" ON documents;
CREATE POLICY "cm_see_client_docs" ON documents
  FOR ALL USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = documents.client_id AND p.cm_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.email = 'clairevigneron.contact@gmail.com'
    )
  );

-- Recharger le schéma PostgREST
NOTIFY pgrst, 'reload schema';
