import * as coda from "@codahq/packs-sdk";

/* -------------------------------------------------------------------------- */
/*                            Common object schemas                           */
/* -------------------------------------------------------------------------- */

export const AccountSchema = coda.makeObjectSchema({
  properties: {
    short_name: { type: coda.ValueType.String },
    author_name: { type: coda.ValueType.String },
    author_url: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    access_token: { type: coda.ValueType.String, description: "Access token of the Telegraph account." },
    auth_url: { type: coda.ValueType.String },
    page_count: { type: coda.ValueType.Number },
  },
  displayProperty: "short_name",
});

export const PageSchema = coda.makeObjectSchema({
  properties: {
    path: { type: coda.ValueType.String },
    url: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    title: { type: coda.ValueType.String, required: true}, // mutable: true },
    description: { type: coda.ValueType.String },
    author_name: { type: coda.ValueType.String}, // mutable: true },
    author_url: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url}, // mutable: true },
    image_url: { type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference, },
    content: { type: coda.ValueType.String },
    // content_html_flat: { type: coda.ValueType.String,},
    content_html: { type: coda.ValueType.String, codaType: coda.ValueHintType.Html}, // mutable: true, },
    views: { type: coda.ValueType.Number },
    can_edit: { type: coda.ValueType.Boolean },
  },
  displayProperty: "title",
  featuredProperties: ["title","url","content_html","image_url","views"],
  idProperty: "path",
  titleProperty: "title",
  subtitleProperties: [
    { property: "author_name", label: "" },
    "views",
  ],
  snippetProperty: "description",
  imageProperty: "image_url",
  linkProperty: "url",
});

export const PageListSchema = coda.makeObjectSchema({
  properties: {
    total_count: { type: coda.ValueType.Number },
    pages: { type: coda.ValueType.Array, items: PageSchema },
    display: { type: coda.ValueType.String },
  },
  displayProperty: "display",
});

export const PageViewsSchema = coda.makeObjectSchema({
  properties: {
    path: { type: coda.ValueType.String },
    views: { type: coda.ValueType.Number },
    year: { type: coda.ValueType.Number },
    month: { type: coda.ValueType.Number },
    day: { type: coda.ValueType.Number },
    display: { type: coda.ValueType.String },
  },
  displayProperty: "display",
});
