---
description: Regra de testes - nunca abrir navegador para teste, criar atalho na Área de Trabalho ou enviar o link no chat
always_on: true
---

# Regra de Testes e Navegador

- **Nunca use ferramentas de navegador automatizado para teste**: Nunca invoque `browser_subagent` ou ferramentas similares para rodar testes na aplicação web.
- **Forneça o Link no Chat**: Envie sempre o link acessível diretamente na resposta do chat (ex: `http://localhost:5173/`).
- **Crie Atalho na Área de Trabalho**: Crie um atalho `.url` na Área de Trabalho do usuário (`C:\Users\fulvi\Desktop`) apontando para a aplicação para facilitar o teste imediato pelo próprio usuário.
