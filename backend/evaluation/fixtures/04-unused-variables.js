function processOrder(order) {
  const tax = order.total * 0.2;
  const discount = order.total * 0.1;
  const shipping = 5.99;
  const finalPrice = order.total + shipping;

  const logger = console.log;
  const debugMode = false;

  return {
    price: finalPrice,
    orderId: order.id,
  };
}

const MAX_RETRIES = 3;
const TIMEOUT = 5000;
const BASE_URL = "https://api.example.com";

function fetchOrder(id) {
  return fetch(BASE_URL + "/orders/" + id);
}
