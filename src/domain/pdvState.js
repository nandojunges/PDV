function gerarCaixaIdCurto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function gerarPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

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