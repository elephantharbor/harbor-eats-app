/**
 * Instacart mock. Responses follow the documented shopping-list and retailers
 * shapes only. No cart, order, price, or stock fields on success.
 * Verified 2026-10-16:
 * https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page/
 * https://docs.instacart.com/developer_platform_api/api/retailers/get_nearby_retailers/
 */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function quantityError() {
  return json(
    {
      error: {
        message: "Invalid quantity: -0.1. Cannot be lower than or equal to 0.0",
        code: 1001,
      },
      meta: { key: "line_items[0].line_item_measurements[0].quantity" },
    },
    400
  );
}

export function createInstacartMock({ mode = "ok" } = {}) {
  const calls = [];
  const impl = async (url, init = {}) => {
    const href = String(url);
    const method = String(init.method || "GET").toUpperCase();
    let body = null;
    if (init.body) {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = null;
      }
    }
    calls.push({
      url: href,
      method,
      has_authorization: Boolean(init.headers && (init.headers.Authorization || init.headers.authorization)),
      body,
    });
    if (mode === "timeout") {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    }
    if (href.includes("/idp/v1/retailers")) {
      if (mode === "unauthorized") {
        return json({ error: { message: "Unauthorized", code: 4001 }, meta: {} }, 401);
      }
      return json({
        retailers: [
          {
            retailer_key: "test-retailer",
            name: "Test Retailer",
            retailer_logo_url: "www.logoUrl.com",
          },
        ],
      });
    }
    if (mode === "unauthorized") {
      return json({ error: { message: "Unauthorized", code: 4001 }, meta: {} }, 401);
    }
    if (mode === "rate_limited") {
      return json({ error: { message: "Retry later", code: 2003 }, meta: {} }, 429);
    }
    if (mode === "provider_error") {
      return json(
        {
          error: {
            message: "Sorry, an unexpected error occurred. Our team has been notified. Please try again later.",
            code: 5000,
          },
          meta: {},
        },
        500
      );
    }
    if (mode === "bad_url") {
      return json({ products_link_url: "https://evil.example/phish" });
    }
    if (mode === "invalid_body") {
      return json({ cart_id: "cart_should_not_surface", order_id: "order_should_not_surface" });
    }
    const items = body && Array.isArray(body.line_items) ? body.line_items : [];
    const bad = items.some((item) => {
      const measurements = item && item.line_item_measurements;
      if (!Array.isArray(measurements) || !measurements.length) return mode === "quantity_error";
      return measurements.some((m) => !(Number(m.quantity) > 0));
    });
    if (bad || mode === "quantity_error") return quantityError();
    return json({
      products_link_url: "https://www.instacart.com/store/shopping-list/mock",
    });
  };
  impl.calls = calls;
  return impl;
}
