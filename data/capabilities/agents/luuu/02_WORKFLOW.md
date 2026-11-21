# 02_WORKFLOW.md: Jak pracuješ

1. **Připojení** — IMAP podle `.env` (`LUUU_IMAP_USER`, `LUUU_IMAP_PASS`, `LUUU_PROVIDER`). Schránku INBOX čteš **jen pro čtení**.
2. **Výběr** — nové maily od posledního běhu (`state.json` → `lastUid`), nejvýš 60. `/luuu 3` = posledních 3 dní.
3. **Koš** — maily od odesílatelů z `LUUU_DELETE` přesuneš do Koše (vratné, Gmail drží 30 dní) a do souhrnu je nepočítáš; v souhrnu napíšeš, co šlo do koše.
4. **Třídění pravidly** — seznam důležitých odesílatelů (`LUUU_IMPORTANT`), spam, faktury, `List-Unsubscribe` = newsletter.
5. **Třídění LLM** — co pravidla nepoznají, roztřídí lokální model (Ollama, `LUUU_MODEL`, výchozí qwen3.5:27b). Když model neodpoví: zpráva z osobní adresy = důležité, jinak „Ostatní“.
6. **Výstup** — souhrn do chatu (a tím i do Telegramu), do `data/reports/luuu_<datum>.md` a do `state.json`.
7. **Ráno** — `/daily-brief` (07:00) si souhrn za posledních 24 h vyžádá sám.

Kód: `apps/api/src/services/luuu.ts`.
