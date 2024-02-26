import * as coda from "@codahq/packs-sdk";
import * as schemas from "./schemas";
import * as helpers from "./helpers";

export const pack = coda.newPack();

/* -------------------------------------------------------------------------- */
/*                               Authentication                               */
/* -------------------------------------------------------------------------- */

// Allow the pack to make requests to Telegra.ph.
pack.addNetworkDomain("telegra.ph");

// System-wide authentication to the Telegra.ph API, using an API key in the query string. See https://telegra.ph/api#createAccount.
pack.setUserAuthentication({
  type: coda.AuthenticationType.QueryParamToken,
  paramName: "access_token",
  // Determines the display name of the connected account.
  getConnectionName: async function (context) {
    let fields = "[\"short_name\",\"author_url\",\"page_count\",\"author_name\",\"auth_url\"]" // short_name, author_name, author_url, auth_url, page_count.
    const response = await helpers.callApi(context, "getAccountInfo", "GET", { fields });
    return response.result.short_name;
  },
});

/* -------------------------------------------------------------------------- */
/*                                 Parameters                                 */
/* -------------------------------------------------------------------------- */

const LimitParameter = coda.makeParameter({
  name: "limit", type: coda.ParameterType.Number, description: "The number of pages to retrieve.", suggestedValue: 50
});
const OffsetParameter = coda.makeParameter({
  name: "offset", type: coda.ParameterType.Number, description: "The offset from which to start retrieving pages.", suggestedValue: 0
});

/* -------------------------------------------------------------------------- */
/*                                  Formulas                                  */
/* -------------------------------------------------------------------------- */

// Add a function to create an account and obtain an access_token.
pack.addFormula({
  name: "CreateAccount",
  description: "Creates a new Telegra.ph account.",
  isAction: true,
  connectionRequirement: coda.ConnectionRequirement.None, // Important
  parameters: [
    coda.makeParameter({
      name: "short_name", type: coda.ParameterType.String, description: "The account name."
    }),
    coda.makeParameter({
      name: "author_name", type: coda.ParameterType.String, description: "The author name."
    }),
    coda.makeParameter({
      name: "author_url", type: coda.ParameterType.String, description: "The author URL. Optional.", optional: true
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: schemas.AccountSchema,
  execute: async function ([short_name, author_name, author_url], context) {
    const response = await helpers.callApi(context, "createAccount", "POST", { short_name, author_name, author_url });
    if (!response.ok) {
      throw new coda.UserVisibleError("Error :" + response.error)
    }
    return response.result;
  },
});

// Add a function to create an account and obtain an access_token.
pack.addFormula({
  name: "EditAccount",
  description: "Use this method to update information about a Telegraph account. Pass only the parameters that you want to edit.",
  isAction: true,
  parameters: [
    coda.makeParameter({
      name: "short_name", type: coda.ParameterType.String, description: "The account name.", optional: true
    }),
    coda.makeParameter({
      name: "author_name", type: coda.ParameterType.String, description: "The author name.", optional: true
    }),
    coda.makeParameter({
      name: "author_url", type: coda.ParameterType.String, description: "The author URL. Optional.", optional: true
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: schemas.AccountSchema,
  execute: async function ([short_name, author_name, author_url], context) {
    const response = await helpers.callApi(context, "editAccountInfo", "POST", { short_name, author_name, author_url });
    if (!response.ok) {
      throw new coda.UserVisibleError("Error :" + response.error)
    }
    return response.result;
  },
});

// Add a function to get information about the account.
pack.addFormula({
  name: "AccountInfo",
  description: "Gets information about a Telegra.ph account.",
  parameters: [
    // coda.makeParameter({
    //   name: "fields", 
    //   type: coda.ParameterType.String,
    //   description: "List of account fields to return. A comma separated string. Available fields: short_name, author_name, author_url, auth_url, page_count.",
    //   suggestedValue: "short_name,author_name,author_url,auth_url,page_count"
    // }),
  ],
  resultType: coda.ValueType.Object,
  schema: schemas.AccountSchema,
  execute: async function ([],context) {
    let fields = "[\"short_name\",\"author_url\",\"page_count\",\"author_name\",\"auth_url\",\"page_count\"]"
    const response = await helpers.callApi(context, "getAccountInfo", "GET", { fields });
    if (!response.ok) {
      throw new coda.UserVisibleError("Error :" + response.error)
    }
    return response.result;
  },
});

// Add a function to revoke access_token and generate a new one.
pack.addFormula({
  name: "AccountRevokeToken",
  description: "Revoke access_token and generate a new one, for example, if the user would like to reset all connected sessions, or you have reasons to believe the token was compromised.",
  isAction: true,
  parameters: [],
  resultType: coda.ValueType.Object,
  schema: schemas.AccountSchema,
  execute: async function ([],context) {
    let url = "https://api.telegra.ph/revokeAccessToken";
    let response = await context.fetcher.fetch({
      method: "POST",
      url: url
    });
    let data = response.body;
    if (!data.ok) {
      throw new coda.UserVisibleError("Error :" + data.error)
    }
    return data.result;
  },
});

// Add a function to get the list of pages.
pack.addFormula({
  name: "PageList",
  description: "Gets a list of Telegra.ph pages.",
  parameters: [ LimitParameter , OffsetParameter ],
  resultType: coda.ValueType.Object,
  schema: schemas.PageListSchema,
  execute: async function ([limit, offset], context) {
    const response = await helpers.callApi(context, "getPageList", "GET", { limit, offset });
    if (!response.ok) {
      throw new coda.UserVisibleError("Error : " + response.error)
    }
    let data = response.result;
    data = { ...data, display: "List of page" };
    let items = data.pages;
    for(let i = 0; i< items.length; i++) {
      let path = items[i].path;
      let return_content = true;
      const responseContent = await helpers.callApiPath(context, "getPage", "GET", path, { return_content });
      items[i].content = responseContent.result.content;
      items[i].content_html = helpers.jsonToHtml(items[i].content);
      // items[i].content_html_flat = helpers.jsonToHtml(items[i].content);
    }
    return data;
  },
});

// Use this method to get the number of views for a Telegraph article. .
pack.addFormula({
  name: "PageViews",
  description: "Retrieves the number of views of a page on Telegra.ph.",
  connectionRequirement: coda.ConnectionRequirement.None,
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String, name: "path", description: "The unique path of the article on Telegra.ph.",
    }),
    coda.makeParameter({
      name: "year", type: coda.ParameterType.Number, description: "Required if month is passed. If passed, the number of page views for the requested year will be returned.", optional: true
    }),
    coda.makeParameter({
      name: "month", type: coda.ParameterType.Number, description: "Required if day is passed. If passed, the number of page views for the requested month will be returned.", optional: true
    }),
    coda.makeParameter({
      name: "day", type: coda.ParameterType.Number, description: "If passed, the number of page views for the requested day will be returned.", optional: true
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: schemas.PageViewsSchema,
  execute: async function ([path, year, month, day], context) {
    const response = await helpers.callApiPath(context, "getViews", "POST", path, { year, month, day});
    if (!response.ok) {
      throw new coda.UserVisibleError("Error : " + response.error)
    }
    // Fetching and returning the JSON data from the response.
    let data = response.result;
    data = { ...data, display: "Views for a page", path: path };
    data = year ? { ...data, year: year } : data ;
    data = month ? { ...data, month: month } : data ;
    data = day ? { ...data, day: day } : data ;
    return data;
  },
});

// Use this method to create a new Telegraph page. 
pack.addFormula({
  name: "CreatePage",
  description: "Create a Telegra.ph page.",
  isAction: true,
  parameters: [ 
    coda.makeParameter({
      name: "title", type: coda.ParameterType.String, description: "Page title.",
    }),
    coda.makeParameter({
      name: "content", type: coda.ParameterType.String, description: "Content of the page.",
    }),
    coda.makeParameter({
      name: "author_name", type: coda.ParameterType.String, description: "Author name, displayed below the article's title.", optional: true
    }),
    coda.makeParameter({
      name: "author_url", type: coda.ParameterType.String, description: "Profile link, opened when users click on the author's name below the title. Can be any link, not necessarily to a Telegram profile or channel.", optional: true
    }),
    coda.makeParameter({
      name: "return_content", type: coda.ParameterType.Boolean, description: "If true, content field will be returned in Page object.", suggestedValue: true, optional: true
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: schemas.PageSchema,
  execute: async function ([title, content, author_name, author_url, return_content], context) {
    content = helpers.htmlToJson(content);
    content = JSON.stringify(content,null,2);
    const response = await helpers.callApi(context, "createPage", "POST", { title, content, author_name, author_url, return_content });
    if (!response.ok) {
      throw new coda.UserVisibleError("Error : " + response.error)
    }
    return response.result;
  },
});

// Use this method to edit a Telegraph page. 
pack.addFormula({
  name: "EditPage",
  description: "Use this method to edit an existing Telegraph page.",
  isAction: true,
  parameters: [ 
    coda.makeParameter({
      name: "path", type: coda.ParameterType.String, description: "The unique path of the article on Telegra.ph.",
    }),
    coda.makeParameter({
      name: "title", type: coda.ParameterType.String, description: "Page title.",
    }),
    coda.makeParameter({
      name: "content", type: coda.ParameterType.Html, description: "Content of the page. Must be Html.",
    }),
    coda.makeParameter({
      name: "author_name", type: coda.ParameterType.String, description: "Author name, displayed below the article's title.", optional: true
    }),
    coda.makeParameter({
      name: "author_url", type: coda.ParameterType.String, description: "Profile link, opened when users click on the author's name below the title. Can be any link, not necessarily to a Telegram profile or channel.", optional: true
    }),
    coda.makeParameter({
      name: "return_content", type: coda.ParameterType.Boolean, description: "If true, content field will be returned in Page object.", suggestedValue: true, optional: true
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: coda.withIdentity(schemas.PageSchema, "Page"),
  execute: async function ([path, title, content, author_name, author_url, return_content], context) {
    content = helpers.htmlToJson(content);
    content = JSON.stringify(content,null,2);
    const response = await helpers.callApiPath(context, "editPage", "POST", path, { title, content, author_name, author_url, return_content });
    if (!response.ok) {
      throw new coda.UserVisibleError("Error : " + response.error)
    }
    return response.result;
  },
});

// Use this method to get a Telegraph page.
pack.addFormula({
  name: "PageGet",
  description: "Use this method to get a Telegraph page.",
  connectionRequirement: coda.ConnectionRequirement.None, // Important
  parameters: [
    coda.makeParameter({
      name: "path", 
      type: coda.ParameterType.String, 
      description: "The unique path of the article on Telegra.ph.",
    }),
    coda.makeParameter({
      name: "return_content", 
      type: coda.ParameterType.Boolean, 
      description: "If true, content field will be returned in Page object.", 
      suggestedValue: true, 
      optional: true
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: schemas.PageSchema,
  execute: async function ([path, return_content], context) {
    const response = await helpers.callApiPath(context, "getPage", "GET", path, { return_content });
    if (!response.ok) {
      throw new coda.UserVisibleError("Error : " + response.error)
    };
    response.result.content_html = helpers.jsonToHtml(response.result.content);
    // response.result.content_html_flat = helpers.jsonToHtml(response.result.content);
    return response.result;
  },
});

pack.addFormula({
  name: "HtmlToJson",
  description: "Convert rich text to JSON Node.",
  connectionRequirement: coda.ConnectionRequirement.None, // Important
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Html,
      name: "html",
      description: "The rich text to convert.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Boolean,
      name: "string",
      description: "Stringify the Json?",
    }),
  ],
  resultType: coda.ValueType.String,
  execute: async function ([html,string], context) {
    if(string) {
        return JSON.stringify(helpers.htmlToJson(html),null,2);
    } else {
        return helpers.htmlToJson(html);
    }
  },
});

pack.addFormula({
  name: "CleanHtml",
  description: "Clean Coda Html output.",
  connectionRequirement: coda.ConnectionRequirement.None, // Important
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Html,
      name: "html",
      description: "The rich text to convert.",
    }),
  ],
  resultType: coda.ValueType.String,
  execute: async function ([html], context) {
    return helpers.parseHTML(html)
  },
});

pack.addFormula({
  name: "JsonToHtml",
  description: "Convert JSON Node to rich text.",
  connectionRequirement: coda.ConnectionRequirement.None, // Important
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "json",
      description: "The rich text to convert.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.Boolean,
      name: "string",
      description: "Stringify the Html?",
    }),
  ],
  resultType: coda.ValueType.String,
  execute: async function ([json,string], context) {
    if(string) {
        return JSON.stringify(helpers.jsonToHtml(json));
    } else {
        return helpers.jsonToHtml(json);
    }
  },
});

/* -------------------------------------------------------------------------- */
/*                                 Sync Table                                 */
/* -------------------------------------------------------------------------- */

pack.addSyncTable({
  name: "Pages",
  schema: schemas.PageSchema,
  identityName: "Page",
  description: "A sync table that displays all pages available in an account. Only the 200 first pages are listed.",
  formula: {
    name: "SyncPages",
    description: "Sync pages",
    parameters: [ LimitParameter , OffsetParameter ],
    execute: async function ([limit,offset] , context) {
      const response = await helpers.callApi(context, "getPageList", "GET", { limit , offset });
      if (!response.ok) {
        throw new coda.UserVisibleError("Error : " + response.error)
      }
      let items = response.result.pages;
      for(let i = 0; i< items.length; i++) {
        let path = items[i].path;
        let return_content = true;
        const responseContent = await helpers.callApiPath(context, "getPage", "GET", path, { return_content });
        items[i].content = responseContent.result.content;
        items[i].content_html = helpers.jsonToHtml(items[i].content);
        // items[i].content_html_flat = helpers.jsonToHtml(items[i].content);
        // const responseViews = await helpers.callApiPath(context, "getViews", "GET", path, {});
        // items[i].views = responseViews.result.views;
        items[i].views = responseContent.result.views;
      }
      return {
        result: items,
      }
    },
    // executeUpdate: async function ([path, title, content, author_name, author_url], updates, context) {
    //   let update = updates[0];  // Only one row at a time, by default.
    //   let page = update.newValue;
    //   content = helpers.htmlToJson(page.content);
    //   content = JSON.stringify(content,null,2);
    //   const response = await helpers.callApiPath(context, "editPage", "POST", path, { title, content, author_name, author_url, return_content : true });
    //   if (!response.ok) {
    //     throw new coda.UserVisibleError("Error : " + response.error)
    //   }
    //   return response.result;
    // },
  },
});

/* -------------------------------------------------------------------------- */
/*                          Custom Column Formats                             */
/* -------------------------------------------------------------------------- */

pack.addColumnFormat({
  name: "Get Page",
  instructions: "Enter a pass to get the informations.",
  formulaName: "PageGet",
});