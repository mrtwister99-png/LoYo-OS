# Mary Jane — Telegram bot (řízení celého systému)

Mary Jane má vlastního Telegram bota. Vše, co mu napíšeš, jde do `POST /api/run`
(orchestrátor), takže platí stejné příkazy jako v UI chatu — jen z telefonu.

## Jeden bot pro celý systém

Lopatinka už vlastního bota nemá — veškerý Telegram provoz jde přes Mary Jane.
Mary používá **`TELEGRAM_BOT_TOKEN`** (stejný token, kterým Lopatinka posílá tipy)
a jediná drží `getUpdates`, takže nevzniká konflikt 409. `TELEGRAM_MARY_BOT_TOKEN`
zůstává jen jako volitelný override, kdybys někdy chtěl Mary na samostatném botovi.

## Nastavení

1. Použij token svého existujícího bota (nebo nového z @BotFather → `/newbot`).
2. V `.env` v rootu projektu:
   ```
   TELEGRAM_BOT_TOKEN=1234567890:AAE...
   ```
3. Napiš botovi `/id` — vrátí tvoje chat id. Volitelně ho zpřesni:
   ```
   TELEGRAM_MARY_CHAT_ID=1909519508
   ```
   (Když chybí, použije se `TELEGRAM_CHAT_ID`.)
4. Spuštění:
   - UI: agent Mary Jane → **ZAPNOUT TELEGRAM BOTA** (`POST /api/agents/mary-jane/telegram/start`), nebo
   - ručně: `node data/capabilities/agents/mary-jane/telegram-bot.mjs`
5. Log: `data/logs/mary-telegram-bot.log`, pid: `data/capabilities/agents/mary-jane/mary-telegram.pid`.

## Příkazy

| Příkaz | Co udělá |
|---|---|
| `/agents` | seznam agentů a jak je spustit |
| `/zapni vše` | spustí celou sestavu (Lopatinka + Koštěrad) |
| `/lopatinka [rozpočet]` | hledání výhodné elektroniky (dry-run, do Telegramu neposílá) |
| `/stepan <co prodáváš>` | ocenění + inzerát |
| `/kosterad` | kontrola a oprava manifestů |
| `/julia <téma>` | hloubkový research s citacemi |
| `/activity` | poslední akce agentů |
| `/boty` | stav Telegram botů |
| `/id` | tvoje chat id |
| cokoli dalšího | Mary Jane (poznámky, úkoly, /status, /find…) |

Každá zpráva se ukládá do chat historie a každá akce agenta do Activity feedu.

## 👍/👎 u tipů Lopatinky

Lopatinka posílá tipy s tlačítky přes stejný token. Kliknutí (callback_query) obsluhuje
Mary bot — zapíše hodnocení do `lopatinka/feedback.json`, takže 👎 se už nikdy nepošle.
Druhý poller neexistuje, takže se tlačítka neztratí.
