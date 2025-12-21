import { gerarCaixaIdCurto, gerarPin } from "../net/pdvNetConfig";

export function createMockState() {
  return {
    caixaId: gerarCaixaIdCurto(),
    pin: gerarPin(),
    produtos: [
      {
        id: "prod-agua",
        nome: "Água 500ml",
        precoCentavos: 300,
        iconeKey: "💧",
        categoria: "Bebidas",
      },
      {
        id: "prod-refrigerante",
        nome: "Refrigerante lata",
        precoCentavos: 600,
        iconeKey: "🥤",
        categoria: "Bebidas",
      },
      {
        id: "prod-salgado",
        nome: "Salgado assado",
        precoCentavos: 800,
        iconeKey: "🥟",
        categoria: "Lanches",
      },
    ],
  };
}
