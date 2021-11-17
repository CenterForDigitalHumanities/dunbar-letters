const DEV = true

const baseV1 = DEV ? "http://devstore.rerum.io/" : "http://store.rerum.io/"
const tiny = DEV ? "http://tinydev.rerum.io/app/" : "http://tinypaul.rerum.io/dla/"

export default {
    ID: "deer-id", // attribute, URI for resource to render
    TYPE: "deer-type", // attribute, JSON-LD @type
    TEMPLATE: "deer-template", // attribute, enum for custom template
    KEY: "deer-key", // attribute, key to use for annotation
    LABEL: "title", // attribute, alternate label for properties
    CONTEXT: "deer-context", // attribute, JSON-LD @context, scoped
    ATTRIBUTION: "deer-creator", // attribute, Web Annotation `creator`, scoped
    MOTIVATION: "deer-motivation", // attribute, Web Annotation `motivation`, scoped
    LIST: "deer-list", // attribute, property with resource array
    COLLECTION: "deer-collection", // attribute, name of aggregating collection
    LISTENING: "deer-listening", // attribute, name of container to watch for clicks
    LINK: "deer-link", // attribute, location of href#[deer-id] for <a>s
    VIEW: "deer-view, .deer-view", // selector, identifies render containers
    FORM: "form[deer-type]", // selector, identifies data entry containers
    ITEMTYPE: "deer-item-type", //attribute, specialty forms ('entity' by default)
    SOURCE: "deer-source", // attribute, URI for asserting annotation
    EVIDENCE: "nv-evidence", // attribute, URI for supporting evidence
    INPUTTYPE: "deer-input-type", //attribute, defines whether this is an array list, array set, or object 
    ARRAYDELIMETER: "deer-array-delimeter", //attribute, denotes delimeter to use for array.join()

    INPUTS: ["input", "textarea", "dataset", "select"], // array of selectors, identifies inputs with .value
    CONTAINERS: ["ItemList", "ItemListElement", "List", "Set", "list", "set", "@list", "@set"], // array of supported list and set types the app will dig into for array values
    PRIMITIVES: [],

    URLS: {
        BASE_ID: baseV1,
        CREATE: tiny + "create",
        UPDATE: tiny + "update",
        OVERWRITE: tiny + "overwrite",
        QUERY: tiny + "query",
        SINCE: baseV1 + "since"
    },

    EVENTS: {
        CREATED: "deer-created",
        UPDATED: "deer-updated",
        LOADED: "deer-loaded",
        NEW_VIEW: "deer-view",
        NEW_FORM: "deer-form",
        VIEW_RENDERED: "deer-view-rendered",
        FORM_RENDERED: "deer-form-rendered",
        CLICKED: "deer-clicked"
    },

    SUPPRESS: ["__rerum", "@context"], //properties to ignore
    DELIMETERDEFAULT: ",", //Default delimeter for .split()ing and .join()ing 
    ROBUSTFEEDBACK: true, //Show warnings along with errors in the web console.  Set to false to only see errors.  

    /**
     * Add any custom templates here through import or copy paste.
     * Templates added here will overwrite the defaults in deer-render.js.
     * 
     * Each property must be lower-cased and return a template literal
     * or an HTML String.
     */
    TEMPLATES: {
        cat: (obj) => `<h5>${obj.name}</h5><img src="http://placekitten.com/300/150" style="width:100%;">`,
        msList: function (obj, options = {}) {
            let tmpl = `<h2>Manuscripts</h2>`
            if (options.list) {
                tmpl += `<ul>`
                obj[options.list].forEach((val, index) => {
                    tmpl += `<li><a href="${options.link}${val['@id']}"><deer-view deer-id="${val["@id"]}" deer-template="label"></deer-view><deer-view deer-template="saveTPENlinks" deer-id="${val["@id"]}"> 0 </deer-view></a></li>`
                })
                tmpl += `</ul>`
            }
            return tmpl
        },
        saveTPENlinks: (obj, options = {}) => {

            const DC_ROOT_ANNOTATION = {
                "@context": "http://www.w3.org/ns/anno.jsonld",
                "@type": "Annotation",
                creator: "http://store.rerum.io/v1/id/618d4cfa50c86821e60b2cba",
            }
            const NEW_RECORD = {
                "@context": "https://schema.org/docs/jsonldcontext.json",
                "@type": "Text",
                creator: "http://store.rerum.io/v1/id/618d4cfa50c86821e60b2cba",
            }

            const UTILS = importScripts('./deer-utils.js')
            const pLimit = importScripts('./plimit.js')

            return {
                html: `<button role="button" class="addemup"></button>`,
                then: elem => {
                    elem.addEventListener('click', saveLink)
                }
            }


            function saveLink(event) {
                const target = event.target.closest("[deer-view]")
                const projectIDs = event.target.getAttribute("tpen-projects")?.split("|")
                const limiter = pLimit(4)

                projectIDs.forEach((id, index) => {
                    limiter(async () => {
                        let t = index > 0 ? await fetc : target
                    })
                })
            }

            async function createCopy(id, projectID) {
                let original = await fetch(baseV1 + "id/" + id).then(r => r.json()).then(entity => {
                    return UTILS.expand(entity).then(expanded => {
                        delete expanded.__rerum
                        delete expanded['@id']
                        delete entity.id
                        return expanded
                    })
                })
                const annoMap = {
                    targetCollection: original.targetCollection,
                    date: original.date,
                    identifier: original.identifier,
                    source: original.source,
                    tpenProject: original.tpenProject
                }

                return limiter(() => {
                    const anno = Object.assign({
                        target: newID,
                        body: Object.entries(el.metadata).map((m) => ({ [m[0]]: m[1] }))
                    }, DC_ROOT_ANNOTATION)
                    return fetch(tiny + "create", {
                        method: 'POST',
                        mode: 'cors',
                        body: JSON.stringify(anno)
                    }).catch(err => console.error(err))
                })
            }
        }
    },
    version: "alpha"
}
