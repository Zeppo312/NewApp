-- Einkaufsliste, Vorräte und Barcode-Produktkatalog.
-- Zugriff je Baby über public.is_baby_member (SECURITY DEFINER, siehe 20270107000002).

CREATE TABLE IF NOT EXISTS public.product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  default_package_quantity NUMERIC(10,2) CHECK (default_package_quantity IS NULL OR default_package_quantity > 0),
  default_unit TEXT,
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual', 'open_food_facts')),
  provider_payload JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  barcode TEXT,
  current_quantity NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
  unit TEXT NOT NULL DEFAULT 'Stück',
  package_quantity NUMERIC(10,2) CHECK (package_quantity IS NULL OR package_quantity > 0),
  reorder_threshold NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (reorder_threshold >= 0),
  daily_usage_estimate NUMERIC(10,2) CHECK (daily_usage_estimate IS NULL OR daily_usage_estimate >= 0),
  reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_baby_barcode
  ON public.inventory_items(baby_id, barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_baby_id
  ON public.inventory_items(baby_id);

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  baby_id UUID NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('usage', 'refill', 'scan_refill', 'correction')),
  quantity_change NUMERIC(10,2) NOT NULL,
  quantity_after NUMERIC(10,2) NOT NULL CHECK (quantity_after >= 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item
  ON public.inventory_transactions(inventory_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_baby_id
  ON public.inventory_transactions(baby_id);

CREATE TABLE IF NOT EXISTS public.shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  quantity_value NUMERIC(10,2) CHECK (quantity_value IS NULL OR quantity_value > 0),
  quantity_unit TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'recipe', 'inventory')),
  source_recipe_id UUID REFERENCES public.baby_recipes(id) ON DELETE SET NULL,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  is_purchased BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_baby_id
  ON public.shopping_list_items(baby_id, is_purchased);

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_normalized
  ON public.shopping_list_items(baby_id, normalized_name);

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_inventory_item
  ON public.shopping_list_items(inventory_item_id)
  WHERE inventory_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_source_recipe
  ON public.shopping_list_items(source_recipe_id)
  WHERE source_recipe_id IS NOT NULL;

-- updated_at Trigger (Funktion existiert bereits, defensiv neu anlegen)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_shopping_list_items_updated_at ON public.shopping_list_items;
CREATE TRIGGER set_shopping_list_items_updated_at
  BEFORE UPDATE ON public.shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER set_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_product_catalog_updated_at ON public.product_catalog;
CREATE TRIGGER set_product_catalog_updated_at
  BEFORE UPDATE ON public.product_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: Einkaufsliste
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shopping items: select by baby member" ON public.shopping_list_items;
CREATE POLICY "Shopping items: select by baby member"
  ON public.shopping_list_items
  FOR SELECT
  TO authenticated
  USING (public.is_baby_member(baby_id));

DROP POLICY IF EXISTS "Shopping items: insert by baby member" ON public.shopping_list_items;
CREATE POLICY "Shopping items: insert by baby member"
  ON public.shopping_list_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND public.is_baby_member(baby_id)
  );

DROP POLICY IF EXISTS "Shopping items: update by baby member" ON public.shopping_list_items;
CREATE POLICY "Shopping items: update by baby member"
  ON public.shopping_list_items
  FOR UPDATE
  TO authenticated
  USING (public.is_baby_member(baby_id))
  WITH CHECK (public.is_baby_member(baby_id));

DROP POLICY IF EXISTS "Shopping items: delete by baby member" ON public.shopping_list_items;
CREATE POLICY "Shopping items: delete by baby member"
  ON public.shopping_list_items
  FOR DELETE
  TO authenticated
  USING (public.is_baby_member(baby_id));

-- RLS: Vorräte
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inventory items: select by baby member" ON public.inventory_items;
CREATE POLICY "Inventory items: select by baby member"
  ON public.inventory_items
  FOR SELECT
  TO authenticated
  USING (public.is_baby_member(baby_id));

DROP POLICY IF EXISTS "Inventory items: insert by baby member" ON public.inventory_items;
CREATE POLICY "Inventory items: insert by baby member"
  ON public.inventory_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND public.is_baby_member(baby_id)
  );

DROP POLICY IF EXISTS "Inventory items: update by baby member" ON public.inventory_items;
CREATE POLICY "Inventory items: update by baby member"
  ON public.inventory_items
  FOR UPDATE
  TO authenticated
  USING (public.is_baby_member(baby_id))
  WITH CHECK (public.is_baby_member(baby_id));

DROP POLICY IF EXISTS "Inventory items: delete by baby member" ON public.inventory_items;
CREATE POLICY "Inventory items: delete by baby member"
  ON public.inventory_items
  FOR DELETE
  TO authenticated
  USING (public.is_baby_member(baby_id));

-- RLS: Transaktionen (Audit-Log, kein Update/Delete)
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inventory transactions: select by baby member" ON public.inventory_transactions;
CREATE POLICY "Inventory transactions: select by baby member"
  ON public.inventory_transactions
  FOR SELECT
  TO authenticated
  USING (public.is_baby_member(baby_id));

DROP POLICY IF EXISTS "Inventory transactions: insert by baby member" ON public.inventory_transactions;
CREATE POLICY "Inventory transactions: insert by baby member"
  ON public.inventory_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND public.is_baby_member(baby_id)
  );

-- RLS: Produktkatalog (geteilt über alle Nutzer, schreibbar von Authentifizierten)
ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Product catalog: select by authenticated" ON public.product_catalog;
CREATE POLICY "Product catalog: select by authenticated"
  ON public.product_catalog
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Product catalog: insert by authenticated" ON public.product_catalog;
CREATE POLICY "Product catalog: insert by authenticated"
  ON public.product_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "Product catalog: update by creator" ON public.product_catalog;
CREATE POLICY "Product catalog: update by creator"
  ON public.product_catalog
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = created_by)
  WITH CHECK ((SELECT auth.uid()) = created_by);
