---
name: revisar-projeto
description: Audita o projeto marv-gestão inteiro (ou um módulo) atrás de bugs e de melhorias de experiência do usuário, e entrega um relatório priorizado. Use quando o usuário pedir para revisar o projeto todo, caçar bugs, procurar problemas, ou melhorar a UX/usabilidade de telas — não só o diff recente.
---

# Revisar projeto: bugs + experiência do usuário

Auditoria do código **inteiro** (não de um diff) em dois eixos:

- **Bugs**: coisas que quebram, calculam errado, perdem dados ou expõem dados.
- **UX**: coisas que funcionam, mas confundem, atrasam ou frustram quem usa o sistema no dia a dia (equipe de obra, almoxarifado, escritório — muitas vezes no celular).

Escreva tudo em português (pt-BR).

## 1. Escopo

- Sem argumento → projeto todo.
- Com argumento (ex.: `estoque`, `obras`, `app/(app)/funcionarios`) → só aquele módulo e os componentes/libs que ele usa.

Monte a lista de módulos a partir do código, não de memória:

```bash
ls "app/(app)" app/api app/print app/pub app/portal components lib
```

Agrupe em lotes de tamanho parecido (≈3–6 mil linhas cada; `wc -l` ajuda). Arquivos gigantes como `app/(app)/obras/[id]/page.tsx` ficam num lote só deles. Agrupamento típico:

1. Obras (páginas de obra, RDO, pagamentos, financeiro da obra, modelos)
2. Estoque (estoques, itens, movimentações, registrar, importar, necessidade de compra, consumo)
3. Funcionários (cadastro, alocação, uniformes, EPI)
4. Manutenções, ferramentas, equipamentos, etiquetas públicas (`app/pub`)
5. Financeiro, administrativo, clientes, notas, documentos, relatórios, ESG
6. Rotas de API (`app/api`), cron, `middleware.ts`, `lib/`, autenticação, portal do cliente
7. Telas de impressão (`app/print`), dashboard, login, perfil, configurações, admin

Leia também `CLAUDE.md` (regras do projeto) e passe as regras para cada subagente.

## 2. Revisão em paralelo

Lance **um subagente por lote, todos na mesma mensagem** (paralelo). Cada um recebe: a lista de arquivos do lote, as regras do `CLAUDE.md`, os dois checklists abaixo colados por inteiro, e este pedido:

> Leia os arquivos inteiros (não só trechos). Para cada achado dê: arquivo:linha, eixo (Bug ou UX), gravidade (Alta/Média/Baixa), o que acontece hoje em termos concretos (passo a passo de quem usa → resultado errado), e a correção sugerida em 1–2 linhas. Só reporte o que você confirmou lendo o código — se for suspeita, marque "a confirmar". Não aponte estilo, nome de variável ou refatoração sem efeito para o usuário. Máximo de 15 achados, os mais graves primeiro.

### Checklist de bugs

- **Supabase**: `error` ignorado depois de `.select/.insert/.update/.delete` (tela mostra sucesso mas nada salvou); `.single()` onde pode vir 0 ou várias linhas; filtro faltando (`.eq('obra_id', …)`) que mistura dados de obras/estoques; update/delete sem `.eq` que atinge a tabela toda.
- **Segurança**: rota de API ou página pública (`app/pub`, `app/portal`, `app/print`) sem checar sessão/token; uso da service role key fora do servidor; dados de um usuário visíveis a outro; segredos no client.
- **Estado e async**: `useEffect` com dependências erradas (dados velhos, loop de requisições); botão de salvar que pode ser clicado duas vezes e duplica registro; condição de corrida entre requisições; estado não atualizado depois de salvar (precisa F5).
- **Cálculos**: somas de estoque/financeiro com `float` sem arredondar; saldo que fica negativo sem aviso; texto vs número (`"10" + 5`); `parseFloat` em número com vírgula brasileira (`"1.234,56"`).
- **Datas**: fuso horário (`new Date('2026-10-27')` vira dia anterior no Brasil); comparação de datas como string; formatos misturados.
- **Dados presos**: cadastro sem tela de edição ou sem como desfazer (regra do `CLAUDE.md`).
- **Crash**: acesso a `undefined` (`item.obra.nome` quando obra pode ser nula), `.map` em algo que pode vir `null`, divisão por zero.
- **Cron e integrações** (Drive, e-mail, Gemini, NF-e): erro engolido sem log; processamento repetido que gera duplicados; timeout sem tratamento.

### Checklist de UX

- **Feedback**: salvar/excluir sem mensagem de sucesso ou erro; erro técnico cru na tela ("violates foreign key…") em vez de mensagem clara em português; sem indicador de carregamento; botão sem estado de "salvando…".
- **Estados vazios**: lista vazia sem explicação nem atalho para criar o primeiro item.
- **Ações destrutivas**: excluir sem confirmação; confirmação que não diz o que será apagado; sem como desfazer.
- **Formulários**: validação só no servidor; campo obrigatório não marcado; perde tudo que foi digitado ao errar ou sair sem querer; teclado errado no celular (faltando `inputMode="decimal"` em quantidade/valor); máscara de moeda/CPF/CNPJ/telefone ausente; foco não vai para o primeiro campo com erro.
- **Celular**: tabela que estoura a largura sem rolagem; botões pequenos demais para dedo (< 40px); modal que não cabe na tela; ações principais escondidas.
- **Formatação brasileira**: valores sem `R$` e separador de milhar; datas fora de `dd/mm/aaaa`; textos em inglês ou sem acento.
- **Fluxo**: tarefa frequente que exige muitos cliques; busca/filtro faltando em lista longa; filtro que some ao voltar da tela de detalhe; sem link de volta; nomes inconsistentes para a mesma coisa em telas diferentes.
- **Acessibilidade básica**: botão só com ícone sem `aria-label`/`title`; contraste baixo; `<div onClick>` no lugar de botão.

## 3. Verificação

Antes de entregar, confira você mesmo cada achado de gravidade **Alta**: abra o arquivo na linha citada e confirme que o problema existe. Descarte o que não se sustentar. Junte achados repetidos (o mesmo padrão em várias telas vira um achado com a lista de lugares).

## 4. Relatório

Salve em `revisoes/AAAA-MM-DD.md` (data de hoje) e mostre um resumo no chat. Estrutura:

```markdown
# Revisão do projeto — dd/mm/aaaa

Escopo: … · Arquivos lidos: N · Achados: X bugs, Y de UX

## Bugs
### Alta
- **[título curto]** — `arquivo:linha`
  O que acontece: …
  Correção: …
### Média
### Baixa

## Experiência do usuário
### Alta / Média / Baixa (mesmo formato)

## Padrões que se repetem
- … (problema que aparece em várias telas e vale corrigir de uma vez)

## Por onde começar
1. … (as 3–5 correções com melhor relação impacto/esforço)
```

**Não corrija nada nesta skill.** No fim, pergunte ao usuário quais achados ele quer que você corrija.
