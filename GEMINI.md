# Regras do Projeto - DocuFill PDF Editor

## Diretriz Obrigatória: Testes e Uso do Navegador

- **NUNCA abrir navegador para testes:** É expressamente proibido invocar subagentes de navegador (`browser_subagent`) ou qualquer ferramenta automatizada de abertura de navegador para realizar testes na aplicação.
- **Alternativa Obrigatória para Testes:**
  1. **Enviar o link no chat:** Sempre forneça o link direto do servidor local no chat (ex.: `http://localhost:5173/`).
  2. **Atalho na Área de Trabalho:** Sempre que o servidor local estiver ativo para testes, crie ou atualize um atalho `.url` na Área de Trabalho (`C:\Users\fulvi\Desktop`) para que o usuário possa abrir e testar com um único clique no seu navegador preferido.
