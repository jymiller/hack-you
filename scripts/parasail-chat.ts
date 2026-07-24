// Simple Parasail chat — proves the GLM wiring end to end via src/server/parasail.ts.
//   one-shot     : tsx scripts/parasail-chat.ts "what is the capital of New York?"
//   interactive  : tsx scripts/parasail-chat.ts        (/exit to quit)
// Key from PARASAIL_API_KEY, model from PARASAIL_MODEL (set it to the GLM id) — both in .env.

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chat, type ChatMessage } from "../src/server/parasail.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {
  /* no .env — chat() will throw on the missing key */
}

async function ask(history: ChatMessage[], text: string): Promise<void> {
  history.push({ role: "user", content: text });
  const reply = await chat(history);
  history.push({ role: "assistant", content: reply });
  stdout.write(`\n${reply}\n\n`);
}

async function main(): Promise<void> {
  const model = process.env.PARASAIL_MODEL?.trim();
  console.log(`Parasail chat — model: ${model || "parasail-deepseek-r1 (default; set PARASAIL_MODEL for GLM)"}\n`);

  const history: ChatMessage[] = [];
  const oneShot = process.argv.slice(2).join(" ").trim();
  if (oneShot) {
    await ask(history, oneShot);
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  for (;;) {
    const line = (await rl.question("you › ")).trim();
    if (!line) continue;
    if (line === "/exit" || line === "/quit") break;
    try {
      await ask(history, line);
    } catch (err) {
      console.error(`\n[error] ${(err as Error).message}\n`);
    }
  }
  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
