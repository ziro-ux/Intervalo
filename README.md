# Intervalo

Diário de jejum intermitente, água e alimentação, com a Tata. Funciona offline e sem conta. Os dados ficam no aparelho.

## Como o projeto está organizado

| Pasta ou arquivo | O que tem |
|---|---|
| `src/index.html` | A estrutura das telas. Os marcadores `/*@css*/`, `/*@js*/` e `<!--@...-->` são preenchidos na montagem. |
| `src/css/` | Os estilos, em ordem: base, peso e primeiro uso, área segura, busca, jejum e jardim, jejum livre. |
| `src/js/` | O código, em ordem: app base (diário, jejum, Tata, catálogo), peso e instalação, busca e pratos, fases, jardim, lembretes e código de barras, atualizações do APK, jejum livre, voltar e backups. |
| `src/data/taco.json` | Os 530 alimentos da Tabela TACO, com nomes legíveis. |
| `src/fonts/` | Nunito (só os caracteres usados em português) e Lora. |
| `src/vendor/` | Leitor de código de barras (ZXing), carregado só quando a câmera abre. |
| `public/` | Manifesto, ícones e o service worker do site. |
| `android-res/` | Ícone pequeno das notificações do APK. |
| `build.mjs` | Junta tudo em `dist/`. |
| `tests/e2e.mjs` | Testes de ponta a ponta. |

## Montar e testar no computador

```bash
npm install
npx playwright install chromium
npm test        # monta em dist/ e roda os testes
```

`dist/index.html` é a versão do site e do APK. `dist/intervalo-offline.html` é o app inteiro num arquivo só.

## Publicação

Cada envio para a branch `main`:

1. **Publicar Intervalo** monta, testa e publica o site no GitHub Pages.
2. **Gerar APK** monta, testa, compila o APK e cria um release com o APK e a versão offline.

Se um teste falhar, nada é publicado. A aba Actions mostra qual teste quebrou.
