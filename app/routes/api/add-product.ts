import { Shopify } from "@shopify/shopify-api";

export default async function handler(ctx) {
  const session = await Shopify.Utils.loadCurrentSession(ctx.req, ctx.res);
  const { Product } = Shopify.Clients.Rest;

  try {
    const client = new Product({
      session: session,
    });

    const response = await client.post({
      path: 'products',
      data: {
        product: {
          title: ctx.request.body.title,
          description: ctx.request.body.description,
          price: ctx.request.body.price,
          media: ctx.request.body.media,
        },
      },
      type: "application/json",
    });

    ctx.body = response.body;
  } catch (error) {
    console.error("Error creating product:", error);
    ctx.status = 500;
    ctx.body = { error: "Error creating product" };
  }
}
