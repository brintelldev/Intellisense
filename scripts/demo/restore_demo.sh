#!/usr/bin/env bash
# ─── Demo Restore Script ────────────────────────────────────────────────────
# Usage: bash scripts/demo/restore_demo.sh
# Restores the demo tenant (DCCO Equipamentos) to the full Fase 2 state in < 60s.
# Run this before starting the demo or if anything goes wrong mid-demo.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DB_URL="postgresql://intellisense:intellisense_dev@localhost:5433/intellisense"

echo "🔄 Restoring DCCO demo tenant (Fase 2 state)..."

# Load env (if available)
if [ -f "$PROJECT_ROOT/.env" ]; then
  export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs) 2>/dev/null || true
fi
DB_URL="${DATABASE_URL:-$DB_URL}"

# Step 1: Reset the tenant via API (fastest path if server is running)
echo "  Tentando reset via API..."
if curl -s -X POST http://localhost:3001/api/seed/demo -o /tmp/seed_result.json 2>/dev/null; then
  if grep -q '"customers"' /tmp/seed_result.json 2>/dev/null; then
    echo "  ✅ Seed via API concluído"
    # Step 2: Seed historical data
    echo "  Populando dados históricos..."
    node "$SCRIPT_DIR/seed-historical.mjs" 2>&1 | grep -E "✓|✗|erro" || true
    echo "✅ Demo restaurado com dados históricos."
    exit 0
  fi
fi

# Step 2: Restore from snapshot_final.sql (full restore with history)
SNAPSHOT_FINAL="$SCRIPT_DIR/snapshot_final.sql"
SNAPSHOT_BASIC="$SCRIPT_DIR/snapshot.sql"

if [ -f "$SNAPSHOT_FINAL" ]; then
  echo "  📦 Restaurando do snapshot final (com histórico completo)..."
  # Drop and recreate all data
  psql "$DB_URL" -c "
    DO \$\$ DECLARE tid uuid;
    BEGIN
      SELECT id INTO tid FROM tenants WHERE company_name = 'DCCO Equipamentos' LIMIT 1;
      IF tid IS NOT NULL THEN
        DELETE FROM lead_score_history WHERE lead_id IN (SELECT id FROM leads WHERE tenant_id = tid);
        DELETE FROM customer_score_history WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = tid);
        DELETE FROM obtain_lead_actions WHERE tenant_id = tid;
        DELETE FROM obtain_alerts WHERE tenant_id = tid;
        DELETE FROM obtain_scores WHERE tenant_id = tid;
        DELETE FROM obtain_campaign_roi WHERE tenant_id = tid;
        DELETE FROM obtain_funnel_metrics WHERE tenant_id = tid;
        DELETE FROM obtain_uploads WHERE tenant_id = tid;
        DELETE FROM leads WHERE tenant_id = tid;
        DELETE FROM obtain_icp_clusters WHERE tenant_id = tid;
        DELETE FROM obtain_campaigns WHERE tenant_id = tid;
        DELETE FROM retain_alerts WHERE tenant_id = tid;
        DELETE FROM retain_actions WHERE tenant_id = tid;
        DELETE FROM retain_predictions WHERE tenant_id = tid;
        DELETE FROM retain_churn_causes WHERE tenant_id = tid;
        DELETE FROM retain_analytics WHERE tenant_id = tid;
        DELETE FROM retain_uploads WHERE tenant_id = tid;
        DELETE FROM customer_notes WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = tid);
        DELETE FROM customers WHERE tenant_id = tid;
        DELETE FROM scoring_configs WHERE tenant_id = tid;
        DELETE FROM column_mapping_templates WHERE tenant_id = tid;
        DELETE FROM users WHERE tenant_id = tid;
        DELETE FROM tenants WHERE id = tid;
      END IF;
    END \$\$;
  " 2>&1 | grep -v "^$" || true

  psql "$DB_URL" < "$SNAPSHOT_FINAL"
  echo "✅ Snapshot final restaurado (100 clientes + histórico completo)."
  exit 0
fi

if [ -f "$SNAPSHOT_BASIC" ]; then
  echo "  📦 Restaurando do snapshot básico..."
  psql "$DB_URL" < "$SNAPSHOT_BASIC"
  echo "  ⚠️  Snapshot básico restaurado (sem histórico). Execute: node scripts/demo/seed-historical.mjs"
  exit 0
fi

echo "⚠️  Não foi possível restaurar: servidor offline e nenhum snapshot encontrado."
echo "   Inicie o servidor: npm run dev"
echo "   Depois execute: node scripts/demo/upload_csv_a_correct.js && node scripts/demo/seed-historical.mjs"
exit 1
