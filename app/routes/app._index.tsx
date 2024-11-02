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
  // const handleDropZoneDrop = useCallback(
  //   (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) =>
  //     setFiles((files) => [...files, ...acceptedFiles]),
  //   [],
  // );
  // const validImageTypes = ["image/gif", "image/jpeg", "image/png"];

  // const fileUpload = !files.length && <DropZone.FileUpload />;
  // const uploadedFiles = files.length > 0 && (
  //   <div style={{ padding: "0" }}>
  //     <LegacyStack vertical>
  //       {files.map((file, index) => (
  //         <LegacyStack alignment="center" key={index}>
  //           <Thumbnail
  //             size="small"
  //             alt={file.name}
  //             source={
  //               validImageTypes.includes(file.type)
  //                 ? window.URL.createObjectURL(file)
  //                 : NoteIcon
  //             }
  //           />
  //           <div>{file.name} </div>
  //         </LegacyStack>
  //       ))}
  //     </LegacyStack>
  //   </div>
  // );
  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);
  const generateProduct = () => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("price", price);
    formData.append("des", des);
    formData.append("imgurl", imgurl);
    // files.forEach((file) => formData.append("file", file));
    fetcher.submit(formData, { method: "POST" });
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
                <TextField
                  label="Product Name"
                  value={name}
                  onChange={(value) => setName(value)}
                  autoComplete="Product..."
                />
                <TextField
                  type="number"
                  label="Product Price"
                  value={price}
                  onChange={(value) => setPrice(value)}
                  autoComplete="$"
                />
                <TextField
                  type="text"
                  label="Product Description"
                  value={des}
                  onChange={(value) => setDes(value)}
                  autoComplete="...."
                />
                <TextField
                  type="text"
                  label="Image URL"
                  value={imgurl}
                  onChange={(value) => setImgurl(value)}
                  autoComplete="...."
                />
                {/* <DropZone onDrop={handleDropZoneDrop}>
                  {uploadedFiles}
                  {fileUpload}
                </DropZone> */}
                <Button submit>Submit</Button>
              </FormLayout>
            </Form>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
