import { ensureDbInitialized, db } from '../src/lib/db';

async function main() {
  console.log('Iniciando seed do banco de dados PostgreSQL (Currículo Mestre)...');
  await ensureDbInitialized();
  const coupons = await db.query<{ code: string; benefit_value: number }>(
    `SELECT code, benefit_value FROM coupons ORDER BY code ASC`
  );
  console.log('Cupons iniciais configurados:', coupons.rows);
  console.log('Seed concluído com sucesso.');
}

main().catch((err) => {
  console.error('Erro ao executar seed:', err);
  process.exit(1);
});
