import { useCallback, useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Button,
  BlockStack,
  DropZone,
  FormLayout,
  TextField,
  LegacyStack,
  Thumbnail,
  Banner,
} from "@shopify/polaris";
import getStream from "get-stream";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const des = formData.get("des") as string;
  const price = formData.get("price") as string;
  // const mediaFile = formData.get("file") as File;
  const mediaUrl = formData.get("imgurl") as string;

  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        input: {
          title: `${color} ${name}`,
          descriptionHtml: des,
        },
      },
    },
  );
  const responseJson = await response.json();
  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: price }],
      },
    },
  );
  const variantResponseJson = await variantResponse.json();
  const mediaResponse = await admin.graphql(
    `#graphql
    mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
      productCreateMedia(media: $media, productId: $productId) {
        media {
          alt
          mediaContentType
          status
        }
        mediaUserErrors {
          field
          message
        }
        product {
          id
          title
        }
      }
    }`,
    {
      variables: {
        media: [
          {
            alt: "Product Image",
            mediaContentType: "IMAGE",
            originalSource: mediaUrl,
          },
        ],
        productId: product.id,
      },
    },
  );
  const mediaJson = await mediaResponse.json();
  console.log(responseJson, mediaJson, variantResponseJson);
  return json({
    product: responseJson!.data!.productCreate!.product,
    media: mediaJson,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  });
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [des, setDes] = useState("");
  const [imgurl, setImgurl] = useState("");

  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const productId = fetcher.data?.product?.id.replace(
    "gid://shopify/Product/",
    "",
  );
  // Error states
  const [errors, setErrors] = useState({
    name: "",
    price: "",
    des: "",
    imgurl: "",
  });

  const validateFields = () => {
    const newErrors = {
      name: "",
      price: "",
      des: "",
      imgurl: "",
    };

    if (!name) newErrors.name = "Product name is required.";
    if (!price || isNaN(price) || parseFloat(price) <= 0)
      newErrors.price = "Product price must be a positive number.";
    if (!des) newErrors.des = "Product description is required.";
    if (!imgurl || !isValidURL(imgurl))
      newErrors.imgurl = "Please enter a valid image URL.";

    setErrors(newErrors);

    // Check if there are any errors
    return !Object.values(newErrors).some((error) => error !== "");
  };

  const isValidURL = (string) => {
    try {
      new URL(string);
      return true;
    } catch (e) {
      return false;
    }
  };
  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);
  const generateProduct = async () => {
    if (!validateFields()) return; // Exit if validation fails

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("price", price);
      formData.append("des", des);
      formData.append("imgurl", imgurl);

      // Uncomment if files need to be appended
      // files.forEach((file, index) => formData.append(`file_${index}`, file));

      console.log("Form submitted with data:", { name, price, des, imgurl });

      await fetcher.submit(formData, { method: "POST" });
    } catch (error) {
      console.error("Form submission failed:", error);
      // Add user feedback for errors, e.g., toast notification or error banner
    }
  };
  return (
    <Page>
      <TitleBar title="Remix app template">
        <button
          variant="primary"
          onClick={(e) => {
            e.preventDefault();
            generateProduct();
          }}
        >
          Add Product
        </button>
      </TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Form onSubmit={generateProduct}>
              <FormLayout>
                {Object.values(errors).some((error) => error) && (
                  <Banner status="critical">
                    {Object.values(errors).map(
                      (error, index) => error && <p key={index}>{error}</p>,
                    )}
                  </Banner>
                )}
                <TextField
                  label="Product Name"
                  value={name}
                  onChange={(value) => {
                    setName(value);
                    if (value)
                      setErrors((prevErrors) => ({ ...prevErrors, name: "" }));
                  }}
                  error={errors.name}
                  autoComplete="Product..."
                />
                <TextField
                  type="number"
                  label="Product Price"
                  value={price}
                  onChange={(value) => {
                    setPrice(value);
                    if (value && !isNaN(value) && parseFloat(value) > 0) {
                      setErrors((prevErrors) => ({ ...prevErrors, price: "" }));
                    }
                  }}
                  error={errors.price}
                  autoComplete="$"
                />
                <TextField
                  type="text"
                  label="Product Description"
                  value={des}
                  onChange={(value) => {
                    setDes(value);
                    if (value)
                      setErrors((prevErrors) => ({ ...prevErrors, des: "" }));
                  }}
                  error={errors.des}
                  autoComplete="...."
                />

                <TextField
                  type="text"
                  label="Image URL"
                  value={imgurl}
                  onChange={(value) => {
                    setImgurl(value);
                    if (isValidURL(value))
                      setErrors((prevErrors) => ({
                        ...prevErrors,
                        imgurl: "",
                      }));
                  }}
                  error={errors.imgurl}
                  autoComplete="...."
                />
                <Button submit>Submit</Button>
              </FormLayout>
            </Form>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
