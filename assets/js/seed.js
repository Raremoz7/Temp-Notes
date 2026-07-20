/* =========================================================================
   seed.js — a gaveta de estreia
   Dados fictícios locais (sem backend). São os exemplos do briefing, para
   dar vida à Inbox, à roleta e ao histórico já na primeira abertura.
   ========================================================================= */

import { STATUS } from "./models.js";

const DAY = 86400000;
const now = () => Date.now();

export function seedTasks() {
  const t = now();
  return [
    {
      title: "Arrumar o portão",
      note: "O trinco tá emperrando. Ver se resolve com óleo ou se precisa trocar.",
      category: "casa", time: "t15", energy: "low", outside: false,
      status: STATUS.ACTIVE, createdAt: t - 12 * DAY,
    },
    {
      title: "Responder o João",
      note: "Ele mandou aquela mensagem faz tempo.",
      category: "pessoas", time: "t5", energy: "low", outside: false,
      status: STATUS.ACTIVE, createdAt: t - 6 * DAY,
    },
    {
      title: "Começar aquele livro",
      category: "estudar", time: "t30", energy: "med", outside: false,
      status: STATUS.ACTIVE, createdAt: t - 21 * DAY,
    },
    {
      title: "Organizar a gaveta da cozinha",
      category: "casa", time: "t15", energy: "med", outside: false,
      status: STATUS.ACTIVE, createdAt: t - 3 * DAY,
    },
    {
      title: "Levar o casaco para consertar",
      note: "O zíper soltou. Tem uma costureira perto do mercado.",
      category: "resolver", time: "t30", energy: "med", outside: true,
      status: STATUS.ACTIVE, createdAt: t - 9 * DAY,
    },
    {
      title: "Pesquisar um curso",
      category: "estudar", time: "t30", energy: "med", outside: false,
      status: STATUS.ACTIVE, createdAt: t - 30 * DAY,
    },
    {
      title: "Levar coisas pro conserto",
      note: "O liquidificador e o abajur.",
      category: "resolver", time: "t60", energy: "high", outside: true,
      status: STATUS.ACTIVE, createdAt: t - 2 * DAY,
    },
    {
      title: "Regar as plantas da varanda",
      category: "corpo", time: "t5", energy: "low", outside: false,
      status: STATUS.ACTIVE, createdAt: t - 1 * DAY,
    },

    /* Já concluídas — para o histórico não começar vazio */
    {
      title: "Pagar a conta de luz",
      category: "resolver", time: "t5", energy: "low", outside: false,
      status: STATUS.DONE, createdAt: t - 14 * DAY, completedAt: t - 2 * DAY,
    },
    {
      title: "Devolver o livro pra Ana",
      category: "pessoas", time: "t15", energy: "low", outside: true,
      status: STATUS.DONE, createdAt: t - 20 * DAY, completedAt: t - 5 * DAY,
    },
  ];
}
