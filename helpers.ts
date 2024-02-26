import * as coda from "@codahq/packs-sdk";
import * as htmlparser2 from "htmlparser2";
import * as showdown from "showdown";
import { NodeHtmlMarkdown, NodeHtmlMarkdownOption } from "node-html-markdown";
import escape from "html-es6cape";
import { findAll, replaceElement, removeElement, getParent, prevElementSibling, nextElementSibling } from "domutils";
import serialize from "dom-serializer";


/* -------------------------------------------------------------------------- */
/*                                   Config                                   */
/* -------------------------------------------------------------------------- */

const TELEGRAPH_BASE_API_URL = "https://api.telegra.ph/";
const TELEGRAPH_BASE_URL = "https://telegra.ph";

/* -------------------------------------------------------------------------- */
/*                              Helper Functions                              */
/* -------------------------------------------------------------------------- */

// Utility function to make requests to the API
export async function callApi(
  context: coda.ExecutionContext,
  endpoint: string,
  method: "GET" | "POST",
  params: any
) {
  let url = TELEGRAPH_BASE_API_URL + endpoint;
  url = params === undefined ? url : coda.withQueryParams(url, params);
  const response = await context.fetcher.fetch({
    method: method,
    url: url,
    headers: {
      "Content-Type": "application/json",
    }
  });
  // console.log(JSON.stringify(response, null, 2));
  return response.body;
}

// Utility function to make requests to the API with a path
export async function callApiPath(
  context: coda.ExecutionContext,
  endpoint: string,
  method: "GET" | "POST",
  path: string,
  params: any
) {
  let url = TELEGRAPH_BASE_API_URL + endpoint + "/" + path;
  url = params === undefined ? url : coda.withQueryParams(url, params);
  const response = await context.fetcher.fetch({
    method: method,
    url: url,
    headers: {
      "Content-Type": "application/json",
    }
  });
  // console.log(JSON.stringify(response, null, 2));
  return response.body;
}

// https://coda.io/@eric-koleda/coda-pack-markdown-and-html-behavior
export function jsonToHtml(jsonData) {
  // console.log(jsonData);
  // Fonction récursive pour traiter chaque élément JSON et ses enfants
  function processElement(element, isChild = false) {
      let html = "";

      // Sélectionne l'action à réaliser en fonction du type de balise
      switch (element.tag) {
          case "figure":
              // Traite les éléments figure, spécialement pour les images, vidéos et iframes
              html += `<div>`;
              const child = element.children[0];
              if (child.tag === "img") {
                  // Convertit les images en syntaxe Markdown
                  html += `<img src="${TELEGRAPH_BASE_URL + child.attrs.src}" />`;
              } else if (child.tag === "video") {
                  // Conserve les liens pour les vidéos
                  html += `<a href="${ TELEGRAPH_BASE_URL + child.attrs.src}">${ TELEGRAPH_BASE_URL + child.attrs.src}</a>`;
              } else if (child.tag === "iframe") {
                  // Conserve les liens pour les iframes
                  const url = extractUrl(child.attrs.src);
                  html += `<a href="${url}">${url}</a>`;
              };
              // Traite la légende (figcaption) si elle existe
              if (element.children.length > 1 && element.children[1].tag === "figcaption" && element.children[1].children[0] != '') {
                  html += `<br><em>${element.children[1].children[0]}</em></div>`;
              } else {
                html += `</div>`
              };
              break;
          case "p":
              html += `<p>`;
              element.children.forEach(child => {
                html += child.tag ? processElement(child, true) : child;
              });
              html += `</p>`;
              break;
          case "h3":
              // Convertit les titres h3 en Markdown
              html += `<h2>${element.children[0]}</h2>`;
              break;
          case "h4":
              // Convertit les titres h4 en Markdown
              html += `<h3>${element.children[0]}</h3>`;
              break;
          case "ul":
              html += '<ul>';
              element.children.forEach(child => {
                  html += `<li>${processElement(child, true)}</li>`;
              });
              html += '</ul>';
              break;
          case "ol":
              html += '<ol>';
              element.children.forEach(child => {
                  html += `<li>${processElement(child, true)}</li>`;
              });
              html += '</ol>';
              break;
          case "blockquote":
              html += "<blockquote>";
              element.children.forEach(child => {
                html += child.tag ? processElement(child, true) : child.replace(/\n/g, "  \n");
              });
              html = html.split("\n").filter(line => line.trim() !== "").join("\n") + '</blockquote>';
              break;
          case "strong":
              // Gère les balises strong pour le texte en gras
              html += `<strong>${element.children[0]}</strong>`;
              break;
          case "em":
              // Gère les balises em pour le texte en italique
              html += `<em>${element.children[0]}</em>`;
              break;
          case "a":
              // Convertit les liens en syntaxe Markdown
              html += `<a href="${element.attrs.href}" target="${element.attrs.target}">${element.children[0]}</a>`;
              break;
          case "br":
              // Gère les sauts de ligne
              html += "<br>";
              break;
          case "code":
              // Gère les blocs de code
              const code = escapeHTML(element.children[0]);
              html += `<pre>${code}</pre>`;
              break;
          default:
              // Traite les éléments non spécifiés
              html += element.children[0] + "";
      }

      // Ajouter un saut de ligne après les éléments de niveau 1
      if (!isChild) {
          html += ``;
      }

      return html;
  }

  // Convertit le tableau JSON en Html en traitant chaque élément
  return jsonData.map(element => processElement(element)).join('');

}

export function htmlToJson(html) {

    html = parseHTML(html);

    // console.log(html);
  
    const handler = new htmlparser2.DomHandler(); // Création d'un gestionnaire DOM avec htmlparser2
    const parser = new htmlparser2.Parser(handler); // Création d'un analyseur avec htmlparser2 et le gestionnaire DOM créé
    parser.write(html); // Écrire le HTML dans l'analyseur
    parser.end(); // Signaler la fin du document à l'analyseur

    const dom = handler.dom; // Récupération du DOM généré par l'analyseur

    let lastNodeWas = '';
  
    // Fonction récursive pour traiter chaque nœud du DOM
    function processNode(node) {
        
        // Création d'un objet JSON pour ce nœud
        const jsonNode = {
            tag: '', // Nom de la balise
            attrs: {}, // Initialisation d'un objet vide pour les attributs, sera rempli ci-dessous
            children: [] // Liste vide pour les enfants, sera rempli récursivement
        };
      
        // Traitement des attributs du nœud
        if (node.type === 'tag' || node.type === 'script' || node.type === 'style') { // Si le nœud est de type 'tag', 'script' ou 'style

            // console.log(node.type + ' : ' + node.name);
          
            // Boucle à travers les attributs du nœud et filtre ceux spécifiés
            for (let attr in node.attribs) {
                if (!attr.startsWith('data-') && attr !== 'contenteditable' && attr !== 'dir' && attr !== 'style') {
                    jsonNode.attrs[attr] = node.attribs[attr]; // Ajout de l'attribut si ce n'est pas un attribut exclu
                }
            }

            switch (node.name) {
                case 'div':
                  jsonNode.tag = lastNodeWas = 'figure';
                  break;
                case 'p':
                  jsonNode.tag = lastNodeWas = node.name;
                  break;
                case 'a':
                  if (node.attribs.href.endsWith('.mp4')) {
                    jsonNode.tag = lastNodeWas = "video";
                    jsonNode.attrs = {
                      ...jsonNode.attrs,
                      src: node.attribs.href.replace('https://telegra.ph', ''),
                      preload: 'auto',
                      autoplay: 'autoplay',
                      loop: 'loop',
                      muted: 'muted'
                    };
                    delete jsonNode.attrs.href;
                  } else if (node.attribs.href.includes('youtu.be') || node.attribs.href.includes('youtube.com') || node.attribs.href.includes('vimeo.com')) {
                    jsonNode.tag = lastNodeWas = "iframe";
                    jsonNode.attrs = {
                      ...jsonNode.attrs,
                      src: `/embed/${node.attribs.href.includes('youtu.be') || node.attribs.href.includes('youtube.com') ? 'youtube' : 'vimeo'}?url=${encodeURIComponent(node.attribs.href)}`,
                      width: '640',
                      height: '360',
                      frameborder: '0',
                      allowtransparency: 'true',
                      allowfullscreen: 'true',
                      scrolling: 'no'
                    };
                    delete jsonNode.attrs.href;
                  } else {
                    jsonNode.tag = lastNodeWas = node.name;
                  }
                  break;
                case 'img':
                  jsonNode.tag = lastNodeWas = "img";
                  jsonNode.attrs = {
                    ...jsonNode.attrs,
                  };
                  break;
                case 'h2':
                  jsonNode.tag = lastNodeWas = "h3";
                  break;
                case 'h3':
                  jsonNode.tag = lastNodeWas = "h4";
                  break;
                case 'strong':
                  jsonNode.tag = lastNodeWas = node.name;
                  break;
                case 'em':
                  if (['img', 'video', 'iframe'].includes(lastNodeWas)) {
                    jsonNode.tag = "figcaption";
                  } else {
                    jsonNode.tag = node.name;
                  };
                  lastNodeWas = node.name;
                  break;
                case 'code':
                case 'pre':
                  jsonNode.tag = lastNodeWas = 'code';
                  break;
                case 'blockquote':
                  jsonNode.tag = lastNodeWas = node.name;
                  break;
                case 'span':
                  break;
                default:
                  jsonNode.tag = lastNodeWas = node.name;
                  break;
            };
          
            // Traitement récursif de chaque enfant du nœud
            node.children.forEach(child => {
                jsonNode.children.push(processNode(child));
            });

            if (jsonNode.tag === 'code') {
              return {
                tag: 'p',
                children: [
                  jsonNode
                ]
              };
            } else {
              return jsonNode; // Retour de l'objet JSON pour ce nœud
            }
          
        } else if (node.type === 'text') { // Si le nœud est de type 'text'
                    
            switch (lastNodeWas) {
              case 'video':
              case 'iframe':
                break;
              default:
                return node.data; // Retour du texte du nœud
            };
        }
    }

    const json = dom.map(node => processNode(node)); // Transformation de chaque nœud du DOM en JSON
    removeEmptyAttrsAndChildren(json);
    return json.filter(item => item); // Filtrage des valeurs null/undefined et retour du résultat
    // return html;
}

export function htmlToMarkdown(htmlText) {
  // https://www.npmjs.com/package/node-html-markdown
  const markText = NodeHtmlMarkdown.translate(
      /* html */ htmlText, 
      /* options (optional) */ {}, 
      /* customTranslators (optional) */
      {
        iframe: {
          preserveIfEmpty: true,
          postprocess: () => {
            //console.log("iframe found");
          }
        }
      },
      /* customCodeBlockTranslators (optional) */ undefined
    );
  return markText;
}

export function markdownToHtml(markdownText) {
    const converter = new showdown.Converter();
    const html = converter.makeHtml(markdownText);
    return html;
}

function extractUrl(src) {
    const urlParam = src.match(/url=([^&]+)/);
    return urlParam ? decodeURIComponent(urlParam[1]) : '';
}

function escapeHTML(str){
    return escape(str);
}

/**
 * Analyse et transforme une chaîne HTML donnée.
 *
 * @param {string} htmlContent - Le contenu HTML à analyser et transformer.
 * @returns {string} Le contenu HTML transformé.
 */
export function parseHTML(htmlContent) {
    // Analyser le HTML en un document DOM
    const document = htmlparser2.parseDocument(htmlContent);

    // Traitement spécifique pour les balises 'pre'
    findAll(node => node.type === "tag" && (node.name === "pre" || node.name === "code"), document.children).forEach(pre => {
      
      // Vérifier si le div a exactement un enfant
      if (pre.children && pre.children.length === 1) {
        
          // Supprimer les balises 'div' et 'span' à l'intérieur de 'pre'
          pre.children = removeDivAndSpanNodes(pre);
          
          // Créer une balise 'p' pour englober 'pre'
          // const p = {
          //     type: "tag",
          //     name: "p",
          //     attribs: {},
          //     children: [pre]
          // };
          // // Remplacer 'pre' par 'p' contenant 'pre'
          // replaceElement(pre, p);

        };
    });

    // Convertir les 'span' en 'em' pour l'italique et en 'strong' pour le gras
    findAll(node => node.type === 'tag' && node.name === 'span' && node.attribs.style === "font-style: italic;", document.children).forEach(e => {
        e.name = "em";
        delete e.attribs.style;
    });
    findAll(node => node.type === 'tag' && node.name === 'span' && node.attribs.style === "font-weight: bold;", document.children).forEach(e => {
        e.name = "strong";
        delete e.attribs.style;
    });

    // Remplacer les éléments 'span' inutiles par leur contenu
    removeSpanNodes(document,document);

    // Supprimer tous les attributs de style
    findAll(node => node.attribs && 'style' in node.attribs, document.children).forEach(node => {
        delete node.attribs.style;
    });
  
    // console.log('\npre + em + strong + remove span + style\n\n' + serialize(document));

    // Nettoyer les balises `br` dans la structure `<figure>`
    findAll(node => node.type === "tag" && node.name === "br", document.children).forEach(img => {
        const parent = getParent(img);
        if (hasRequiredFigureNode(parent)) {
            let siblings = parent.children;
            // console.log(parent.name);
            // parent.children.forEach(child => {
            //     if (child.type === 'tag') {
            //         console.log("> " + child.name + siblings.indexOf(child));
            //     } else {
            //         console.log("> " + child.data + " autre " + siblings.indexOf(child));
            //     }
            // });
            removeElement(siblings[1]);
        };  
    });
  
    // Traitement des balise div
    findAll(node => node.type === "tag" && node.name === "div", document.children).forEach(div => {
      
      if (!(hasRequiredFigureNode(div))) {
          // Créer une balise 'p' et remplacer le 'div' par celle-ci
          const p = {
            type: "tag",
            name: "p",
            attribs: {},
            children: div.children
          };
          replaceElement(div, p);
      } else {
          // Parcourir les enfants de la balise <div> et les ajouter à <div>
          transformFigureTextNode(div);
      };
      
    });

    // console.log('\ndiv en p\n\n' + serialize(document));
  
    // Transformer les liens YouTube et MP4 dans les balises <p>
    findAll(node => node.type === "tag" && node.name === "p", document.children).forEach(p => {

        // Vérifier si le contenu de la balise <p> est un lien YouTube ou MP4
        transformFigureTextNode(p);
      
    });

    // console.log('\np en div\n\n' + serialize(document)+ '\n\n');
                                             
    // Renvoyer le contenu HTML transformé
    return serialize(document);
}

/**
 * Fonctions utiles
 * @param {*} node
 */
function removeEmptyAttrsAndChildren(obj) {
    // Si l'objet est un tableau, appliquez la fonction récursivement à chaque élément
    if (Array.isArray(obj)) {
        return obj
            .map(item => removeEmptyAttrsAndChildren(item)) // Appliquer la fonction à chaque élément
            .filter(item => item != null); // Filtrer les éléments nuls
    } else if (obj != null && typeof obj === 'object') {
        // Si "attrs" est vide ou nul, supprimez-le
        if (obj.hasOwnProperty('attrs') && (obj.attrs === null || Object.keys(obj.attrs).length === 0)) {
            delete obj.attrs;
        }
        // Traitement spécifique pour la propriété "children"
        if (obj.hasOwnProperty('children')) {
            if (Array.isArray(obj.children)) {
                // Appliquez la fonction à chaque enfant et filtrez les éléments nuls
                obj.children = obj.children.map(child => removeEmptyAttrsAndChildren(child)).filter(child => child != null);

                // Si "children" est maintenant un tableau vide ou contient uniquement un élément nul, supprimez-le
                if (obj.children.length === 0 || (obj.children.length === 1 && obj.children[0] === null)) {
                    delete obj.children;
                }
            }
        }
        // Appliquer la fonction récursivement à d'autres propriétés de l'objet
        Object.keys(obj).forEach(key => {
            if (key !== 'attrs' && key !== 'children') {
                obj[key] = removeEmptyAttrsAndChildren(obj[key]);
            }
        });
    }
    // Retournez l'objet modifié
    return obj;
}

function isEmpty(value) {
    return value == null || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && Object.keys(value).length === 0);
}

function transformFigureTextNode(node,containsTargetLink : false) {
  if (!node.children) {
      return [];
  }
  // Vérifier si le contenu de la balise <node> est un lien YouTube ou MP4
  node.children.forEach(child => {
      if (child.type === "text" && (child.data.includes("vimeo.com") || child.data.includes("youtu.be") || child.data.includes("youtube.com") || child.data.includes(".mp4"))) {
          containsTargetLink = true;
      }
  });

  if (containsTargetLink) {
      // Créer une nouvelle structure <div>
      const div = {
          type: "tag",
          name: "div",
          attribs: {},
          children: []
      };

      // Parcourir les enfants de la balise <p> et les ajouter à <div>
      node.children.forEach(child => {
          if (child.type === "text" && (child.data.includes("vimeo.com") || child.data.includes("youtu.be") || child.data.includes("youtube.com") || child.data.includes(".mp4"))) {
              // Ajouter une balise <a> pour le lien
              const a = {
                  type: "tag",
                  name: "a",
                  attribs: { href: child.data },
                  children: [{ type: "text", data: child.data }]
              };
              div.children.push(a);
          } else {
              // Ajouter les autres éléments (comme <br> et <em>) à <div>
              div.children.push(child);
          }
      });

      // Remplacer la balise <p> par la nouvelle balise <div>
      replaceElement(node, div);
  }
}

function hasRequiredFigureNode(node) {
    return node.children.some(child => {
        // Vérifie si l'enfant est une balise 'img'
        if (child.type === "tag" && child.name === "img") {
            return true;
        }

        // Vérifie si l'enfant est une balise 'a' avec un attribut 'href' spécifique
        if (child.type === "tag" && child.name === "a") {
            const href = child.attribs.href;
            if (href && (href.includes("vimeo.com") || href.includes("youtube.com") || href.includes("youtu.be") || href.includes(".mp4"))) {
                return true;
            }
        }

        // Vérifie si l'enfant est une balise 'a' avec un attribut 'href' spécifique
        if (child.type === "text" && (child.data.includes("vimeo.com") || child.data.includes("youtube.com") || child.data.includes("youtu.be") || child.data.includes(".mp4"))) {
            return true;
        }
      
        return false;
    });
}

function removeSpanNodes(document,node) {
  if (!node.children) {
      return [];
  }
  findAll(node => node.type === 'tag' && node.name === 'span', document.children).forEach(span => {
      let parent = span.parent;
      let siblings = parent.children;
      let spanIndex = siblings.indexOf(span);
      siblings.splice(spanIndex, 1, ...span.children);
  });
}

function removeDivAndSpanNodes(node) {
    if (!node.children) {
        return [];
    }
    let newChildren = [];
    node.children.forEach(child => {
        if (child.type === 'tag' && (child.name === 'div' || child.name === 'span')) {
            // Pour les balises 'div' et 'span', ajouter leurs enfants au lieu d'eux-mêmes
            newChildren.push(...removeDivAndSpanNodes(child));
        } else {
            // Pour les autres types de nœuds, les ajouter directement
            newChildren.push(child);
        }
    });

    return newChildren;
}

/**
 * Deprecated
 */
function parseHTMLRegex(html){

    // Convertir les italiques et gras
    html = html.replace(/<span style="font-style: italic;">([^<]*)<\/span>/g, '<em>$1</em>');
    html = html.replace(/<span style="font-weight: bold;">([^<]*)<\/span>/g, '<strong>$1</strong>');

    // Remplacer les balise div pour les sauts de ligne
    html = html.replace(/<div[^>]*>(\<br>)<\/div>/gi, "<p>$1</p>");

    // Supprimer les balises span inutiles
    html = html.replace(/<span[^>]*>(.*?)<\/span>/gi, "$1");

    // Modifier les balises blockquote et pre
    html = html.replace(/<div[^>]*>\s*(<pre[^>]*>[\s\S]*?<\/pre>|<code[^>]*>[\s\S]*?<\/code>)\s*<\/div>/gi, "$1");
    html = html.replace(/<p[^>]*>\s*(<pre[^>]*>[\s\S]*?<\/pre>|<code[^>]*>[\s\S]*?<\/code>)\s*<\/p>/gi, "$1"); 
    html = html.replace(/(<pre[^>]*>|<code[^>]*>)([\s\S]*?)(<\/pre>|<\/code>)/gi, function(match, startTag, content, endTag) {
        return startTag + content.replace(/<\/?(div|span)([^>]*)>/gi, '') + endTag;
    }); 

    // Nettoyer les balises <br> dans la structure <figure>
    html = html.replace(/(<img[^>]*>|<a href="[^"]*(vimeo\.com|youtube\.com|youtu\.be)[^"]*">[^<]*<\/a>)\s*<br\s*\/?>\s*(<em>)/gi, '$1$3');

    // Supprimer les styles inline
    html = html.replace(/ style="[^"]*"/gi, '');

    return html;
}
