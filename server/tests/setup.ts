/**
 * setup.ts - Configuração global para todos os testes de backend.
 */
import { beforeAll, afterAll } from "vitest";
import { pool } from "../src/db";

beforeAll(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("[SETUP] Conexão com o banco de dados OK.");
  } catch (err) {
    throw new Error(`[SETUP] Falha ao conectar ao banco de dados: ${err}`);
  }
});

// NÃO fechar o pool aqui — ele é compartilhado entre test files.
// O Vitest encerra o processo automaticamente ao final.
